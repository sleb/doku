import { Cell, type Board, type Level } from "./types";

export function emptyBoard(level: Level): Board {
  return new Uint8Array(level.size * level.size).fill(Cell.Empty);
}
