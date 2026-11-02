import {
  type Board,
  Cell,
  emptyBoard,
  isSolved,
  judgeTap,
  type Level,
} from "../engine";

export const MAX_HEARTS = 3;

export type GameStatus = "idle" | "playing" | "paused" | "won" | "lost";

export type GameState =
  | { status: "idle"; level: null; board: null; hearts: number }
  | {
      status: "playing" | "paused" | "won" | "lost";
      level: Level;
      board: Board;
      wrong: ReadonlySet<number>;
      hearts: number;
      elapsedMs: number;
      /** Cells of the player's ✕ toggles, oldest first; undo pops the last. */
      history: readonly number[];
      /** Undone toggles, oldest first; redo pops the last. */
      future: readonly number[];
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
    elapsedMs: 0,
    history: [],
    future: [],
  };
}

/** Advance the clock by `dt` ms; time is injected, never read here. */
export function tick(state: GameState, dt: number): GameState {
  if (state.status !== "playing" || !Number.isFinite(dt) || dt < 0) {
    return state;
  }
  return { ...state, elapsedMs: state.elapsedMs + dt };
}

export function pause(state: GameState): GameState {
  return state.status === "playing" ? { ...state, status: "paused" } : state;
}

export function resume(state: GameState): GameState {
  return state.status === "paused" ? { ...state, status: "playing" } : state;
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

/** Drop a now-locked cell from both stacks, keeping the order of the rest. */
function prune(s: Started, cell: number) {
  const keep = (c: number) => c !== cell;
  return { history: s.history.filter(keep), future: s.future.filter(keep) };
}

export function toggleMark(state: GameState, cell: number): GameState {
  const s = editable(state, cell);
  if (!s) return state;
  const board = s.board.slice();
  board[cell] = board[cell] === Cell.Mark ? Cell.Empty : Cell.Mark;
  return { ...s, board, history: [...s.history, cell], future: [] };
}

export function placeFace(state: GameState, cell: number): GameState {
  const s = editable(state, cell);
  if (!s) return state;
  const board = s.board.slice();
  if (judgeTap(s.level, cell) === "correct") {
    board[cell] = Cell.Face;
    return {
      ...s,
      ...prune(s, cell),
      board,
      status: isSolved(board, s.level) ? "won" : "playing",
    };
  }
  board[cell] = Cell.Mark;
  const hearts = s.hearts - 1;
  return {
    ...s,
    ...prune(s, cell),
    board,
    wrong: new Set(s.wrong).add(cell),
    hearts,
    status: hearts <= 0 ? "lost" : "playing",
  };
}

function flip(board: Board, cell: number): Board {
  const next = board.slice();
  next[cell] = next[cell] === Cell.Mark ? Cell.Empty : Cell.Mark;
  return next;
}

/** Undo the last note toggle. Never refunds a heart or touches locked cells. */
export function undo(state: GameState): GameState {
  if (state.status !== "playing" || state.history.length === 0) return state;
  const cell = state.history[state.history.length - 1];
  return {
    ...state,
    board: flip(state.board, cell),
    history: state.history.slice(0, -1),
    future: [...state.future, cell],
  };
}

export function redo(state: GameState): GameState {
  if (state.status !== "playing" || state.future.length === 0) return state;
  const cell = state.future[state.future.length - 1];
  return {
    ...state,
    board: flip(state.board, cell),
    history: [...state.history, cell],
    future: state.future.slice(0, -1),
  };
}
