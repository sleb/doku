import type { Level } from "../types";

// Exactly one valid placement, verified by brute force (see the countSolutions
// tests). Use where a test needs a unique solution at the smallest size.
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

// Exactly one valid placement at the maximum size (11x11). Found by a
// throwaway random search, not hand-designed. Use where a test needs a unique
// solution at the largest size (stress, performance, size-dependent code).
export const uniqueLevel11: Level = {
  id: "fixture-unique-11",
  size: 11,
  regions: [
    [1, 1, 1, 1, 1, 1, 1, 4, 4, 4, 0],
    [1, 1, 1, 1, 1, 1, 1, 4, 7, 7, 7],
    [5, 1, 1, 1, 1, 1, 4, 4, 2, 2, 7],
    [5, 3, 1, 1, 9, 9, 4, 7, 2, 7, 7],
    [5, 5, 1, 1, 9, 9, 4, 7, 7, 7, 7],
    [5, 8, 1, 9, 9, 6, 4, 4, 4, 4, 7],
    [8, 8, 1, 9, 9, 6, 9, 9, 9, 4, 7],
    [9, 8, 9, 9, 9, 9, 9, 7, 9, 9, 7],
    [9, 8, 8, 8, 9, 7, 7, 7, 7, 9, 7],
    [9, 9, 9, 9, 9, 9, 9, 7, 7, 7, 7],
    [9, 9, 9, 9, 9, 9, 9, 9, 7, 10, 10],
  ],
  solution: [10, 3, 8, 1, 6, 0, 5, 7, 2, 4, 9],
};

// Valid (its stored solution passes validateLevel) but has more than one
// placement. Regions are row bands, so it is connected. Use as the default
// well-formed level and wherever a test needs the solver to find several.
export const multiSolutionLevel7: Level = {
  id: "fixture-7",
  size: 7,
  regions: [0, 1, 2, 3, 4, 5, 6].map((r) => Array<number>(7).fill(r)),
  solution: [1, 3, 5, 0, 2, 4, 6],
};

// Well-formed regions but no valid placement: regions 0 and 1 are single cells
// at (0,0) and (1,1), which touch, so no placement can satisfy both. Without
// the adjacency rule it has 5 placements, so this is the only obstruction.
// The stored solution is a dummy, so this level deliberately FAILS
// validateLevel; use it only with solve and countSolutions.
export const noSolutionLevel7: Level = {
  id: "fixture-no-solution-7",
  size: 7,
  regions: [
    [0, 5, 5, 5, 5, 2, 2],
    [5, 1, 5, 4, 5, 2, 2],
    [5, 5, 5, 4, 2, 2, 2],
    [5, 5, 4, 4, 4, 4, 2],
    [5, 5, 4, 4, 4, 3, 6],
    [5, 5, 4, 4, 6, 6, 6],
    [5, 5, 5, 4, 6, 6, 6],
  ],
  solution: [0, 0, 0, 0, 0, 0, 0],
};

export interface Fixture {
  name: string;
  level: Level;
  purpose: string;
}

// Every fixture with its intended purpose; fixtures.test.ts proves the
// properties each one claims.
export const fixtures: Fixture[] = [
  {
    name: "uniqueLevel7",
    level: uniqueLevel7,
    purpose: "Unique solution at the minimum size.",
  },
  {
    name: "uniqueLevel11",
    level: uniqueLevel11,
    purpose: "Unique solution at the maximum size.",
  },
  {
    name: "multiSolutionLevel7",
    level: multiSolutionLevel7,
    purpose: "Valid level with several placements.",
  },
  {
    name: "noSolutionLevel7",
    level: noSolutionLevel7,
    purpose: "Well-formed regions with no valid placement.",
  },
];
