import { Cell, type Level } from "../engine";
import type { GameState, Started } from "./game";

export type SavedGame = {
  levelId: string;
  board: number[];
  wrong: number[];
  hearts: number;
  elapsedMs: number;
  hintsUsed: number;
};

export function toSaved(state: GameState): SavedGame | null {
  if (state.status === "idle") return null;
  if (state.status === "won" || state.status === "lost") return null;
  return {
    levelId: state.level.id,
    board: Array.from(state.board),
    wrong: [...state.wrong].sort((a, b) => a - b),
    hearts: state.hearts,
    elapsedMs: state.elapsedMs,
    hintsUsed: state.hintsUsed,
  };
}

export function fromSaved(raw: unknown, level: Level): Started | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const r = raw as SavedGame;
  if (r.levelId !== level.id) return null;
  if (!Array.isArray(r.board) || r.board.length !== level.size ** 2) {
    return null;
  }
  if (!r.board.every((c) => c === Cell.Empty || c === Cell.Mark || c === Cell.Face)) {
    return null;
  }
  return {
    status: "paused",
    level,
    board: Uint8Array.from(r.board),
    wrong: new Set(r.wrong),
    hearts: r.hearts,
    hintsUsed: r.hintsUsed,
    elapsedMs: r.elapsedMs,
    history: [],
    future: [],
  };
}
