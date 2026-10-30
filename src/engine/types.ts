export type Coord = { r: number; c: number };

export type Tier = "easy" | "medium" | "hard" | "expert";

// Serialized form (JSON level packs).
export interface Level {
  id: string;
  size: number; // N
  regions: number[][]; // N×N region ids, 0..N-1
  solution: number[]; // solution[r] = column of the face in row r (length N)
  tier?: Tier;
  seed?: string;
}

export enum Cell {
  Empty = 0,
  Mark = 1,
  Face = 2,
}

// One byte per cell, length N*N, values of Cell. Marks are free notes; only
// Face cells are facts.
export type Board = Readonly<Uint8Array>;
