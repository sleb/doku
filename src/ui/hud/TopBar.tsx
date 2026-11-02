import type { Level } from "../../engine";
import { MAX_HEARTS } from "../../store/game";
import { Hearts } from "./Hearts";
import { Timer } from "./Timer";

export function TopBar({
  level,
  hearts,
  onPause,
}: {
  level: Level;
  hearts: number;
  onPause: () => void;
}) {
  return (
    <header
      data-testid="top-bar"
      className="flex items-center justify-between gap-3"
    >
      <h1 className="text-lg font-semibold">{level.id}</h1>
      <Timer />
      <Hearts remaining={hearts} max={MAX_HEARTS} />
      <button
        type="button"
        onClick={onPause}
        className="min-h-11 min-w-11 rounded border border-stone-300 px-3"
      >
        Pause
      </button>
    </header>
  );
}
