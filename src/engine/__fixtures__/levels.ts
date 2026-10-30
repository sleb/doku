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
