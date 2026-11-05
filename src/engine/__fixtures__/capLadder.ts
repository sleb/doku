import { TECHNIQUES } from "../techniques";

// Runs `fn` with the ladder cut to rungs 1 to 6, so an expert level stalls the
// way every level once did. Test-only; restores the ladder afterwards.
export function withoutLookahead<T>(fn: () => T): T {
  const lookahead = TECHNIQUES.pop();
  try {
    if (lookahead?.id !== "lookahead")
      throw new Error("rung 7 is not lookahead");
    return fn();
  } finally {
    if (lookahead) TECHNIQUES.push(lookahead);
  }
}
