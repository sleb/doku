# Doku: Milestone 5 low-level design (generator)

Companion to `DESIGN.md` §4, §4.1, §10 and §12 for milestone 5 ("Generator + level packs + difficulty tiers"). It expands `docs/ENGINE_DESIGN.md` §9, which stays the short reference; if the two disagree, this document wins on the generator and `ENGINE_DESIGN.md` wins on the technique ladder (§6) and solvers (§7). Sync both when this lands.

**Status:** draft for review. Nothing here is implemented.

## 1. Goals and non-goals

**Goals**
- `generate()` produces a valid, connected, **uniquely solvable** `Level` of a requested size (7 to 11) and, once the ladder exists, a requested tier.
- Deterministic: the same options always give the same level, on any device or runtime (`ENGINE_DESIGN.md` §1).
- Fast enough that an offline tool can fill a campaign of a few hundred levels in minutes, including 11×11, which the naive `tools/seed-pack.ts` could not produce in 60 s.
- Measurable: the tool reports, per size and tier, how many candidates it needed, so the open question "which size/tier combinations to ship" (`DESIGN.md` §13) is answered with data.
- Replaces `tools/seed-pack.ts` and the hand-appended `pack-1.json` with `tools/generate-levels.ts` writing `src/levels/pack-*.json`.

**Non-goals**
- The technique ladder, `rate()` and ladder-driven hints. The generator depends on `rate` (§7) but its design is `ENGINE_DESIGN.md` §6 to §8.
- On-device or Worker generation, the daily puzzle (milestone 6). §3 keeps the door open (pure, seeded, abortable) without building it.
- Hand-authored levels, symmetric or "pretty" region shapes beyond the size limits in §5.4.
- A level select or any app change: the campaign still plays `LEVELS` in array order (`docs/APP_DESIGN.md` §3.1).

## 2. Approach in one paragraph

Pick a random valid placement (the solution). Grow one connected region around each face so every region holds exactly one solution cell. Count solutions; if there is more than one, **repair** by moving a cell of a rival solution into a neighbouring region, which provably breaks that rival (§5.3), until the level is unique or a repair budget runs out. Apply shape limits, then rate it. Rejection sampling over this pipeline is the whole algorithm: the cheap, high-rejection checks run first and the expensive `rate` last.

## 3. API

```ts
// src/engine/generator.ts
export interface GenerateOptions {
  size: number;                  // 7..11 (RangeError otherwise)
  seed: string;
  tier?: Tier;                   // omitted: any uniquely solvable level, no rating (§7)
  maxAttempts?: number;          // default 2000; the only budget, so results never depend on wall-clock
  shape?: Partial<ShapeLimits>;  // §5.4
  signal?: AbortSignal;          // checked once per attempt; abort returns null
}
export function generate(o: GenerateOptions): Level | null;

// One candidate, no tier filter. The tool uses this to bucket by tier (§8.2).
export function generateCandidate(size: number, rng: Rng, shape?: Partial<ShapeLimits>): Level | null;

// src/engine/seed.ts
export interface Rng {
  next(): number;                // [0, 1)
  int(n: number): number;        // [0, n)
  shuffle<T>(a: readonly T[]): T[];   // returns a copy
  pick<T>(a: readonly T[]): T;
}
export function makeRng(seed: string): Rng;   // mulberry32(hashSeed(seed))
export function hashSeed(s: string): number;  // FNV-1a 32-bit, then one avalanche pass
```

Rules:
- `generate` runs attempts `k = 0, 1, …` with `rng = makeRng(`${seed}#${k}`)` and returns the first attempt that passes every filter. The returned `Level.seed` is `${seed}#${k}`, so `generateCandidate(size, makeRng(level.seed))` reproduces it exactly. `null` after `maxAttempts` (caller treats the combination as unavailable) or on abort.
- `Level.id` is **not** set by the engine (`generate` returns `id: Level.seed`); the tool renames (§8).
- Determinism hazards, all banned in `src/engine`: `Math.random`, `Date`, iteration over a `Set`/`Map` whose insertion order depends on hash order (use arrays), float arithmetic beyond `Math.floor(rng.next() * n)`. `hashSeed` and mulberry32 use `Math.imul` and `>>> 0` only. `isolation.test.ts` gains a scan for `Math.random` and `Date` under `src/engine` (§10).
- `generate` never throws on a hard combination; it returns `null`. Only a bad `size` or option throws `RangeError`.

