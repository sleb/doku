import type { Coord, Level } from "./types";

export const MIN_SIZE = 7;
export const MAX_SIZE = 11;

export type LevelRule =
  | "size"
  | "regions-shape"
  | "region-count"
  | "region-connected"
  | "solution-shape"
  | "col"
  | "region"
  | "adjacent";

export interface LevelIssue {
  rule: LevelRule;
  message: string;
  cells: Coord[];
}

export class LevelError extends Error {
  constructor(readonly issues: LevelIssue[]) {
    super(
      issues
        .map((i) => `${i.rule}: ${i.message} [${i.cells.map(fmt).join(" ")}]`)
        .join("; "),
    );
    this.name = "LevelError";
  }
}

const fmt = ({ r, c }: Coord) => `(${r},${c})`;

const issue = (rule: LevelRule, message: string, cells: Coord[] = []) => ({
  rule,
  message,
  cells,
});

const inRange = (n: unknown, n0: number): n is number =>
  Number.isInteger(n) && (n as number) >= 0 && (n as number) < n0;

// Pure; never throws. Structural problems (size, regions shape, region count)
// stop further checks since the rest need a well-formed grid.
export function validateLevel(level: Level): LevelIssue[] {
  const { size: n, regions } = level;

  if (!Number.isInteger(n) || n < MIN_SIZE || n > MAX_SIZE) {
    return [issue("size", `size ${n} outside ${MIN_SIZE}..${MAX_SIZE}`)];
  }
  if (regions.length !== n || regions.some((row) => row.length !== n)) {
    return [issue("regions-shape", `regions must be ${n}×${n}`)];
  }

  const badIds: Coord[] = [];
  const ids = new Set<number>();
  for (const [r, row] of regions.entries()) {
    for (const [c, id] of row.entries()) {
      if (inRange(id, n)) ids.add(id);
      else badIds.push({ r, c });
    }
  }
  if (badIds.length > 0) {
    return [
      issue("region-count", `region ids must be integers 0..${n - 1}`, badIds),
    ];
  }
  if (ids.size !== n) {
    return [
      issue(
        "region-count",
        `expected ${n} distinct regions, found ${ids.size}`,
      ),
    ];
  }

  return [...connectivityIssues(regions, n), ...solutionIssues(level)];
}

function connectivityIssues(regions: number[][], n: number): LevelIssue[] {
  const issues: LevelIssue[] = [];
  const seen = new Set<number>();
  const reached = new Set<number>(); // region ids already flood-filled once
  for (let start = 0; start < n * n; start++) {
    if (seen.has(start)) continue;
    const id = regions[Math.floor(start / n)][start % n];
    const piece: Coord[] = [];
    const stack = [start];
    seen.add(start);
    for (let cur = stack.pop(); cur !== undefined; cur = stack.pop()) {
      const r = Math.floor(cur / n);
      const c = cur % n;
      piece.push({ r, c });
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const next = rr * n + cc;
        if (!seen.has(next) && regions[rr][cc] === id) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    if (reached.has(id)) {
      issues.push(
        issue("region-connected", `region ${id} is not 4-connected`, piece),
      );
    }
    reached.add(id);
  }
  return issues;
}

function solutionIssues({ size: n, regions, solution }: Level): LevelIssue[] {
  if (solution.length !== n || !solution.every((c) => inRange(c, n))) {
    return [
      issue("solution-shape", `solution must be ${n} columns in 0..${n - 1}`),
    ];
  }
  const faces: Coord[] = solution.map((c, r) => ({ r, c }));
  const issues: LevelIssue[] = [];

  const groupBy = (rule: "col" | "region", key: (f: Coord) => number) => {
    const groups = new Map<number, Coord[]>();
    for (const f of faces) {
      const k = key(f);
      groups.set(k, [...(groups.get(k) ?? []), f]);
    }
    for (const [k, cells] of groups) {
      if (cells.length > 1) {
        issues.push(
          issue(rule, `${cells.length} faces share ${rule} ${k}`, cells),
        );
      }
    }
  };
  groupBy("col", (f) => f.c);
  groupBy("region", (f) => regions[f.r][f.c]);

  for (let r = 0; r + 1 < n; r++) {
    if (Math.abs(solution[r] - solution[r + 1]) <= 1) {
      issues.push(issue("adjacent", "faces touch", [faces[r], faces[r + 1]]));
    }
  }
  return issues;
}

// Dev/test builds only; release builds skip the check.
export function loadLevel(raw: Level): Level {
  if (import.meta.env.DEV) {
    const issues = validateLevel(raw);
    if (issues.length > 0) throw new LevelError(issues);
  }
  return raw;
}
