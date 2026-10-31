# Doku Engine — Low-Level Design (draft 1)

Companion to `DESIGN.md` §4. This describes `src/engine/`: data structures, algorithms, APIs, and tests. The engine is pure TypeScript with no UI, Tauri, DOM, or storage imports, so it runs in the browser, in a Web Worker, in Vitest, and in the offline `tools/` scripts.

## 1. Constraints and goals

- **Puzzle:** N×N grid, 7 ≤ N ≤ 11, N connected colored regions, exactly one face per region, row, and column, no two faces touching (diagonals included).
- **Unique solution:** every shipped level has exactly one solution, stored with the level.
- **Deterministic:** no `Math.random`, no `Date`. All randomness comes from a seeded PRNG passed in, so a seed reproduces a puzzle on any device.
- **Immutable boards:** functions return new boards; nothing mutates inputs. (A board is ≤121 bytes, so copying is cheap, and undo/redo becomes a list of boards.)
- **Fast:** rule checks per tap < 1 ms; `rate()` < 10 ms for N=11; hint < 10 ms. Generation may take seconds and runs in a Worker.
- **Sound:** no technique may ever eliminate a cell that is in the solution. This is the central invariant and is tested directly (§9).

## 2. Data model

Cells are addressed by a flat index `i = r * N + c` everywhere inside the engine; `Coord {r, c}` appears only at the API boundary.

```ts
type Coord = { r: number; c: number };

// Serialized form (JSON level packs). Small and human-checkable.
interface Level {
  id: string;
  size: number;             // N
  regions: number[][];      // N×N region ids, 0..N-1
  solution: number[];       // solution[r] = column of the face in row r (length N)
  tier?: Tier;              // set by the generator after rating
  seed?: string;            // for generated levels
}

enum Cell { Empty = 0, Mark = 1, Face = 2 }

// Player board: one byte per cell. Marks are free notes and are NEVER read by
// the engine's reasoning (a mark may be wrong); only Face cells are facts.
type Board = Readonly<Uint8Array>;      // length N*N, values of Cell

type Tier = 'easy' | 'medium' | 'hard' | 'expert';
```

`Level.solution` as a column-per-row array is compact, and it makes "one face per row" true by construction. This replaces the `Coord[]` shown in `DESIGN.md` §4; update that doc when this one lands.

### Compiled puzzle (derived, not serialized)

`compile(level)` precomputes everything the algorithms need so they never recompute geometry:

```ts
interface Puzzle {
  n: number;
  regionOf: Uint8Array;              // cell → region id
  solution: Uint8Array;              // cell-indexed: 1 if in solution (for judging taps)
  solutionByRow: Uint8Array;         // = level.solution
  neighbors: Uint8Array[];           // cell → indices of the ≤8 adjacent cells
  units: Unit[];                     // 3N units: N rows, N cols, N regions
}

interface Unit {
  kind: 'row' | 'col' | 'region';
  id: number;                        // row index, col index, or region id
  cells: Uint8Array;                 // member cell indices
}
```

`validateLevel(level): LevelIssue[]` (pure, never throws) checks: size in 7..11 (`size`), `regions` is N×N (`regions-shape`), ids 0..N-1 each used (`region-count`), every region 4-connected (`region-connected`), and the solution is a valid placement: `solution-shape`, then `col`, `region`, `adjacent` (consecutive rows with column difference ≤ 1). `row` is not checked since `solution` is column-per-row. `LevelIssue = { rule, message, cells: Coord[] }`. Structural failures (size, shape, count) short-circuit the rest; connectivity and solution issues report together.

`loadLevel(level): Level` calls `validateLevel` and throws `LevelError` (carrying `issues`; message names each rule and its cells) when non-empty. It only validates when `import.meta.env.DEV` is true, so release builds skip it. The generator calls `validateLevel` directly.

## 3. Module map

