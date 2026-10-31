import {
  type Board,
  Cell,
  emptyBoard,
  isSolved,
  judgeTap,
  type Level,
} from "../engine";

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

type Started = Exclude<GameState, { status: "idle" }>;

/** A face or a wrong mark can no longer be edited; the player's own mark can. */
export function isLocked(
  board: Board,
  wrong: ReadonlySet<number>,
  cell: number,
): boolean {
  return board[cell] === Cell.Face || wrong.has(cell);
}

/** The shared tap prelude: the playing state if `cell` is editable, else null. */
function editable(state: GameState, cell: number): Started | null {
  if (state.status !== "playing") return null;
  const { size } = state.level;
  if (!Number.isInteger(cell) || cell < 0 || cell >= size * size) {
    throw new RangeError(`cell ${cell} is out of range`);
  }
  if (isLocked(state.board, state.wrong, cell)) return null;
  return state;
}

export function toggleMark(state: GameState, cell: number): GameState {
  const s = editable(state, cell);
  if (!s) return state;
  const board = s.board.slice();
  board[cell] = board[cell] === Cell.Mark ? Cell.Empty : Cell.Mark;
  return { ...s, board };
}

export function placeFace(state: GameState, cell: number): GameState {
  const s = editable(state, cell);
  if (!s) return state;
  const board = s.board.slice();
  if (judgeTap(s.level, cell) === "correct") {
    board[cell] = Cell.Face;
    return {
      ...s,
      board,
      status: isSolved(board, s.level) ? "won" : "playing",
    };
  }
  board[cell] = Cell.Mark;
  const hearts = s.hearts - 1;
  return {
    ...s,
    board,
    wrong: new Set(s.wrong).add(cell),
    hearts,
    status: hearts <= 0 ? "lost" : "playing",
  };
}
