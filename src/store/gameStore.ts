import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Level } from "../engine";
import {
  type GameState,
  idleState,
  pause,
  placeFace,
  restart,
  resume,
  startLevel,
  tick,
  toggleMark,
} from "./game";

export type GameStore = GameState & {
  startLevel(level: Level): void;
  restart(): void;
  toggleMark(cell: number): void;
  placeFace(cell: number): void;
  tick(dt: number): void;
  pause(): void;
  resume(): void;
};

export function createGameStore(): StoreApi<GameStore> {
  return createStore<GameStore>()((set) => ({
    ...idleState,
    startLevel: (level) => set(() => startLevel(level)),
    restart: () => set((s) => restart(s)),
    toggleMark: (cell) => set((s) => toggleMark(s, cell)),
    placeFace: (cell) => set((s) => placeFace(s, cell)),
    tick: (dt) => set((s) => tick(s, dt)),
    pause: () => set((s) => pause(s)),
    resume: () => set((s) => resume(s)),
  }));
}

/** The app singleton; exported so non-React code and tests can reset it. */
export const gameStore = createGameStore();

export function useGameStore<T>(selector: (s: GameStore) => T): T {
  return useStore(gameStore, selector);
}

useGameStore.getState = gameStore.getState;
