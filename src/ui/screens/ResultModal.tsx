import type { GameStatus } from "../../store/game";
import { Dialog } from "../Dialog";

const HEADINGS = { won: "You solved it", lost: "Out of hearts" } as const;

export function ResultModal({
  status,
  onRetry,
}: {
  status: GameStatus;
  onRetry: () => void;
}) {
  if (status !== "won" && status !== "lost") return null;

  return (
    <Dialog title={HEADINGS[status]}>
      <button
        type="button"
        onClick={onRetry}
        className="rounded bg-stone-800 px-4 py-2 text-white"
      >
        Retry
      </button>
    </Dialog>
  );
}
