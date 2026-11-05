import type { CurriculumRow } from "./pack";

// The campaign, in play order: row order is the difficulty curve. Only cells
// the generator fills (docs/GENERATOR_DESIGN.md §16 to §18): Easy 7 to 10,
// Medium 7 to 11, Hard 7 to 11, Expert 7 to 11. Easy 11x11 fills 16 of 20
// stats seeds, below the 18 of 20 criterion, and is dropped. Every Hard and
// Expert cell fills 20 of 20; Expert is three levels per size to keep the 11x11
// generation cost (about 6 s per level) small.
export const CURRICULUM: readonly CurriculumRow[] = [
  { pack: 1, size: 7, tier: "easy", count: 8 },
  { pack: 1, size: 8, tier: "easy", count: 8 },
  { pack: 1, size: 9, tier: "easy", count: 8 },
  { pack: 1, size: 10, tier: "easy", count: 8 },
  { pack: 1, size: 7, tier: "medium", count: 8 },
  { pack: 1, size: 8, tier: "medium", count: 8 },
  { pack: 1, size: 9, tier: "medium", count: 8 },
  { pack: 1, size: 10, tier: "medium", count: 8 },
  { pack: 1, size: 11, tier: "medium", count: 5 },
  { pack: 1, size: 7, tier: "hard", count: 5 },
  { pack: 1, size: 8, tier: "hard", count: 5 },
  { pack: 1, size: 9, tier: "hard", count: 5 },
  { pack: 1, size: 10, tier: "hard", count: 5 },
  { pack: 1, size: 11, tier: "hard", count: 5 },
  { pack: 1, size: 7, tier: "expert", count: 3 },
  { pack: 1, size: 8, tier: "expert", count: 3 },
  { pack: 1, size: 9, tier: "expert", count: 3 },
  { pack: 1, size: 10, tier: "expert", count: 3 },
  { pack: 1, size: 11, tier: "expert", count: 3 },
];
