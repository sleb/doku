import type { Level } from "../types";

// Seed for M1-10's fixture set. Regions are row bands, so it is connected and
// has a valid placement (one per row/col/region, no touching), but it is NOT
// guaranteed to have a unique solution.
export const level7: Level = {
  id: "fixture-7",
  size: 7,
  regions: [0, 1, 2, 3, 4, 5, 6].map((r) => Array<number>(7).fill(r)),
  solution: [1, 3, 5, 0, 2, 4, 6],
};

// Exactly one valid placement, verified by brute force (see the countSolutions
// tests). Use where a test needs a unique solution.
export const uniqueLevel7: Level = {
  id: "fixture-unique-7",
  size: 7,
  regions: [
    [0, 0, 0, 0, 1, 1, 1],
    [0, 0, 1, 1, 1, 1, 1],
    [0, 0, 1, 1, 2, 2, 2],
    [3, 0, 0, 0, 2, 2, 2],
    [3, 0, 4, 5, 5, 2, 2],
    [3, 3, 5, 5, 5, 5, 2],
    [3, 5, 5, 5, 5, 6, 6],
  ],
  solution: [1, 3, 5, 0, 2, 4, 6],
};
