// Pure pack-building logic for tools/generate-levels.ts: canonical forms,
// ids, de-duplication, verification and serialization. No fs, no clock.
import {
  countSolutions,
  type Level,
  solve,
  type Tier,
  validateLevel,
} from "../src/engine";

export interface CurriculumRow {
  pack: number;
  size: number;
  tier?: Tier;
  count: number;
}

export type GenerateFn = (o: { size: number; seed: string }) => Level | null;

type Grid = number[][];

const rotate = (g: Grid): Grid =>
  g[0].map((_, c) => g.map((row) => row[c]).reverse());
const mirror = (g: Grid): Grid => g.map((row) => [...row].reverse());

// Region ids renamed by first appearance in row-major order.
function relabel(g: Grid): string {
  const names = new Map<number, number>();
  return g
    .map((row) =>
      row
        .map((id) => {
          if (!names.has(id)) names.set(id, names.size);
          return names.get(id);
        })
        .join(","),
    )
    .join("/");
}

/** Equal for boards that differ only by rotation, reflection or region ids. */
export function canonicalForm(level: Level): string {
  const forms: string[] = [];
  let g = level.regions;
  for (let i = 0; i < 4; i++) {
    forms.push(relabel(g), relabel(mirror(g)));
    g = rotate(g);
  }
  return forms.sort()[0];
}

export function levelId(
  tier: Tier | undefined,
  size: number,
  index: number,
): string {
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${tier ?? "any"}-${pad(size, 2)}-${pad(index, 3)}`;
}

/** First 1-based id index of each row, counted per (tier, size) over the whole curriculum. */
export function rowStartIndexes(
  curriculum: readonly CurriculumRow[],
): number[] {
  const next = new Map<string, number>();
  return curriculum.map((row) => {
    const key = `${row.tier ?? "any"}:${row.size}`;
    const start = next.get(key) ?? 1;
    next.set(key, start + row.count);
    return start;
  });
}

export interface RowResult {
  levels: Level[];
  /** Set when the row could not be filled. */
  failure?: string;
}

/** Fills one row. `seen` (canonical forms) is updated with every kept level. */
export function collectRow(
  row: CurriculumRow,
  startIndex: number,
  seen: Set<string>,
  generate: GenerateFn,
): RowResult {
  const levels: Level[] = [];
  const tier = row.tier ?? "any";
  // Duplicates consume a seed; a generator stuck on one board must not loop.
  const maxSeeds = row.count * 50;
  for (let i = 0; levels.length < row.count; i++) {
    if (i >= maxSeeds) {
      return {
        levels,
        failure: `pack ${row.pack}, size ${row.size}, ${tier}: ${maxSeeds} seeds gave only ${levels.length} of ${row.count} distinct levels`,
      };
    }
    const seed = `pack-${row.pack}/${row.size}/${tier}/${i}`;
    const made = generate({ size: row.size, seed });
    if (!made) {
      return {
        levels,
        failure: `pack ${row.pack}, size ${row.size}, ${tier}: only ${levels.length} of ${row.count} levels`,
      };
    }
    const form = canonicalForm(made);
    if (seen.has(form)) continue;
    seen.add(form);
    const { tier: _drop, ...rest } = made;
    levels.push({
      ...rest,
      id: levelId(row.tier, row.size, startIndex + levels.length),
      ...(row.tier ? { tier: row.tier } : {}),
    });
  }
  return { levels };
}

/** Problems that make a level unfit to ship; empty when fine. */
export function verifyLevel(level: Level): string[] {
  const issues = validateLevel(level).map((i) => `${i.rule}: ${i.message}`);
  if (issues.length > 0) return issues;
  const out: string[] = [];
  if (countSolutions(level) !== 1) out.push("not uniquely solvable");
  const solved = solve(level);
  if (!solved || solved.join() !== level.solution.join()) {
    out.push("solve() differs from the stored solution");
  }
  return out;
}

export interface BuildResult {
  levels: Level[];
  json: string;
  failures: string[];
}

/**
 * Builds pack `packNumber`. `others` are the levels of every other pack: ids
 * must not collide with any, and boards of lower-numbered packs are skipped.
 * Throws on an id collision or a level that fails verification.
 */
export function buildPack(
  curriculum: readonly CurriculumRow[],
  packNumber: number,
  others: readonly { pack: number; levels: readonly Level[] }[],
  options: { generate: GenerateFn },
): BuildResult {
  const flat = others.flatMap((o) =>
    o.levels.map((level) => ({ pack: o.pack, level })),
  );
  const ids = new Set(flat.map((o) => o.level.id));
  const seen = new Set(
    flat.filter((o) => o.pack < packNumber).map((o) => canonicalForm(o.level)),
  );
  const starts = rowStartIndexes(curriculum);
  const levels: Level[] = [];
  const failures: string[] = [];
  curriculum.forEach((row, i) => {
    if (row.pack !== packNumber) return;
    const res = collectRow(row, starts[i], seen, options.generate);
    if (res.failure) failures.push(res.failure);
    for (const level of res.levels) {
      if (ids.has(level.id)) throw new Error(`duplicate level id ${level.id}`);
      ids.add(level.id);
      const problems = verifyLevel(level);
      if (problems.length > 0) {
        throw new Error(
          `verification failed for ${level.id}: ${problems.join("; ")}`,
        );
      }
      levels.push(level);
    }
  });
  return { levels, json: `${JSON.stringify({ levels }, null, 2)}\n`, failures };
}