```
engine/
  types.ts        Level, Board, Tier, Cell, Coord
  compile.ts      compile(), idx/coord helpers
  validate.ts     validateLevel(), loadLevel(), LevelError
  board.ts        emptyBoard(), setCell(), facesOf() (immutable helpers)
  rules.ts        findConflicts(), isSolved(), judgeTap()
  candidates.ts   Candidates type, fromBoard(), placeFace(), contradiction()
  techniques.ts   TECHNIQUES ladder, Deduction type
  solver.ts       solveByTechniques(), solve(), countSolutions()
  difficulty.ts   rate()
  hints.ts        nextHint()
  generator.ts    generate()
  seed.ts         Rng, hashSeed(), shuffle()
  index.ts        public API (only what the rest of the app may import)
```

Dependency direction (no cycles): `types ← compile ← board ← rules`; `compile ← candidates ← techniques ← solver ← difficulty ← hints, generator`; `seed ← generator`.

## 4. rules.ts

```ts
function judgeTap(p: Puzzle, cell: number): 'correct' | 'wrong';
function findConflicts(b: Board, level: Level): Conflict[];
function isSolved(p: Puzzle, b: Board): boolean;
```

- **`judgeTap`** is the heart-cost rule from `DESIGN.md` §4: `wrong` iff `!p.solution[cell]`. O(1). The store calls it before placing; on `wrong` it spends a heart and marks the cell instead of placing a face.
- **`findConflicts`** is for optional highlighting only. A `Conflict` is `{ reason: ConflictReason; cells: Coord[] }` (one per offending row, column, region, or adjacent pair; cells ascending). `ConflictReason` is `'row' | 'col' | 'region' | 'adjacent'`. One pass groups faces per row/col/region, then a neighbor scan (forward offsets only: E, SW, S, SE) emits one 2-cell `adjacent` conflict per touching pair, diagonals included. Result order: `row`, `col`, `region`, then `adjacent` in row-major order of each pair's first cell. Since wrong faces are never placed, conflicts should not occur in normal play; keeping it is cheap and guards against a corrupted save.
- **`isSolved`**: face count == N and every face is `judgeTap == correct`. (Equivalent to "all rules satisfied" because the solution is unique.)

## 5. Candidates and propagation (candidates.ts)

Techniques reason over **candidates** rather than the raw board.

```ts
interface Candidates {
  alive: Uint8Array;        // cell → 1 if a face could still go here
  placed: Uint8Array;       // cell → 1 if a face is placed
  // Per-unit counters kept in sync with alive/placed, so "how many candidates
  // does this unit have?" is O(1):
  aliveCount: Uint8Array;   // unit index → number of alive cells
  satisfied: Uint8Array;    // unit index → 1 if the unit already has its face
}
```

