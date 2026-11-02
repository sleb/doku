import { useGameStore } from "../../store/gameStore";
import { formatClock } from "./formatClock";

export function Timer() {
  const seconds = useGameStore((s) =>
    s.status === "idle" ? 0 : Math.floor(s.elapsedMs / 1000),
  );
  return <time className="tabular-nums">{formatClock(seconds)}</time>;
}
