import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Level } from "../engine";
import {
  type GameState,
  hint,
  idleState,
  pause,
  placeFace,
  redo,
  restart,
  resume,
  startLevel,
  tick,
  toggleMark,
  undo,
} from "./game";

export type GameStore = GameState & {
  startLevel(level: Level): void;
  restart(): void;
  toggleMark(cell: number): void;
  placeFace(cell: number): void;
  hint(): void;
  undo(): void;
  redo(): void;
  tick(dt: number): void;
  pause(): void;
  resume(): void;
};

let flushClock: () => void = () => {};

/**
 * Registers the running clock's flush, which credits the time since its last
 * tick. Actions that can leave `playing` call it first, while ticks still
 * count, so a pause or win does not drop the partial interval. Returns the
 * unregister function.
 */
export function onClockFlush(flush: () => void): () => void {
  flushClock = flush;
  return () => {
    if (flushClock === flush) flushClock = () => {};
  };
}

export function createGameStore(): StoreApi<GameStore> {
  return createStore<GameStore>()((set) => ({
    ...idleState,
    startLevel: (level) => set(() => startLevel(level)),
    restart: () => set((s) => restart(s)),
    toggleMark: (cell) => set((s) => toggleMark(s, cell)),
    placeFace: (cell) => {
      flushClock();
      set((s) => placeFace(s, cell));
    },
    hint: () => {
      flushClock();
      set((s) => hint(s));
    },
    undo: () => set((s) => undo(s)),
    redo: () => set((s) => redo(s)),
    tick: (dt) => set((s) => tick(s, dt)),
    pause: () => {
      flushClock();
      set((s) => pause(s));
    },
    resume: () => set((s) => resume(s)),
  }));
}

/** The app singleton; exported so non-React code and tests can reset it. */
export const gameStore = createGameStore();

export function useGameStore<T>(selector: (s: GameStore) => T): T {
  return useStore(gameStore, selector);
}

useGameStore.getState = gameStore.getState;
