import type { GameStatus } from "../../store/game";
import { Dialog } from "../Dialog";
import { formatClock } from "../hud/formatClock";

const HEADINGS = { won: "You solved it", lost: "Out of hearts" } as const;

export function ResultModal({
  status,
  elapsedMs,
  bestMs,
  hintsUsed,
  isLast,
  onRetry,
  onNext,
}: {
  status: GameStatus;
  elapsedMs: number;
  bestMs?: number;
  hintsUsed: number;
  isLast: boolean;
  onRetry: () => void;
  onNext: () => void;
}) {
  if (status !== "won" && status !== "lost") return null;

  return (
    <Dialog title={HEADINGS[status]}>
      {status === "won" && <p>Time: {formatClock(elapsedMs / 1000)}</p>}
      {status === "won" && bestMs !== undefined && (
        <p>
          {elapsedMs <= bestMs
            ? "New best"
            : `Best: ${formatClock(bestMs / 1000)}`}
        </p>
      )}
      {status === "won" && hintsUsed > 0 && <p>Hints: {hintsUsed}</p>}
      <button
        type="button"
        onClick={status === "won" ? onNext : onRetry}
        className="rounded bg-accent px-4 py-2 text-on-accent"
      >
        {status === "lost" ? "Retry" : isLast ? "Finish" : "Next level"}
      </button>
    </Dialog>
  );
}
