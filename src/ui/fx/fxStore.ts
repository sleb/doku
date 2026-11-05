import { createStore } from "zustand/vanilla";
import type { Outcome, OutcomeKind } from "../../platform/outcome";

/** The latest outcome, for one-shot cell and heart animations. */
export interface Fx {
  /** Increments on every `set`, so a repeated effect restarts. */
  seq: number;
  kind: OutcomeKind;
  cell?: number;
  /** Hearts after the outcome; the heart at this index just emptied. */
  hearts: number;
}

interface FxStore {
  last: Fx | null;
  seq: number;
  set(outcome: Outcome): void;
  clear(): void;
}

export const fxStore = createStore<FxStore>()((set, get) => ({
  last: null,
  seq: 0,
  set(o) {
    const seq = get().seq + 1;
    set({
      seq,
      last: {
        seq,
        kind: o.kind,
        cell: "cell" in o ? o.cell : undefined,
        hearts: o.hearts,
      },
    });
  },
  clear: () => set({ last: null }),
}));
