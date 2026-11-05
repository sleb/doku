import { Cell } from "../engine";
import type { GameState } from "../store/game";

export type OutcomeKind = "place" | "wrong" | "win" | "lose";

interface Counts {
  /** Faces on the board after the change. */
  faces: number;
  /** Hearts after the change. */
  hearts: number;
}

export type Outcome =
  | ({ kind: "win" } & Counts)
  | ({ kind: "place" | "wrong" | "lose"; cell: number } & Counts)
  /** A hint taken: `cell` is the placed face, absent for an elimination. */
  | ({ kind: "hint"; cell?: number; message: string } & Counts);

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

/** The cell newly locked as wrong; the board may not change under a mark. */
function newWrongCell(prev: GameState, next: GameState): number | undefined {
  if (prev.status === "idle" || next.status === "idle") return undefined;
  for (const c of next.wrong) if (!prev.wrong.has(c)) return c;
  return undefined;
}

/** What a state change amounted to for the player, or null. Pure. */
export function outcomeFor(prev: GameState, next: GameState): Outcome | null {
  if (prev.status !== "playing") return null;
  const after = { faces: faceCount(next), hearts: next.hearts };
  if (next.status === "won") return { kind: "win", ...after };
  if (hinted(prev, next)) {
    const cell = changedCell(prev, next);
    const message = "hintShown" in next ? (next.hintShown?.message ?? "") : "";
    return {
      kind: "hint",
      ...(cell === undefined ? {} : { cell }),
      message,
      ...after,
    };
  }
  const failed = next.status === "lost" || next.hearts < prev.hearts;
  const cell = failed ? newWrongCell(prev, next) : changedCell(prev, next);
  if (cell === undefined) return null;
  if (next.status === "lost") return { kind: "lose", cell, ...after };
  if (next.hearts < prev.hearts) return { kind: "wrong", cell, ...after };
  if (after.faces > faceCount(prev)) return { kind: "place", cell, ...after };
  return null;
}
