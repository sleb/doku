import { Dialog } from "../Dialog";

export function PauseDialog({
  open,
  onResume,
  onRestart,
}: {
  open: boolean;
  onResume: () => void;
  onRestart: () => void;
}) {
  if (!open) return null;
  const button = "rounded px-4 py-2 min-h-11";
  return (
    <Dialog title="Paused">
      <button
        type="button"
        data-autofocus
        onClick={onResume}
        className={`${button} bg-stone-800 text-white`}
      >
        Resume
      </button>
      <button
        type="button"
        onClick={onRestart}
        className={`${button} border border-stone-300`}
      >
        Restart level
      </button>
    </Dialog>
  );
}
