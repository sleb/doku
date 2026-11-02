import { LEVELS } from "../../levels/campaign";
import { useProgressStore } from "../../store/progress";
import { formatClock } from "../hud/formatClock";

export function Finale({ onStartOver }: { onStartOver: () => void }) {
  const bestMs = useProgressStore((s) => s.bestMs);
  const total = LEVELS.reduce((sum, l) => sum + (bestMs[l.id] ?? 0), 0);
  return (
    <section className="flex h-full flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">You finished</h1>
      <p>Total of best times: {formatClock(total / 1000)}</p>
      <button
        type="button"
        onClick={onStartOver}
        className="rounded bg-stone-800 px-4 py-2 min-h-11 text-white"
      >
        Start over
      </button>
    </section>
  );
}
