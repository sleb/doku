import { Cell } from "../engine";
import type { GameState } from "../store/game";
import type { HapticKind } from "./haptics";

function faces(state: GameState): number {
  return state.board ? state.board.filter((c) => c === Cell.Face).length : 0;
}

/** The single haptic a state change deserves, or null. Pure. */
export function feedbackFor(
  prev: GameState,
  next: GameState,
): HapticKind | null {
  if (prev.status !== "playing") return null;
  if (next.status === "won") return "win";
  if (next.status === "lost") return "lose";
  if (next.hearts < prev.hearts) return "wrong";
  if (faces(next) > faces(prev)) return "place";
  return null;
}
