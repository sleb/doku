import { useEffect, useId, useRef } from "react";
import type { GameStatus } from "../../store/game";

const HEADINGS = { won: "You solved it", lost: "Out of hearts" } as const;

export function ResultModal({
  status,
  onRetry,
}: {
  status: GameStatus;
  onRetry: () => void;
}) {
  const headingId = useId();
  const retry = useRef<HTMLButtonElement>(null);
  const open = status === "won" || status === "lost";

  useEffect(() => {
    if (open) retry.current?.focus();
  }, [open]);

  if (status !== "won" && status !== "lost") return null;

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="flex flex-col items-center gap-4 rounded-lg bg-white p-6 shadow-lg"
      >
        <h2 id={headingId} className="text-xl font-semibold">
          {HEADINGS[status]}
        </h2>
        <button
          ref={retry}
          type="button"
          onClick={onRetry}
          onKeyDown={(e) => {
            // Retry is the only focusable element: keep focus on it.
            if (e.key === "Tab") e.preventDefault();
          }}
          className="rounded bg-stone-800 px-4 py-2 text-white"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
