import type { Level } from "../engine";
import { LEVELS } from "../levels/campaign";

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
