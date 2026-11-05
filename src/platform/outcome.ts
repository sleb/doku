import { Cell } from "../engine";
import type { GameState } from "../store/game";

export type OutcomeKind = "place" | "wrong" | "win" | "lose";

export interface Outcome {
  kind: OutcomeKind;
  /** The cell the player acted on; absent for a win. */
  cell?: number;
  /** Faces on the board after the change. */
  faces: number;
  /** Hearts after the change. */
  hearts: number;
}

function faceCount(state: GameState): number {
  return state.board ? state.board.filter((c) => c === Cell.Face).length : 0;
}

function hinted(prev: GameState, next: GameState): boolean {
  return (
    prev.status !== "idle" &&
    next.status !== "idle" &&
    next.hintsUsed > prev.hintsUsed
  );
}

function changedCell(prev: GameState, next: GameState): number | undefined {
  if (!prev.board || !next.board) return undefined;
  const i = next.board.findIndex((c, k) => c !== prev.board?.[k]);
  return i < 0 ? undefined : i;
}

/** What a state change amounted to for the player, or null. Pure. */
export function outcomeFor(prev: GameState, next: GameState): Outcome | null {
  if (prev.status !== "playing") return null;
  const after = { faces: faceCount(next), hearts: next.hearts };
  if (next.status === "won") return { kind: "win", ...after };
  const cell = changedCell(prev, next);
  if (next.status === "lost") return { kind: "lose", cell, ...after };
  if (hinted(prev, next)) return { kind: "place", cell, ...after };
  if (next.hearts < prev.hearts) return { kind: "wrong", cell, ...after };
  if (after.faces > faceCount(prev)) return { kind: "place", cell, ...after };
  return null;
}
