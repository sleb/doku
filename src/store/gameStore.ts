import { createStore, type StoreApi } from "zustand/vanilla";
import type { Level } from "../engine";
import {
  type GameState,
  idleState,
  restart,
  startLevel,
  toggleMark,
} from "./game";

export type GameStore = GameState & {
  startLevel(level: Level): void;
  restart(): void;
  toggleMark(cell: number): void;
};

export function createGameStore(): StoreApi<GameStore> {
  return createStore<GameStore>()((set) => ({
    ...idleState,
    startLevel: (level) => set(() => startLevel(level)),
    restart: () => set((s) => restart(s)),
    toggleMark: (cell) => set((s) => toggleMark(s, cell)),
  }));
}
