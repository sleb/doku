import { solveByTechniques } from "./solver";
import type { Level, Tier } from "./types";

/**
 * The hardest tier a human-style solve needs, taking the simplest applicable
 * technique at every step, or `unrated` when the ladder cannot finish.
 */
export function rate(level: Level): Tier | "unrated" {
  const trace = solveByTechniques(level);
  return trace.solved && trace.hardest ? trace.hardest : "unrated";
}