Engine additions elsewhere (small, in the same milestone):
- `solver.ts`: `solutions(level, limit): number[][]` (copies of up to `limit` placements), a third thin wrapper over the existing private `search`. The repair step needs the rival solution, which `countSolutions` discards.
- `index.ts`: export `generate`, `makeRng`, `solutions` (the tool and tests need them; `Rng` and `ShapeLimits` as types). `generateCandidate` stays internal to the engine and the tool imports it from `src/engine/generator` directly (tools may reach inside; the app may not).

## 4. Module layout

```
engine/
  seed.ts        makeRng(), hashSeed()                 (new)
  solver.ts      + solutions()
  generator.ts   generate(), generateCandidate(), and the private steps below
tools/
  generate-levels.ts   CLI over generate*/rate; writes packs   (new; deletes seed-pack.ts)
  curriculum.ts        the ordered { size, tier, count } list   (new)
```

Private to `generator.ts`, each a small pure function so each gets its own test:

```ts
randomSolution(n, rng): number[]
growRegions(n, solution, rng, shape): number[][]
repairUniqueness(level, rng, maxMoves): Level | null
passesShape(regions, shape): boolean
```

Dependency direction: `seed ← generator`, `solver ← generator`, `difficulty ← generator` (only once `rate` exists). Nothing imports the generator except `index.ts` and `tools/`.

## 5. Pipeline for one candidate

All steps use the one `Rng` of the attempt, in a fixed call order, so changing any step's draw count changes every later result. That is fine pre-MVP (golden levels in tests are regenerated when the algorithm changes), but a step must never draw a data-dependent number of values from an `Rng` it shares with an earlier step's retry (see 5.1).

### 5.1 Solution: `randomSolution(n, rng)`

Row-by-row backtracking: for row `r`, try columns in `rng.shuffle([0..n-1])` order, skipping used columns and columns with `|c − prev| < 2`; on a dead end, backtrack. For `n ≥ 4` a solution always exists; for `n = 7..11` dead ends are shallow, so a single recursive pass with no restarts terminates in microseconds. The distribution is not uniform over all placements (early rows are favoured), which does not matter for puzzle quality; if it shows up as visibly biased packs, shuffle rows' roles by transposing or mirroring the finished grid at random (3 extra `rng.next()` draws, no other change).

### 5.2 Regions: `growRegions(n, solution, rng, shape)`

1. `owner[cell] = -1` everywhere; for each row `r`, `owner[r*n + solution[r]] = r`. Region `r` therefore contains exactly one solution cell, the invariant uniqueness repair relies on.
2. Maintain `size[region]` and, per region, its list of **free frontier cells** (unowned, 4-adjacent to the region). Draw a target size per region up front: a random composition of `n*n` into `n` parts, first drawing the number of one-cell regions `k` uniformly from `[0, shape.maxSingletons]` (§5.4), then giving the other `n − k` regions sizes in `[shape.minRegion, shape.maxRegion]` (`minRegion` is 2 for them), via random cuts then clamp-and-redistribute. Targets give the shape some variety (a region of 2 next to a region of 20) instead of the tight, similar sizes pure frontier growth produces.
3. Repeat `n*n - n` times: choose region `i` among those with `size < target` and a non-empty frontier with probability proportional to `target[i] − size[i]`; if none qualifies (targets met, or frontiers blocked), fall back to any region with a non-empty frontier, uniformly. Take a uniformly random cell from region `i`'s frontier, assign it, then update frontiers of all regions (a cell newly owned leaves every frontier; its unowned 4-neighbours join region `i`'s). 
4. Connectivity holds by construction (a cell is only ever added next to its region). Every unowned cell is eventually reachable because the grid is connected and every region starts non-empty, so the loop cannot dead-end; assert in dev builds.

Cost O(n⁴) worst case for frontier bookkeeping with naive arrays (n = 11: ~15k operations). Negligible next to `countSolutions`.

### 5.3 Uniqueness: `repairUniqueness(level, rng, maxMoves)`

```
for move in 0..maxMoves:
  found = solutions(level, 2)
  if found.length == 1: return level            // unique
  rival = the placement in `found` that != level.solution   // at least one differs
  candidates = []
  for each row r where rival[r] != level.solution[r]:
    x = r*n + rival[r]                            // a rival face, never a solution cell
    A = regions[x]
    for each region B != A that owns a 4-neighbour of x:
      if A stays 4-connected without x: candidates.push({x, B})
  if candidates is empty: return null
  apply rng.pick(candidates): regions[x] = B
return null
```

