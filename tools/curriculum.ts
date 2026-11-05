import type { CurriculumRow } from "./pack";

// The campaign, in play order: row order is the difficulty curve. Rows are
// untiered until rate() and tiered generation land (M5-04, M5-05).
export const CURRICULUM: readonly CurriculumRow[] = [
  { pack: 1, size: 7, count: 8 },
  { pack: 1, size: 8, count: 8 },
  { pack: 1, size: 9, count: 8 },
  { pack: 1, size: 10, count: 8 },
  { pack: 1, size: 11, count: 8 },
];
