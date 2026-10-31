import type { Level } from "../../engine";

export interface CellGeometry {
  index: number;
  row: number;
  col: number;
  region: number;
  // Each cell owns only its right and bottom edge; top/left are drawn by the
  // neighbor or the board frame, so a shared edge is drawn exactly once.
  thickRight: boolean;
  thickBottom: boolean;
}

export function cellGeometry(level: Level): CellGeometry[] {
  const { size, regions } = level;
  const out: CellGeometry[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const region = regions[row][col];
      out.push({
        index: row * size + col,
        row,
        col,
        region,
        thickRight: col < size - 1 && regions[row][col + 1] !== region,
        thickBottom: row < size - 1 && regions[row + 1][col] !== region,
      });
    }
  }
  return out;
}