Why it works: the rival has one face in every region, including `A` (at `x`) and `B` (at some cell `y ≠ x`). After moving `x` to `B`, the rival has no face in `A` and two in `B`, so it is no longer a solution. The moved cell is never in `level.solution`, so the intended solution stays valid (each region keeps its solution cell, and `A` keeps its own as `x ∉ S`). `A` stays connected by the BFS check (n² cells, trivial). The move can create **new** rival solutions elsewhere, hence the loop; in practice each move removes the rival it targeted and the count of rivals shrinks on average, which §9 measures rather than assumes.

Notes:
- Region sizes shift by one per move; `passesShape` runs after repair, not inside it.
- `maxMoves` default 60, an option on `GenerateOptions.shape`-adjacent tuning only if measurements demand it (not exposed initially).
- The loop is deterministic given `rng`; there is no wall-clock cutoff.
- Cost: each iteration is one `solutions(level, 2)`. The existing backtracker prunes on column and region masks and the adjacency rule, and returns after two finds, so non-unique cases are quick; the unique case explores the whole tree, which is the expensive call and happens once per attempt that survives.

### 5.4 Shape filter: `passesShape(regions, shape)`

```ts
interface ShapeLimits {
  minRegion: number;      // default 2, applies to every region beyond the allowed singletons
  maxSingletons: number;  // one-cell regions allowed: default 1 for n <= 8, 2 for n >= 9
  maxRegion: number;   // default ceil(0.35 * n * n)
}
```

`passesShape` counts regions of size 1 (at most `maxSingletons`) and requires every other region to be within `[minRegion, maxRegion]`. A singleton's face is forced from the first glance, so it also seeds the Easy tier's opening move; the cap keeps it from becoming a give-away. Repair never creates a singleton by moving a cell out of a 2-cell region without the filter noticing, because the filter runs after repair. A level that fails is discarded, not repaired. The defaults are guesses (open question 2) and are tuned from the §9 statistics and by playing. `growRegions` already aims inside these bounds, so the filter mostly catches repair drift.

## 6. Why rejection sampling is enough here

The previous script's failure at 11×11 came from growing regions with **no steering** toward uniqueness and then hoping. The pipeline above changes that in two ways: targets keep regions from collapsing into obvious shapes, and repair converts most non-unique draws into unique ones rather than discarding them. Whether that is enough at 11×11 is an empirical claim, so milestone 5's first story ends with a measured acceptance rate (§9), and the fallback is in §7.3.

## 7. Difficulty

### 7.1 Contract

`rate(level: Level): Tier | 'unrated'` (`ENGINE_DESIGN.md` §8; public signature in `DESIGN.md` §4 takes a `Level`; compiling to a `Puzzle` happens inside). The generator treats it as a black box: accept iff `rate(level) === o.tier`. `unrated` is always rejected. If `tier` is omitted, `rate` is not called at all.

### 7.2 Staging

The generator is useful before the ladder exists, so the stories land in this order (§11): untiered generator and packs first, tiers as techniques land. In particular **Easy and Medium come first**; Expert (lookahead) last, and if Hard is a satisfying top tier the Expert tier is dropped from the curriculum rather than forced.

### 7.3 Steering (only if measurements require it)

