import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { Level } from "../engine";
import { LEVELS } from "../levels/campaign";
import type { Storage } from "../platform/storage";

export type Progress = { next: number; bestMs: Record<string, number> };

export const defaultProgress: Progress = { next: 0, bestMs: {} };

export function recordWin(p: Progress, index: number, ms: number): Progress {
  const id = LEVELS[index].id;
  return {
    next: Math.max(p.next, index + 1),
    bestMs: { ...p.bestMs, [id]: Math.min(ms, p.bestMs[id] ?? ms) },
  };
}

export function startOver(p: Progress): Progress {
  return { ...p, next: 0 };
}

export function currentLevel(p: Progress): Level | null {
  return LEVELS[p.next] ?? null;
}

function parseBests(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  for (const [id, ms] of Object.entries(raw)) {
    if (typeof ms === "number" && Number.isFinite(ms) && ms >= 0) out[id] = ms;
  }
  return out;
}

export function parseProgress(raw: unknown, count: number): Progress {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { next: 0, bestMs: {} };
  }
  const r = raw as Record<string, unknown>;
  return {
    next:
      typeof r.next === "number" && Number.isFinite(r.next)
        ? Math.min(Math.max(Math.floor(r.next), 0), count)
        : 0,
    bestMs: parseBests(r.bestMs),
  };
}

export type ProgressStore = Progress & {
  record(index: number, ms: number): void;
  startOver(): void;
};

export const progressStore = createStore<ProgressStore>()((set) => ({
  ...defaultProgress,
  record: (index, ms) => set((s) => recordWin(s, index, ms)),
  startOver: () => set((s) => startOver(s)),
}));

const KEY = "progress";

export async function hydrateProgress(storage: Storage): Promise<void> {
  try {
    progressStore.setState(
      parseProgress(await storage.get(KEY), LEVELS.length),
    );
  } catch {
    // Unreadable: keep the defaults.
  }
}

export function persistProgress(storage: Storage): () => void {
  return progressStore.subscribe(({ next, bestMs }) => {
    storage.set(KEY, { next, bestMs }).catch(() => {});
  });
}

export function useProgressStore<T>(selector: (s: ProgressStore) => T): T {
  return useStore(progressStore, selector);
}
