import {
  type Board,
  Cell,
  type Deduction,
  emptyBoard,
  isSolved,
  judgeTap,
  type Level,
  nextHint,
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
      /** Hints taken this attempt; each costs a heart. */
      hintsUsed: number;
      elapsedMs: number;
      /** Cells of the player's ✕ toggles, oldest first; undo pops the last. */
      history: readonly number[];
      /** Undone toggles, oldest first; redo pops the last. */
      future: readonly number[];
      /** The hint on display; transient, so never saved. */
      hintShown: HintShown | null;
    };

/** What the board draws for a hint: the forcing cells, the cells it rules out. */
export interface HintShown {
  cells: number[];
  targets: number[];
  /** The default-naming text; the UI re-renders `deduction` for the palette. */
  message: string;
  deduction: Deduction;
  /** The cell a placement hint just filled; keys the timed ring. */
  placed?: number;
}

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
    hintsUsed: 0,
    elapsedMs: 0,
    history: [],
    future: [],
    hintShown: null,
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
  return state.status === "playing"
    ? { ...state, status: "paused", hintShown: null }
    : state;
}

export function resume(state: GameState): GameState {
  return state.status === "paused" ? { ...state, status: "playing" } : state;
}

export function restart(state: GameState): GameState {
  return state.status === "idle" ? state : startLevel(state.level);
}

export type Started = Exclude<GameState, { status: "idle" }>;

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
  return {
    ...s,
    board: flip(s.board, cell),
    history: [...s.history, cell],
    future: [],
    hintShown: null,
  };
}

/** Put a (correct) face on `cell`: lock it, prune the stacks, detect a win. */
function commitFace(s: Started, cell: number): Started {
  const board = s.board.slice();
  board[cell] = Cell.Face;
  return {
    ...s,
    ...prune(s, cell),
    board,
    hintShown: null,
    status: isSolved(board, s.level) ? "won" : "playing",
  };
}

export function placeFace(state: GameState, cell: number): GameState {
  const s = editable(state, cell);
  if (!s) return state;
  if (judgeTap(s.level, cell) === "correct") return commitFace(s, cell);
  const board = s.board.slice();
  board[cell] = Cell.Mark;
  const hearts = s.hearts - 1;
  return {
    ...s,
    ...prune(s, cell),
    board,
    wrong: new Set(s.wrong).add(cell),
    hearts,
    hintShown: null,
    status: hearts <= 0 ? "lost" : "playing",
  };
}

const sameCells = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Ask for the simplest deduction the player has not acted on, for a heart. A
 * placement puts the face down; an elimination only highlights and explains
 * (it writes no marks and nothing to history). Asking again for the hint
 * already on display is free (every board change clears `hintShown`, which
 * `game.test.ts` locks in, so a stale display never matches). Refused (same state) unless playing with a spare
 * heart: a hint can win but never lose.
 */
export function hint(state: GameState): GameState {
  if (state.status !== "playing" || state.hearts <= 1) return state;
  const found = nextHint(state.board, state.level);
  if (found === null) return state;
  const { place, eliminate, because } = found.deduction;
  const shown: HintShown = {
    cells: because.cells,
    targets: place === undefined ? eliminate : [],
    message: found.message,
    deduction: found.deduction,
    ...(place === undefined ? {} : { placed: place }),
  };
  const current = state.hintShown;
  if (
    current &&
    current.message === shown.message &&
    sameCells(current.cells, shown.cells) &&
    sameCells(current.targets, shown.targets)
  ) {
    return state;
  }
  const next = place === undefined ? state : commitFace(state, place);
  return {
    ...next,
    hearts: next.hearts - 1,
    hintsUsed: next.hintsUsed + 1,
    hintShown: next.status === "playing" ? shown : null,
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
    hintShown: null,
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
    hintShown: null,
  };
}
