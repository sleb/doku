// Throwaway seed-pack generator (replaced by tools/generate-levels.ts in M5).
// Usage: bun tools/seed-pack.ts [size:count ...]   e.g. 7:2 9:2 10:1 11:1
// Naive rejection sampling: random valid solution, grow one region per face,
// keep if countSolutions == 1. Prints Level JSON objects, one per line.
import { countSolutions, type Level } from "../src/engine";

const rand = (n: number) => Math.floor(Math.random() * n);

function randomSolution(n: number): number[] {
  for (;;) {
    const cols = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = rand(i + 1);
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }
    if (cols.every((c, r) => r === 0 || Math.abs(c - cols[r - 1]) > 1)) {
      return cols;
    }
  }
}

function growRegions(n: number, solution: number[]): number[][] {
  const regions = Array.from({ length: n }, () => Array<number>(n).fill(-1));
  const frontier: [number, number][] = [];
  solution.forEach((c, r) => {
    regions[r][c] = r;
    frontier.push([r, c]);
  });
  let left = n * n - n;
  while (left > 0) {
    const [r, c] = frontier[rand(frontier.length)];
    const [dr, dc] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ][rand(4)];
    const rr = r + dr;
    const cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= n || cc >= n || regions[rr][cc] !== -1) {
      continue;
    }
    regions[rr][cc] = regions[r][c];
    frontier.push([rr, cc]);
    left--;
  }
  return regions;
}

function find(n: number, id: string, budgetMs: number): Level | null {
  const end = Date.now() + budgetMs;
  while (Date.now() < end) {
    const solution = randomSolution(n);
    const level: Level = {
      id,
      size: n,
      regions: growRegions(n, solution),
      solution,
    };
    if (countSolutions(level) === 1) return level;
  }
  return null;
}

const specs = (
  process.argv.slice(2).length
    ? process.argv.slice(2)
    : ["7:2", "9:2", "10:1", "11:1"]
).map((s) => s.split(":").map(Number));
let k = 1;
for (const [size, count] of specs) {
  for (let i = 0; i < count; i++) {
    const level = find(size, `seed-${k}`, 60_000);
    if (level) {
      console.log(JSON.stringify(level));
      k++;
    } else {
      console.error(`no unique ${size}x${size} within budget`);
    }
  }
}
