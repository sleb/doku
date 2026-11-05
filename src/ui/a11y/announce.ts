import type { Outcome } from "../../platform/outcome";

export interface AnnounceContext {
  /** Board side length. */
  size: number;
  hearts?: number;
  elapsedMs?: number;
  bestMs?: number;
  /** The tutorial shows no hearts, so the count is not spoken. */
  tutorial?: boolean;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function spokenTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (h > 0) parts.push(plural(h, "hour"));
  if (m > 0) parts.push(plural(m, "minute"));
  if (s > 0 || parts.length === 0) parts.push(plural(s, "second"));
  return parts.join(" ");
}

/** The spoken text for an outcome. Pure. */
export function announce(outcome: Outcome, ctx: AnnounceContext): string {
  if (outcome.kind === "win") {
    const best =
      ctx.elapsedMs !== undefined &&
      ctx.bestMs !== undefined &&
      ctx.elapsedMs <= ctx.bestMs
        ? " New best."
        : "";
    return `Solved in ${spokenTime(ctx.elapsedMs ?? 0)}.${best}`;
  }
  if (outcome.kind === "lose") return "Out of hearts. Retry is available.";
  const where = `row ${Math.floor(outcome.cell / ctx.size) + 1}, column ${(outcome.cell % ctx.size) + 1}`;
  if (outcome.kind === "place")
    return `Face placed, ${where}. ${outcome.faces} of ${ctx.size} placed.`;
  const base = `Not there. ${where[0].toUpperCase()}${where.slice(1)} is wrong.`;
  return ctx.tutorial
    ? base
    : `${base} ${plural(outcome.hearts, "heart")} left.`;
}

export const announceLevelStart = (n: number, count: number, size: number) =>
  `Level ${n} of ${count}, ${size} by ${size}.`;
export const announcePause = () => "Paused.";
export const announceResume = () => "Resumed.";
export const announceInputMode = (mode: "mark" | "face") =>
  mode === "face" ? "Tapping now places faces." : "Tapping now marks cells.";
