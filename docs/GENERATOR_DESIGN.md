# Doku: Milestone 5 low-level design (generator)

Companion to `DESIGN.md` §4, §4.1, §10 and §12 for milestone 5 ("Generator + level packs + difficulty tiers"). It expands `docs/ENGINE_DESIGN.md` §9, which stays the short reference; if the two disagree, this document wins on the generator and `ENGINE_DESIGN.md` wins on the technique ladder (§6) and solvers (§7). `DESIGN.md` and `ENGINE_DESIGN.md` were synced in M5-08.

**Status:** implemented (M5-01 to M5-07); docs synced in M5-08. §13 to §18 record what differs from the design text above, and where they disagree they win.

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
  tier?: Tier;                   // omitted: any uniquely solvable level, no rating (§7); set: rate(level) === tier and Level.tier is set
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

The generator is useful before the ladder exists, so the stories land in this order (§11): untiered generator and packs first, tiers as techniques land. In particular **Easy and Medium come first**; Expert (lookahead) last, with the option to drop it if Hard were a satisfying top tier. M5-07 measured it and shipped Expert (§18).

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
export const CURRICULUM: CurriculumRow[] = [
  { pack: 1, size: 7, tier: "easy", count: 8 },
  { pack: 1, size: 8, tier: "easy", count: 6 },
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

### 8.4 Replacing the seed pack (done in M5-03)

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
4. **Hard to fill cells.** Expected: 7×7 Expert and 11×11 Easy (§7.3). Measured: only Easy 11×11 fails (§16); every Expert cell fills (§18). The curriculum, not the code, adapts.

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
| 07 | Expert (lookahead) or drop it | decided from `--stats`: shipped (§18) |
| 08 | Docs sync (done) | `DESIGN.md` §4, §4.1, §10, §12, §13; `ENGINE_DESIGN.md` §9; `APP_DESIGN.md` §3.1, §11 |

Stories 01 to 03 deliver value on their own (a real, varied, all-sizes pack) before any technique exists, which also retires the 11×11 gap.

## 12. Open questions

1. **Shippable size×tier table:** answered for Easy and Medium by M5-05 (§16) for Hard by M5-06 (§17: all five sizes fill) and for Expert by M5-07 (§18: all five sizes fill, three levels per size shipped). Decided; recorded in `DESIGN.md` §13 item 19.
2. **Shape defaults** (`minRegion = 2`, `maxSingletons` 1 for 7 to 8 and 2 for 9 to 11, `maxRegion = 35%`): guesses; tune by playing generated packs.
3. **Curve design:** M5-05 ships all Easy first (sizes 7 to 10), then Medium (7 to 11) (§16). Whether to interleave sizes and tiers for variety stays a game-design decision to revisit after playing it.
4. **Seed string format for the daily puzzle** (milestone 6): date-derived, e.g. `daily/2026-11-04`; nothing in this design blocks it.
5. **Retire `Level.seed`?** Kept for reproduction and debugging; it grows the pack JSON slightly. Revisit if pack size matters. Decision (M5-08): kept; the 109-level pack is small enough that it does not matter yet.

## 13. As built in M5-02

Deviations and measurements from the first implementation (`src/engine/generator.ts`).

- **API.** `generate` takes no `tier` yet (arrives with `rate`). `generateCandidate` returns a level with `id: ""` and no `seed`; `generate` sets `id = seed = "${seed}#${k}"`. `index.ts` exports `generate`, `solutions` and the types `GenerateOptions`, `ShapeLimits`; the other steps are exported from `generator.ts` for tests only. A non-integer or out-of-range `size` throws `RangeError` before any work; an aborted signal returns `null`.
- **Repair looks at 8 rivals, not 1** (`RIVALS`). With one rival, all its differing faces can sit mid-region (cut vertices), leaving no legal move and a dead end; examining 8 rivals per move widens the candidate set. Candidates are deduplicated `(cell, to)` pairs; the pick is still uniform. `maxMoves` is 60 (internal). On the pathological `multiSolutionLevel7` fixture (row regions, 646 placements) only about 1 seed in 75 converges within 60 moves, so its test uses a scanned seed; real candidates converge far more often (below).
- **Region size targets** are the simple version: `k` singletons (`k` uniform in `[0, maxSingletons]`), every other region starts at `minRegion`, and the spare cells are handed out one at a time to a random region still below `maxRegion`. Growth then picks a region weighted by its remaining target, falling back to any region with a frontier.
- **Shape defaults** unchanged (`minRegion` 2, `maxSingletons` 1 for n <= 8 and 2 for n >= 9, `maxRegion` = ceil(0.35 n^2)). `growRegions` meets them in at least 90% of draws (tested).
- **Measured** with `generate({ size, seed: "p0".."p24" })`, `maxAttempts` 2000 (attempts to first success; acceptance = successes / attempts overall):

| size | median attempts | p90 | max | acceptance | ms per level |
|---|---|---|---|---|---|
| 7 | 2 | 6 | 11 | 35% | 1 |
| 8 | 3 | 9 | 14 | 23% | 3 |
| 9 | 5 | 17 | 21 | 16% | 10 |
| 10 | 6 | 24 | 32 | 11% | 62 |
| 11 | 10 | 24 | 63 | 7.6% | 450 |

  Repair converges well enough at 11x11 that the §10 fallbacks were not needed. The cost at 11x11 is the full-tree `solutions` call on surviving candidates; the property test (25 seeds x 5 sizes) takes about 12 s, mostly size 11, and has a 60 s timeout.

## 14. As built in M5-03

Deviations from §8 and measurements from the first pack tool (`tools/generate-levels.ts`, `tools/pack.ts`, `tools/curriculum.ts`).

- **Split.** `pack.ts` holds the pure logic (`canonicalForm`, `levelId`, `rowStartIndexes`, `collectRow`, `verifyLevel`, `buildPack`, `computeStats`, `formatStats`) and is unit tested (`tools/pack.test.ts`, vitest `node` project, 7x7 only); `generate-levels.ts` is the thin CLI (argv, `fs`, exit codes, `AbortSignal.timeout`). The generator gained `tryCandidate`, which reports why a candidate was rejected (`repair` or `shape`); `generateCandidate` is a wrapper, so draw order and the golden snapshot are unchanged.
- **Curriculum.** `CurriculumRow = { pack, size, tier?, count }`. Seeds are `pack-N/<size>/<tier|any>/<i>`; a duplicate board consumes a seed. Ids are `<tier|any>-<size 2 digits>-<index 3 digits>`, 1-based, numbered per (tier, size) over the whole curriculum so they stay unique across packs; the tool also refuses to write on a collision with another pack's file. A row that needs more than 50 seeds per wanted level gives up and is reported.
- **Serialization.** 2-space JSON with number arrays on one line, which is what Biome emits, so `biome check` accepts a generated pack unchanged.
- **CLI.** `--pack N` (default 1), `--stats`, `--only size[:tier]`, `--max-attempts K`, `--timeout SECONDS` (default 60 per level). `--only` builds just those rows but ids still come from the full curriculum; it **writes nothing** (a partial pack must not overwrite the real one). An unfilled row exits 1. `rate === tier` verification landed with #91 (§16).
- **Dedup** reaches back only to lower-numbered packs; ids are checked against every other pack.
- **Pack 1 (as of M5-03; replaced in M5-05, see §16).** 42 untiered levels: 8 each at 7 to 10, then 10 at 11x11, in size order (the curve is simply "bigger is later" until tiers exist). Regenerating takes about 7 s and is byte-identical.
- **`--stats`** (20 seeds per size, attempts to first success):

| size | median | p90 | repair rejects | shape rejects | ms per level |
|---|---|---|---|---|---|
| 7 | 3 | 9 | 76% | 2% | 2 |
| 8 | 3 | 8 | 73% | 4% | 3 |
| 9 | 2 | 9 | 71% | 0% | 6 |
| 10 | 5 | 15 | 86% | 0% | 46 |
| 11 | 9 | 39 | 94% | 1% | 590 |

  Shape rarely rejects; failed repair is the dominant filter, as §6 expected. The "wrong tier" and "unrated" columns of §8.2 arrive with `rate`.

## 15. As built in M5-04

The ladder for Easy and Medium (`compile.ts`, `candidates.ts`, `techniques.ts`, `solveByTechniques` in `solver.ts`, `difficulty.ts`).

- **API.** `rate(level: Level): Tier | 'unrated'` is exported from `index.ts`; `solveByTechniques(level, board?)` returns `{ solved, steps, hardest }` and stays internal, as do `Candidates` and `TECHNIQUES`. `compile` is minimal (`n`, `regionOf`, 3N units). `generate` gained `tier` in M5-05 (§16).
- **Rating.** The solver always takes the first deduction of the simplest applicable technique and restarts from technique 1, so the tier is the minimum hardest tier. A level the ladder cannot finish is `unrated`; until Hard landed (M5-06, §17) that was most generated levels, and with Hard it is 5 to 10%.
- **Soundness** is a property test over 100 generated levels (n 7 to 11, 20 seeds each): no elimination removes a solution cell and every placement is a solution cell. A throwaway mutation (region-in-line eliminating the whole line, region cells included) makes it fail.
- **Measured tier shares** of untiered `generate` output (`seed` = `measure/<n>/<i>`; 100 levels per size, 40 at 11):

| size | easy | medium | unrated |
|---|---|---|---|
| 7 | 3% | 16% | 81% |
| 8 | 5% | 16% | 79% |
| 9 | 6% | 23% | 71% |
| 10 | 3% | 18% | 79% |
| 11 | 2.5% (1 of 40) | 7.5% (3 of 40) | 90% |

  Easy levels are rare and the unrated share is large, so Hard techniques (#92) are needed before the curriculum can fill every size by tier, and an Easy 11x11 may be dropped as `DESIGN.md` §4.1 anticipates.
- **Cost.** A full `rate` of a solved 11x11 level has a median of about 0.04 ms (max under 1 ms in 100 runs); stuck levels are cheaper still. The budget is 10 ms, so tier filtering adds nothing noticeable to generation, whose cost is dominated by uniqueness repair (§13).

## 16. As built in M5-05

Tiered generation and the tiered campaign.

- **Filter.** `generate({ size, tier, seed })` runs the same attempts `${seed}#k` as before; after a candidate survives uniqueness and shape it is rated, and kept only if `rate(candidate) === tier`. The returned level has `tier` set and `unrated` is never returned. With `tier` omitted `rate` is never called (tested with a spy), so untiered output and the golden snapshot are unchanged. `maxAttempts` stays 2000; `expert` exhausted it and returned `null` until M5-07 (`hard` fills since M5-06, §17; `expert` since §18).
- **`tryCandidate(size, rng, shape?, tier?)`** adds the reject reasons `tier` and `unrated`; `generate` and `--stats` share it.
- **Pack tool.** `GenerateFn` takes `tier`; `collectRow` passes `row.tier`; `verifyLevel` additionally fails when `level.tier` is set and `rate(level) !== level.tier`. `computeStats(size, tier?, seeds = 20)` measures every size x {untiered, easy, medium} cell; `--stats` prints them. A seed that needs more than 2000 attempts or 60 s counts as not filled.
- **Fill criterion.** A cell ships if at least 18 of the 20 stats seeds fill within 2000 attempts and 60 s each. Counts are chosen within what the cell can produce; the real regeneration run is the final check.
- **Steering (§7.3) not built.** The only cell we wanted that failed the criterion is Easy 11x11, which `DESIGN.md` §4.1 already allows to drop, and dropping it leaves the curve intact (Medium 11x11 fills). Local search would be built only if a wanted cell failed and dropping it hurt the curve. No `rateWithTrace` export.
- **`--stats`** (20 seeds per cell, attempts to first success among filled seeds; ms/level is wall time over filled seeds):

```
size  tier    filled  median   p90  repair-rej  shape-rej  tier-rej  unrated-rej  ms/level
   7  any      20/20       1      6         57%         2%        0%           0%         1
   7  easy     20/20      16     76         62%         5%        6%          24%         7
   7  medium   20/20      11     27         60%         6%        2%          25%         3
   8  any      20/20       2      7         68%         2%        0%           0%         2
   8  easy     20/20      84    185         70%         5%        5%          19%        65
   8  medium   20/20      11     45         71%         3%        1%          20%        11
   9  any      20/20       3      9         76%         1%        0%           0%         8
   9  easy     20/20      64    263         79%         0%        4%          16%       228
   9  medium   20/20      18    105         82%         0%        1%          13%        58
  10  any      20/20       8     15         89%         0%        0%           0%        55
  10  easy     20/20     243   1027         87%         0%        2%          10%      2436
  10  medium   20/20      32    110         87%         0%        1%          10%       372
  11  any      20/20      10     31         93%         0%        0%           0%       407
  11  easy     16/20     337   1404         93%         0%        1%           6%     29538
  11  medium   20/20      67    236         93%         0%        0%           6%      2968
```

  Easy gets rarer with size (median 16 attempts at 7x7, 243 at 10x10, 337 at 11x11) because the unrated share grows with the board; Easy 11x11 fills only 16 of 20 seeds within 2000 attempts and about 30 s per level, so it is dropped. Medium fills every size, 11x11 at about 3 s per level.
- **Curriculum (pack 1, 69 levels).** In order: Easy 7, 8, 9, 10 (8 each), then Medium 7, 8, 9, 10 (8 each), then Medium 11 (5). Shipped cells: easy 7 to 10, medium 7 to 11. Dropped: easy 11. Ids are `easy-07-001` ... `medium-11-005`; the 42 untiered `any-*` levels are gone (no migration before the MVP). Regeneration takes about 40 s and is byte-identical on a second run.
- **Tests.** `generator.test.ts` (tier honoured over 10 seeds at 7x7 for each tier, determinism, spy, `expert` returns null on a small budget, reject reasons), `tools/pack.test.ts` (tiered rows, `rate` verification, tiered stats), `campaign.test.ts` (every level tiered, `rate(level) === level.tier`, tiers non-decreasing along the pack).

## 17. As built in M5-06

Hard techniques, ladder-driven hints and the Hard campaign cells.

- **Ladder.** `adjacency-pressure`, `subset-regions-lines` and `subset-lines-regions` (`ENGINE_DESIGN.md` §6) are rungs 4 to 6, tier `hard`. `rate`, `generate({ tier: "hard" })` and `tryCandidate` needed no change: they already work for any tier the ladder can produce. Untiered output and the golden snapshot are unchanged.
- **`unrated` after Hard.** The old `unrated` goldens now rate `hard` (renamed `hardLevel1` and `hardLevel2` in `__fixtures__/rated.ts`); two new `unrated` goldens were found by search and stall because they need lookahead (#93).
- **Measured tier shares** of untiered `generate` output (`seed` = `measure/<n>/<i>`; 100 levels per size, 40 at 11):

| size | easy | medium | hard | unrated |
|---|---|---|---|---|
| 7 | 3% | 16% | 71% | 10% |
| 8 | 5% | 16% | 74% | 5% |
| 9 | 6% | 23% | 62% | 9% |
| 10 | 3% | 18% | 70% | 9% |
| 11 | 2.5% (1 of 40) | 7.5% (3 of 40) | 80% (32 of 40) | 10% (4 of 40) |

  Most random levels need a Hard technique, so Hard is the cheapest tier to generate and Easy remains the rare one.
- **`--stats`** (20 seeds per cell, as §16; `tools/generate-levels.ts --stats` now includes `hard`; the easy and medium rows are re-measured, and their `tier-rej` and `unrated-rej` columns moved because former `unrated` candidates now count as `hard`, a tier reject):

```
size  tier    filled  median   p90  repair-rej  shape-rej  tier-rej  unrated-rej  ms/level
   7  any      20/20       1      6         57%         2%        0%           0%         1
   7  easy     20/20      16     76         62%         5%       29%           1%         9
   7  medium   20/20      11     27         60%         6%       25%           2%         3
   7  hard     20/20       2      6         53%         2%       10%           2%         1
   8  any      20/20       2      7         68%         2%        0%           0%         2
   8  easy     20/20      84    185         70%         5%       22%           2%        74
   8  medium   20/20      11     45         71%         3%       19%           2%        13
   8  hard     20/20       4     13         68%         8%        5%           2%         4
   9  any      20/20       3      9         76%         1%        0%           0%         8
   9  easy     20/20      64    263         79%         0%       19%           1%       235
   9  medium   20/20      18    105         82%         0%       14%           1%        59
   9  hard     20/20       4     13         81%         1%        3%           0%        11
  10  any      20/20       8     15         89%         0%        0%           0%        54
  10  easy     20/20     243   1027         87%         0%       12%           1%      2421
  10  medium   20/20      32    110         87%         0%       10%           1%       371
  10  hard     20/20       7     16         86%         1%        2%           1%        73
  11  any      20/20      10     31         93%         0%        0%           0%       399
  11  easy     16/20     337   1404         93%         0%        6%           0%     29154
  11  medium   20/20      67    236         93%         0%        5%           1%      2898
  11  hard     20/20       8     45         92%         1%        1%           1%       465
```

  Every Hard cell fills 20 of 20, including 11x11 at about 0.5 s per level, so no Hard cell is dropped and no steering was needed. The easy and medium attempt counts are identical to §16 (the same candidates are accepted); only the reject columns shifted.
- **Curriculum (pack 1, 94 levels).** Appended after Medium 11 so tiers stay non-decreasing: Hard 7, 8, 9, 10 and 11, five each. Shipped cells: easy 7 to 10, medium 7 to 11, hard 7 to 11. Dropped: easy 11. Ids `hard-07-001` ... `hard-11-005`. The first 69 levels regenerate byte-for-byte (the diff is 25 appended levels only), and a second run is byte-identical. The pack is 32 easy, 37 medium and 25 hard levels.
- **Hints** (`ENGINE_DESIGN.md` §8, `APP_DESIGN.md` §4.4): `nextHint` returns the first ladder step the player has not acted on, so the hint vocabulary is exactly the rating vocabulary. A full-board hint costs well under 1 ms on the 11x11 fixture (soft budget 10 ms).

## 18. As built in M5-07

Expert (lookahead): the decision, the numbers, and the campaign cells.

- **Decision: ship Expert.** A throwaway spike on the #92 `measure/<n>/<i>` seeds (100 untiered levels per size, 40 at 11) showed depth-1 lookahead solving all 37 levels that were `unrated` after Hard. The real implementation reproduces it exactly (re-measured on the same seeds):

| size | easy | medium | hard | expert | unrated | `rate` ms per expert level |
|---|---|---|---|---|---|---|
| 7 | 3 | 16 | 71 | 10 | 0 | 0.7 |
| 8 | 5 | 16 | 74 | 5 | 0 | 0.8 |
| 9 | 6 | 23 | 62 | 9 | 0 | 1.1 |
| 10 | 3 | 18 | 70 | 9 | 0 | 1.8 |
| 11 | 1 | 3 | 32 | 4 | 0 | 3.5 |

  Gate (decided before building): ship if the real implementation solved at least 90% of the unrated sample and at least 3 sizes met the 18 of 20 criterion. It solved 37 of 37, and all 5 sizes fill 20 of 20, so every cell ships its criterion; `Tier` keeps `"expert"`.
- **Ladder.** `lookahead` is rung 7, tier `expert` (`ENGINE_DESIGN.md` §6): depth 1, no nesting, propagating with rungs 1 to 6 (`propagate`) and checking `contradiction`. It is reached only when rungs 1 to 6 return null, so ratings of every non-expert level are unchanged and the first 94 pack levels regenerate byte-for-byte.
- **Generator.** `generate({ tier: "expert" })` and `tryCandidate` needed no change. `unrated` remains a valid `rate` output (a level the ladder cannot finish) and is still always rejected; no candidate was `unrated` in any measured run (the `unrated-rej` column is 0% everywhere), so the branch is tested by cutting the ladder to rungs 1 to 6 in a test (`__fixtures__/capLadder.ts`), not by a fixture.
- **`--stats`** (20 seeds per cell, `tools/generate-levels.ts --stats` now includes `expert`; the easy, medium and hard attempt counts are unchanged, and the former `unrated-rej` share is now counted as `tier-rej`):

```
size  tier    filled  median   p90  repair-rej  shape-rej  tier-rej  unrated-rej  ms/level
   7  any      20/20       1      6         57%         2%        0%           0%         1
   7  easy     20/20      16     76         62%         5%       30%           0%         9
   7  medium   20/20      11     27         60%         6%       27%           0%         3
   7  hard     20/20       2      6         53%         2%       12%           0%         1
   7  expert   20/20      52    146         61%         4%       34%           0%        18
   8  any      20/20       2      7         68%         2%        0%           0%         2
   8  easy     20/20      84    185         70%         5%       24%           0%        75
   8  medium   20/20      11     45         71%         3%       21%           0%        13
   8  hard     20/20       4     13         68%         8%        7%           0%         4
   8  expert   20/20      43    143         72%         4%       23%           0%        57
   9  any      20/20       3      9         76%         1%        0%           0%         8
   9  easy     20/20      64    263         79%         0%       20%           0%       235
   9  medium   20/20      18    105         82%         0%       15%           0%        59
   9  hard     20/20       4     13         81%         1%        3%           0%        12
   9  expert   20/20      46    201         79%         1%       19%           0%       154
  10  any      20/20       8     15         89%         0%        0%           0%        54
  10  easy     20/20     243   1027         87%         0%       13%           0%      2427
  10  medium   20/20      32    110         87%         0%       11%           0%       372
  10  hard     20/20       7     16         86%         1%        2%           0%        72
  10  expert   20/20      54    159         86%         0%       13%           0%       591
  11  any      20/20      10     31         93%         0%        0%           0%       380
  11  easy     16/20     337   1404         93%         0%        7%           0%     28075
  11  medium   20/20      67    236         93%         0%        6%           0%      2763
  11  hard     20/20       8     45         92%         1%        1%           0%       443
  11  expert   20/20     241    418         93%         0%        7%           0%      6443
```

  Expert is the costliest to find (median 43 to 54 attempts at 7 to 10, 241 at 11) but every cell fills 20 of 20 and 11x11 costs about 6.4 s per level, so no steering (§7.3) was built.
- **Curriculum (pack 1, 109 levels).** Appended after Hard 11 so tiers stay non-decreasing: Expert 7, 8, 9, 10 and 11, three each (fewer than the other tiers to keep 11x11 generation cheap). Ids `expert-07-001` ... `expert-11-003`. The diff to the previous pack is 15 appended levels only and a second run is byte-identical. The pack is 32 easy, 37 medium, 25 hard and 15 expert levels.
- **Hints.** A `lookahead` deduction is an elimination: the hint highlights the assumed cell and costs a heart like every hint (M5-06), writing no marks. Its text cites only the final emptied unit ("A face here would leave row 5 with nowhere to go after the forced moves that follow, so this cell cannot hold one."); it does not replay the chain of forced moves. That is a known limitation.
- **Tests.** Soundness (no `lookahead` elimination removes a solution cell) over generated levels at 7 to 11 and the expert goldens, with a throwaway mutation confirming it catches a wrong elimination; crafted-board, order and null cases in `techniques.expert.test.ts`; `rate` stays under 10 ms.