- `fromBoard(p, board)`: start with every cell alive, then `placeFace` each `Face` on the board. **Marks are ignored.** Because wrong faces are never placed (§4), every face on the board is a true solution cell, so candidates derived from faces are always sound.
- `placeFace(p, cand, cell)` returns a new `Candidates` with: the cell placed, and every other cell in its row, column, and region, plus its ≤8 neighbors, eliminated. This is the **basic propagation** (the "Easy" tier's elimination rule).
- `eliminate(p, cand, cells)` clears `alive` for the given cells and updates counters.
- `contradiction(cand)`: true if some unsatisfied unit has `aliveCount == 0`. Used by lookahead.
- Candidate sets are cloned per lookahead branch (N² + 3N bytes; trivial).

## 6. Techniques (techniques.ts)

A technique is a pure function that finds the **first** deduction it can make, or `null`:

```ts
interface Deduction {
  technique: TechniqueId;
  tier: Tier;
  place?: number;                 // a cell that must hold a face, or
  eliminate: number[];            // cells that cannot hold a face (non-empty if no place)
  because: {                      // what the UI highlights and the hint text cites
    units: UnitRef[];             // e.g. [{kind:'region', id: 3}, {kind:'row', id: 4}]
    cells: number[];              // the specific cells that force the conclusion
  };
}

type Technique = (p: Puzzle, c: Candidates) => Deduction | null;

const TECHNIQUES: { id: TechniqueId; tier: Tier; run: Technique }[];  // ordered simplest → hardest
```

Returning one deduction at a time (not all of them) is deliberate: the solver restarts from the simplest technique after each step, which is what makes the tier rating the *minimum* hardest technique (see §7).

The ladder, with the algorithm for each:

| # | Id | Tier | Rule | Algorithm |
|---|---|---|---|---|
| 1 | `single-candidate` | easy | An unsatisfied unit (row, col, or region) with exactly one alive cell must hold its face there. | Scan units; `aliveCount == 1` → find the alive cell. O(N²). |
| 2 | `region-in-line` | medium | If every alive cell of a region lies in one row (or col), that line's face is in the region, so eliminate the line's alive cells outside the region. | For each unsatisfied region, compute bitmasks of rows and cols it touches; if one bit is set, eliminate the rest of that line. |
| 3 | `line-in-region` | medium | Converse: if every alive cell of a row/col lies in one region, eliminate that region's alive cells outside the line. | Same, by line. |
| 4 | `adjacency-pressure` | hard | If placing a face at X would remove all alive cells from some unsatisfied unit, X is impossible. Common case: all alive cells of a region/line are neighbors of X. | For each alive cell X: check each unsatisfied unit's alive cells ⊆ neighbors(X) ∪ same-line-as-X ∪ same-region-as-X (i.e. no candidate would survive). Computed with bitmask intersections, not by cloning. O(N² · 3N). |
| 5 | `subset-regions-lines` | hard | M regions whose alive cells all lie within M lines (rows, or cols) own those lines: eliminate every other alive cell in those lines. | For rows: per-region row bitmask; enumerate region subsets of size M = 2..⌊N/2⌋ (≤ C(11,5)=462 per size); if `popcount(OR of masks) == M`, eliminate the lines' alive cells that belong to other regions. Same for cols. |
| 6 | `subset-lines-regions` | hard | Converse: M lines whose alive cells lie in M regions own those regions. | Enumerate line subsets; if the OR of per-line region masks has M bits, eliminate those regions' alive cells outside the lines. |
| 7 | `lookahead` | expert | Assume a face at X; propagate with techniques 1–6 (depth 1, no nested lookahead); if a contradiction appears, X is impossible. | For each alive cell: clone candidates, `placeFace`, run techniques 1–6 to fixpoint, check `contradiction`. First contradiction → eliminate X. O(N² · propagation). |

Notes:
- Subsets are capped at M ≤ ⌊N/2⌋ because an M-subset deduction and its (N−M)-complement are the same fact seen from the other side.
- Each unit's "alive cells" are read from `Candidates`, never from the board, so techniques compose after eliminations.
- `Deduction.because` is the only thing UI/hint text needs. Hint copy is a template per `TechniqueId` filled from `because` ("Region *green* only fits in *row 4*, so the rest of row 4 is out").
- **Tier of `adjacency-pressure`:** `DESIGN.md` §4.1 does not list this technique. It is a one-step contradiction check, harder than line confinement but easier than general lookahead, so it is placed in Hard. §4.1 should be updated to include it. The `TECHNIQUES` array is the single source of truth for tier assignment.

## 7. Solving (solver.ts)

Two independent solvers, with different jobs.

### 7.1 `solveByTechniques(p, board?)` — the human-style solver

```ts
interface SolveTrace {
  solved: boolean;
  steps: Deduction[];          // in order
  hardest: Tier | null;        // max tier over steps
}
```

Loop: `cand = fromBoard(p, board ?? empty)`; repeatedly try techniques in ladder order, apply the first deduction found (placing, or eliminating), then restart from technique 1. Stop when every unit is satisfied (`solved`) or no technique makes progress (`!solved`). Because it always prefers the simplest applicable technique, `hardest` is the lowest tier at which the puzzle is solvable by this ladder.

### 7.2 `solve` and `countSolutions` — the backtracking solver

```ts
function solve(p: Puzzle, board?: Board): number[] | null;   // solution[r] = column in row r
function countSolutions(p: Puzzle, limit = 2, board?: Board): number;
```

`solve` returns the first complete placement found, in the same column-per-row shape as `Level.solution`, or `null` if none exists (an expected outcome, not an error, so it never throws). It is the independent check that a level's stored `solution` is reachable from the rules alone, and it is what `validateLevel`-style tooling and the solver/rules agreement tests call. `countSolutions` and `solve` share one backtracking routine; `solve` stops at the first solution (`limit = 1`) and returns it.

Plain backtracking, independent of the ladder, optimized for speed:
- Place one face per row, top to bottom.
- State: `usedCols` and `usedRegions` as 16-bit masks (N ≤ 11 fits), plus the previous row's column for the adjacency rule (`|c − prevC| ≥ 2`).
- A face in row r is allowed in column c iff the column and region are unused and `|c − prevC| ≥ 2`.
- Prefilled faces from `board` seed the masks and fix their rows.
- Returns as soon as `limit` solutions are found, so uniqueness checking (`limit = 2`) is cheap on both the unique and non-unique cases.

Why two solvers: the backtracker proves uniqueness and finds the solution; the technique solver measures how a human would solve it. A puzzle can be unique yet unrated (needs more than the ladder), which is a legitimate reason to reject it.

## 8. Difficulty (difficulty.ts) and hints (hints.ts)

```ts
function rate(p: Puzzle): Tier | 'unrated';
```
`trace = solveByTechniques(p)`; `trace.solved ? trace.hardest : 'unrated'`. The generator rejects `unrated` puzzles.

```ts
interface Hint {
  deduction: Deduction;        // technique, target cell(s), because
  message: string;             // rendered from the template
}
function nextHint(p: Puzzle, board: Board): Hint | null;
```
`nextHint` builds candidates from the player's faces (ignoring marks), runs the ladder, and returns the first deduction. If its result is only eliminations, the UI highlights those cells and explains why; a placement deduction highlights the cell. `null` means the board is complete or the ladder cannot progress (possible only on a corrupted or unrated puzzle).

## 9. Generator (generator.ts, seed.ts)

```ts
interface GenerateOptions {
  size: number;
  tier: Tier;
  seed: string;
  maxAttempts?: number;                   // default 2000
  signal?: AbortSignal;
}
function generate(o: GenerateOptions): Level | null;
```

Pipeline for each attempt (all randomness from `Rng` seeded by `hashSeed(seed + attempt)`):

1. **Solution:** build a random valid placement row by row: random column order each row, skipping used columns and columns within 1 of the previous row's column; backtrack on dead end. Result is `solution[]` (one per row/col, non-adjacent).
2. **Regions:** seed region `i` at the solution cell in row `i` (so each region contains exactly one solution cell). Then grow: repeatedly pick a random unassigned cell that touches an assigned cell and give it a random adjacent region (weighted toward smaller regions to avoid one giant region). This yields connected regions by construction.
3. **Uniqueness repair:** `countSolutions(limit = 2)`. If 1, go on. If ≥ 2, take the second solution found and *mutate*: move a boundary cell (not a solution cell) from one region to an adjacent region such that (a) the source region stays connected, (b) the alternative solution becomes invalid. Re-check. Cap at ~50 mutations per attempt; then discard and restart.
4. **Shape filter:** reject if any region has fewer than `minRegionSize` cells (default 2; a one-cell region is a free give-away) or the size spread is extreme (largest region > ~35% of the grid).
5. **Rate:** `rate(p)` must equal the requested `tier`. Else mutate for difficulty within the same cap (merging a cell into a bigger region tends to increase difficulty; splitting off tends to decrease it), or discard.
6. **Output:** `Level { …, tier, seed }` after `validateLevel`.

Returns `null` after `maxAttempts` (the caller treats this as "combination not available" and hides it from level select). The same `generate` call with the same options always returns the same level.

`seed.ts`: `mulberry32` PRNG behind a small `Rng` interface (`next()`, `int(n)`, `shuffle(arr)`), and `hashSeed(string) → uint32` (xmur3 or FNV-1a).

**Execution:** `tools/generate-levels.ts` calls `generate` offline to build bundled packs. The app can later call the same function from a Web Worker for on-device/daily puzzles; the engine has no worker-specific code, only an `AbortSignal` for cancellation.

## 10. Public API (index.ts)

Only these are exported to the store/UI: `Level`, `Board`, `Tier`, `Cell`, `Coord`, `compile`, `validateLevel`, `loadLevel`, `emptyBoard`, `setCell`, `judgeTap`, `findConflicts`, `isSolved`, `nextHint`, `rate`, `solve`, `countSolutions`, `generate`, `toIdx`, `toCoord`. Internals (`Candidates`, techniques, solvers) stay private to keep the surface small and refactorable.

## 11. Testing

| Kind | What |
|---|---|
| Soundness (property) | For many generated puzzles, run `solveByTechniques` and assert no `Deduction` eliminates a solution cell and every `place` is a solution cell. This is the most important test. |
| Uniqueness | `countSolutions(p, 2) === 1` for every generated and every fixture level; the backtracker's solution equals `level.solution`. |
| Solver agreement | When `solveByTechniques` solves, its placements equal `level.solution`. `solve(p)` equals `level.solution` for every unique level, and returns `null` for a fixture with no valid placement. |
| Determinism | `generate(o)` called twice (and across runs) returns deep-equal levels. |
| Golden fixtures | A handful of hand-written levels per tier with expected `rate()` and expected first-hint technique. Locks the ladder's behavior against regressions. |
| Technique unit tests | One small crafted board per technique showing exactly the deduction it should make (and that earlier techniques make none). |
| Rules | `judgeTap`, `findConflicts` on crafted boards covering each conflict kind; `isSolved` on partial, full, and wrong boards. |
| Validation | `validateLevel` rejects disconnected regions, wrong region counts, invalid solutions, out-of-range sizes. |
| Performance | Benchmarks in CI as soft thresholds: `rate` N=11 < 10 ms, `countSolutions` < 5 ms, `nextHint` < 10 ms. |

Tests need no Tauri or DOM; Vitest only.

## 12. Build order within milestone 1

1. `types`, `compile`, `board`, `rules` + tests, with 2–3 hand-written fixtures.
2. `seed`, `countSolutions` + uniqueness tests.
3. `candidates`, then techniques 1–3 and `solveByTechniques`, `rate` (Easy/Medium working end to end).
4. `hints` (cheap once the ladder exists).
5. Techniques 4–6 (Hard), with soundness property tests running throughout.
6. `generator` with Easy/Medium; extend as techniques land.
7. Technique 7 (lookahead) and Expert generation last; defer if Hard is already a satisfying top tier.

## 13. Open questions

1. **Generator success rates:** random region growth may rarely yield some size/tier pairs (e.g. 7×7 Expert, 11×11 Easy). We learn this empirically once the generator runs; the fallback is to hide those combinations (already in `DESIGN.md` §4.1).
2. **Minimum region size** and max region share (defaults above are guesses that affect puzzle feel).
3. **Expert definition:** depth-1 lookahead as written, or allow depth 2? Depth 2 is much slower and probably unnecessary at N ≤ 11.
4. **Pre-generated vs on-device generation:** v1 ships bundled packs; the Worker path is designed in but not required for v1.