Rejection sampling on tier may be too wasteful for some cells of the size×tier table (the sketch's examples: 7×7 Expert, 11×11 Easy). If the §9 report shows a combination we want but cannot fill within `maxAttempts`, add one **local search** stage after uniqueness:

- Score = a distance from the target tier computed from the technique trace (`SolveTrace.steps`): e.g. for a target above the current tier, the negative count of steps at the current hardest tier; for a target below, the count of steps above the target.
- Move = the same boundary-cell move as §5.3 (non-solution cell, stays connected, adjacent region), accepted iff the level is still unique and the score improves; at most ~30 moves, then discard.
- It needs the trace, not just the tier, so `difficulty.ts` would export `rateWithTrace(level)` for the generator only.

Do not build this speculatively. Combinations the generator cannot fill are dropped from the curriculum (`DESIGN.md` §4.1 already says so).

## 8. Offline tool: `tools/generate-levels.ts`

Bun script, node-side only (may use `fs`, `Date`, `process.argv`).

### 8.1 Curriculum

`tools/curriculum.ts` exports the ordered list that defines the campaign:

```ts
export const CURRICULUM: { size: number; tier: Tier; count: number }[] = [
  { size: 7, tier: "easy", count: 8 },
  { size: 8, tier: "easy", count: 6 },
  // ...ramping up to size 11, tier hard/expert...
];
```

Campaign order is array order (`APP_DESIGN.md` §3.1) so this list **is** the difficulty curve. The initial values are a guess: after the first stats run (§9), fill in only the cells the generator can produce.

### 8.2 Behaviour

```
bun tools/generate-levels.ts [--pack N] [--stats] [--only size:tier] [--max-attempts K]
```

- For each curriculum row, call `generate({ size, tier, seed: `${packName}/${size}/${tier}/${i}` })` for `i = 0, 1, …` until `count` levels are collected, skipping duplicates (§8.3). A `null` result for a row is reported and fails the run (exit code 1) unless `--only` was used, so a bad curriculum cannot silently ship a short pack.
- Ids: `${tier}-${size}-${i + 1}` zero-padded (`easy-07-003`). Unique across packs because the tier/size/index triple is unique per curriculum row; the tool refuses to write a duplicate id.
- Output: `src/levels/pack-N.json` as `{ "levels": [...] }`, 2-space JSON, with `tier` and `seed` set. Output is byte-for-byte reproducible, so a re-run is a no-op diff.
- Every written level is re-verified with `validateLevel`, `countSolutions === 1`, `solve` equal to `solution` and `rate === tier`. Verification failing is a bug and aborts the run.
- `--stats`: no files written. For each size×tier prints attempts to first success (median/p90 over a fixed 20 seeds), the fraction of attempts rejected by each filter (not unique after repair, shape, wrong tier, unrated) and wall time. This table is the input to the open question on shippable combinations and to tuning §5.4.
- Wall-clock limits live only here, via an `AbortSignal.timeout` per level (default 60 s). A timeout reports "unavailable" for that level; it never changes the content of levels that do generate.

### 8.3 De-duplication

Two seeds can yield the same board. Within a run the tool keeps a set of **canonical forms**: for each of the 8 grid symmetries, relabel regions by first appearance in row-major order, join the grid to a string; the canonical form is the lexicographically smallest. A level whose form was seen is skipped (next `i`). The check lives in the tool, not the engine, because it only matters across a pack.

### 8.4 Replacing the seed pack

Pre-MVP, so no migration (CLAUDE.md): delete `tools/seed-pack.ts`; the generated `pack-1.json` replaces the hand-built one outright (the hand-built `demo-7` and `demo-11` go with it). Anything that names a seed id (`demo-7`, `seed-3`, in e2e specs, tests or docs) is updated to read the id from `LEVELS` instead of hard-coding it. Saved progress is an index clamped by `parseProgress`; a stranger's old save lands on a different level, which is acceptable now. `tools/` stays out of the app bundle.

## 9. Testing

Engine tests run under Vitest with small sizes and attempt budgets so `bun run test:engine` stays quick; the heavy sweeps live in the tool's `--stats`, not CI.

| Kind | What |
|---|---|
| Rng | `makeRng(s)` yields the same first 1000 values on repeat; different seeds differ; `int(n)` stays in `[0, n)`; `shuffle` is a permutation and returns a copy. A frozen vector of the first 5 values for seed `"doku"` pins the algorithm across runtimes. |
| `randomSolution` | For every `n` in 7..11 and 200 seeds: a permutation, no two consecutive rows within one column. |
| `passesShape` | Accepts exactly `maxSingletons` one-cell regions and rejects one more; rejects a 0-size or over-`maxRegion` region; default `maxSingletons` is 1 at n=7,8 and 2 at n=9..11. |
| `growRegions` | For every `n` and 100 seeds: `validateLevel` finds no `region-count` or `region-connected` issue; each region holds exactly one solution cell; sizes within `shape` or the documented fallback. |
| `repairUniqueness` | On `multiSolutionLevel7` (fixture, `src/engine/__fixtures__/levels.ts`): returns a level with `countSolutions === 1`, `solution` unchanged, no solution cell moved. Every intermediate move keeps all regions connected (checked by wrapping `rng.pick`). Returns `null` when `maxMoves = 0` on a non-unique level. |
| Uniqueness (property) | For each `n` in 7..11 and 25 seeds, `generate({ size, seed })` (no tier) returns a level with `countSolutions === 1`, `solve(level)` equal to `level.solution`, and no `validateLevel` issue. A `null` fails the test (it would mean the pipeline is not usable at that size). |
| Determinism | `generate(o)` twice gives deep-equal levels; `generateCandidate(size, makeRng(level.seed))` reproduces `level`. A golden `generate({ size: 7, seed: "golden" })` snapshot guards unintended pipeline changes (update it deliberately). |
| Budget and abort | `maxAttempts: 1` on a seed known to need more returns `null`; a pre-aborted signal returns `null` without work; bad `size` throws `RangeError`. |
| Tier | Once `rate` exists: `rate(generate({ tier }))` equals `tier` for every tier the curriculum uses, 10 seeds each. |
| Isolation | `isolation.test.ts` additionally fails if any file under `src/engine` contains `Math.random` or `Date.` (the generator's determinism promise). |
| Immutability | `immutability.test.ts` is extended with `solutions` (and `generate`'s output not aliasing its inputs). Per its own rule, every new engine function is added. |
| Tool | `tools/generate-levels.test.ts` (Vitest, node): canonical form is symmetric under all 8 transforms; a run of a two-row mini curriculum is byte-identical on repeat; a duplicate id or unfillable row exits non-zero. |
| Packs (existing) | The pack tests from `APP_DESIGN.md` §3.1 (valid, unique solution, size 7 to 11, unique ids) now also check `tier` is set and `rate(level) === level.tier`. |

## 10. Risks and measurements

1. **Repair may not converge at 11×11.** Measure rivals per attempt before and after each move. If convergence is poor, alternatives in order of cost: (a) move a *pair* of cells; (b) restart growth from a different `shape`; (c) choose which rival to break by the one that touches most regions. Do not pre-build these.
2. **Per-attempt cost.** If `countSolutions` on large unique levels dominates, add a node counter to `search` and abandon an attempt past a budget (deterministic, unlike a timer).
3. **Variety.** Uniform frontier growth makes blobby regions. Pack quality is judged by looking at them and playing, not by a metric; the shape defaults are the only knob in v1.
4. **Hard to fill cells.** Expected: 7×7 Expert and 11×11 Easy (§7.3). The curriculum, not the code, adapts.

## 11. Suggested issue breakdown (milestone "generator")

Titled `M5-NN`, each strictly TDD (CLAUDE.md), each plannable with `/doku-plan`.

| # | Story | Delivers |
|---|---|---|
| 01 | Seeded randomness | `seed.ts` and its tests |
| 02 | Generate a uniquely solvable level | `solutions()`, `randomSolution`, `growRegions`, `repairUniqueness`, `passesShape`, untiered `generate`; property and determinism tests; exports |
| 03 | Pack tool | `generate-levels.ts`, `curriculum.ts` (untiered rows first), de-dup, verification, `--stats`; replaces seed pack and `seed-pack.ts` (§8.4) |
| 04 | Technique ladder, Easy and Medium, `rate` | per `ENGINE_DESIGN.md` §6 to §8 (own LLD section or plan) |
| 05 | Tiered generation | `GenerateOptions.tier` wired to `rate`; tier tests; curriculum gets tiers |
| 06 | Hard techniques and ladder hints | `ENGINE_DESIGN.md` §6 rows 4 to 6; hints replace the stub |
| 07 | Expert (lookahead) or drop it | decided from `--stats` |
| 08 | Docs sync | `DESIGN.md` §4, §4.1, §10, §12, §13; `ENGINE_DESIGN.md` §9; `APP_DESIGN.md` §3.1, §11 |

Stories 01 to 03 deliver value on their own (a real, varied, all-sizes pack) before any technique exists, which also retires the 11×11 gap.

## 12. Open questions

1. **Shippable size×tier table:** answered by story 03's `--stats` output; update `curriculum.ts` and `DESIGN.md` §13.
2. **Shape defaults** (`minRegion = 2`, `maxSingletons` 1 for 7 to 8 and 2 for 9 to 11, `maxRegion = 35%`): guesses; tune by playing generated packs.
3. **Curve design:** the order of the curriculum (all Easy first, or interleaving sizes and tiers for variety) is a game-design decision made once real levels exist.
4. **Seed string format for the daily puzzle** (milestone 6): date-derived, e.g. `daily/2026-11-04`; nothing in this design blocks it.
5. **Retire `Level.seed`?** Kept for reproduction and debugging; it grows the pack JSON slightly. Revisit if pack size matters.
