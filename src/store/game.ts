import { type Board, emptyBoard, type Level } from "../engine";

export const MAX_HEARTS = 3;

export type GameStatus = "idle" | "playing" | "won" | "lost";

export type GameState =
  | { status: "idle"; level: null; board: null; hearts: number }
  | {
      status: "playing" | "won" | "lost";
      level: Level;
      board: Board;
      wrong: ReadonlySet<number>;
      hearts: number;
    };

export const idleState: GameState = {
  status: "idle",
  level: null,
  board: null,
  hearts: MAX_HEARTS,
};

export function startLevel(level: Level): GameState {
  return {
    status: "playing",
    level,
    board: emptyBoard(level),
    wrong: new Set(),
    hearts: MAX_HEARTS,
  };
}

export function restart(state: GameState): GameState {
  return state.status === "idle" ? state : startLevel(state.level);
}
