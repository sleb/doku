import { neighborsOf, type Puzzle, unitIndexes } from "./compile";
import { type Board, Cell } from "./types";

// What a face could still go where. Techniques read this, never the board, so
// they compose after eliminations. Values are never mutated in place.
export interface Candidates {
  alive: Uint8Array; // cell -> 1 if a face could still go here
  placed: Uint8Array; // cell -> 1 if a face is placed
  aliveCount: Uint8Array; // unit index -> number of alive cells
  satisfied: Uint8Array; // unit index -> 1 if the unit already has its face
}

function clone(c: Candidates): Candidates {
  return {
    alive: c.alive.slice(),
    placed: c.placed.slice(),
    aliveCount: c.aliveCount.slice(),
    satisfied: c.satisfied.slice(),
  };
}

function kill(p: Puzzle, c: Candidates, cell: number): void {
  if (!c.alive[cell]) return;
  c.alive[cell] = 0;
  for (const u of unitIndexes(p, cell)) c.aliveCount[u]--;
}

// Every cell alive, then each Face on the board placed. Marks are ignored.
export function fromBoard(p: Puzzle, board?: Board): Candidates {
  const total = p.n * p.n;
  let c: Candidates = {
    alive: new Uint8Array(total).fill(1),
    placed: new Uint8Array(total),
    aliveCount: Uint8Array.from(p.units, (u) => u.cells.length),
    satisfied: new Uint8Array(p.units.length),
  };
  if (board) {
    for (let i = 0; i < total; i++) {
      if (board[i] === Cell.Face) c = placeFace(p, c, i);
    }
  }
  return c;
}

// Places a face and eliminates the rest of its row, column and region plus its
// neighbors. The placed cell itself stays alive.
export function placeFace(p: Puzzle, c: Candidates, cell: number): Candidates {
  const next = clone(c);
  next.placed[cell] = 1;
  const units = unitIndexes(p, cell);
  for (const u of units) {
    next.satisfied[u] = 1;
    for (const other of p.units[u].cells)
      if (other !== cell) kill(p, next, other);
  }
  for (const other of neighborsOf(p, cell)) kill(p, next, other);
  return next;
}

export function eliminate(
  p: Puzzle,
  c: Candidates,
  cells: readonly number[],
): Candidates {
  const next = clone(c);
  for (const cell of cells) kill(p, next, cell);
  return next;
}
