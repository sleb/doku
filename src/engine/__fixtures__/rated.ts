import type { Level } from "../types";

// Frozen 7x7 levels with their expected rating, found with a throwaway search
// over generate() and checked by hand against the technique trace. Easy needs
// no region/line confinement step; medium needs at least one; hard needs at
// least one Hard technique; unrated stalls because finishing it needs a
// technique the ladder does not have yet (lookahead, #93).

export const easyLevel1: Level = {
  id: "golden-easy-1",
  size: 7,
  regions: [
    [1, 1, 1, 3, 3, 0, 0],
    [1, 1, 1, 1, 3, 3, 0],
    [1, 2, 1, 1, 3, 0, 0],
    [1, 4, 1, 1, 3, 3, 0],
    [4, 4, 1, 3, 3, 6, 5],
    [6, 6, 6, 6, 6, 6, 5],
    [6, 6, 6, 6, 6, 6, 6],
  ],
  solution: [5, 3, 1, 4, 0, 6, 2],
};

export const easyLevel2: Level = {
  id: "golden-easy-2",
  size: 7,
  regions: [
    [0, 0, 1, 2, 2, 2, 2],
    [1, 0, 1, 1, 1, 4, 2],
    [1, 1, 1, 4, 4, 4, 2],
    [1, 1, 3, 4, 3, 4, 4],
    [1, 1, 3, 4, 3, 4, 4],
    [1, 5, 3, 3, 3, 3, 4],
    [5, 5, 5, 5, 6, 4, 4],
  ],
  solution: [0, 3, 6, 2, 5, 1, 4],
};

export const mediumLevel1: Level = {
  id: "golden-medium-1",
  size: 7,
  regions: [
    [1, 1, 1, 1, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [3, 1, 1, 2, 2, 2, 1],
    [3, 5, 4, 2, 4, 4, 6],
    [5, 5, 4, 4, 4, 6, 6],
    [5, 5, 6, 6, 6, 6, 6],
    [5, 6, 6, 6, 6, 6, 6],
  ],
  solution: [4, 2, 5, 0, 3, 1, 6],
};

export const mediumLevel2: Level = {
  id: "golden-medium-2",
  size: 7,
  regions: [
    [2, 2, 2, 0, 0, 0, 0],
    [2, 2, 0, 0, 3, 1, 1],
    [2, 2, 2, 0, 3, 3, 1],
    [2, 2, 2, 0, 3, 3, 1],
    [6, 2, 2, 0, 3, 3, 4],
    [6, 2, 5, 5, 3, 3, 4],
    [6, 6, 6, 5, 3, 3, 3],
  ],
  solution: [3, 5, 1, 4, 6, 2, 0],
};

export const hardLevel1: Level = {
  id: "golden-hard-1",
  size: 7,
  regions: [
    [0, 0, 0, 0, 0, 0, 0],
    [2, 2, 1, 1, 1, 1, 0],
    [2, 5, 1, 3, 3, 1, 0],
    [5, 5, 5, 3, 3, 3, 3],
    [5, 5, 5, 5, 4, 6, 3],
    [5, 6, 5, 5, 6, 6, 6],
    [6, 6, 6, 6, 6, 6, 6],
  ],
  solution: [1, 3, 0, 6, 4, 2, 5],
};

export const hardLevel2: Level = {
  id: "golden-hard-2",
  size: 7,
  regions: [
    [1, 1, 1, 1, 1, 0, 0],
    [3, 1, 1, 2, 2, 2, 2],
    [3, 3, 1, 2, 2, 4, 2],
    [5, 3, 1, 1, 4, 4, 2],
    [5, 3, 4, 4, 4, 4, 2],
    [5, 4, 4, 4, 4, 4, 4],
    [5, 5, 5, 5, 6, 4, 4],
  ],
  solution: [5, 2, 6, 1, 3, 0, 4],
};

export const unratedLevel1: Level = {
  id: "golden-unrated-1",
  size: 7,
  regions: [
    [0, 0, 0, 1, 1, 1, 2],
    [0, 1, 1, 1, 1, 2, 2],
    [0, 0, 3, 1, 2, 2, 5],
    [3, 3, 3, 3, 2, 2, 5],
    [3, 3, 4, 4, 4, 4, 5],
    [3, 3, 4, 4, 4, 5, 5],
    [3, 3, 3, 6, 4, 5, 5],
  ],
  solution: [0, 2, 5, 1, 4, 6, 3],
};

export const unratedLevel2: Level = {
  id: "golden-unrated-2",
  size: 7,
  regions: [
    [2, 2, 0, 0, 1, 1, 1],
    [2, 2, 2, 0, 1, 3, 1],
    [2, 2, 5, 5, 3, 3, 3],
    [2, 4, 4, 5, 3, 3, 6],
    [2, 4, 4, 5, 5, 3, 6],
    [2, 5, 5, 5, 5, 5, 6],
    [2, 2, 2, 2, 5, 5, 6],
  ],
  solution: [2, 4, 0, 5, 1, 3, 6],
};

export const rated: {
  name: string;
  level: Level;
  tier: "easy" | "medium" | "hard" | "unrated";
}[] = [
  { name: "easy1", level: easyLevel1, tier: "easy" },
  { name: "easy2", level: easyLevel2, tier: "easy" },
  { name: "medium1", level: mediumLevel1, tier: "medium" },
  { name: "medium2", level: mediumLevel2, tier: "medium" },
  { name: "hard1", level: hardLevel1, tier: "hard" },
  { name: "hard2", level: hardLevel2, tier: "hard" },
  { name: "unrated1", level: unratedLevel1, tier: "unrated" },
  { name: "unrated2", level: unratedLevel2, tier: "unrated" },
];

// 11x11 medium level, for the rate performance test.
export const mediumLevel11: Level = {
  id: "golden-medium-11",
  size: 11,
  regions: [
    [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 2, 0, 2, 2, 2, 2, 2],
    [1, 1, 1, 2, 2, 2, 2, 4, 4, 3, 5],
    [2, 2, 2, 2, 2, 2, 4, 4, 5, 5, 5],
    [2, 2, 2, 2, 4, 4, 4, 4, 5, 5, 5],
    [2, 2, 6, 6, 6, 6, 6, 5, 5, 5, 5],
    [6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 7],
    [6, 6, 6, 6, 6, 6, 8, 8, 5, 7, 7],
    [9, 6, 9, 9, 9, 9, 8, 7, 7, 7, 7],
    [9, 9, 9, 9, 10, 10, 10, 7, 7, 7, 7],
  ],
  solution: [3, 1, 4, 9, 6, 8, 2, 10, 7, 0, 5],
};
