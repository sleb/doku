import { Dialog } from "../Dialog";

export function PauseDialog({
  open,
  onResume,
  onRestart,
  onRules,
  onSettings,
}: {
  open: boolean;
  onResume: () => void;
  onRestart: () => void;
  onRules: () => void;
  onSettings: () => void;
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
      <button
        type="button"
        onClick={onRules}
        className={`${button} border border-stone-300`}
      >
        Rules
      </button>
      <button
        type="button"
        onClick={onSettings}
        className={`${button} border border-stone-300`}
      >
        Settings
      </button>
    </Dialog>
  );
}
