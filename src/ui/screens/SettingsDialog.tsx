import { useEffect, useRef, useState } from "react";
import { settingsStore, useSettingsStore } from "../../store/settings";
import { Dialog } from "../Dialog";

export function SettingsDialog({
  onClose,
  onStartOver,
}: {
  onClose: () => void;
  onStartOver: () => void;
}) {
  const haptics = useSettingsStore((s) => s.haptics);
  const [confirming, setConfirming] = useState(false);
  const startOverButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  // Cancelling unmounts the focused Cancel button; put focus back.
  useEffect(() => {
    if (wasConfirming.current && !confirming) startOverButton.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  return (
    <Dialog
      title="Settings"
      onClose={confirming ? () => setConfirming(false) : onClose}
    >
      <button
        type="button"
        role="switch"
        aria-checked={haptics}
        onClick={() => settingsStore.getState().set({ haptics: !haptics })}
        className="rounded border border-stone-300 px-4 py-2 min-h-11"
      >
        Haptics
      </button>
      {confirming ? (
        <>
          <p>Start over? Your best times are kept.</p>
          <button
            type="button"
            onClick={() => {
              onStartOver();
              onClose();
            }}
            className="rounded bg-stone-800 px-4 py-2 min-h-11 text-white"
          >
            Confirm
          </button>
          <button
            type="button"
            // biome-ignore lint/a11y/noAutofocus: focus must move into the confirm
            autoFocus
            onClick={() => setConfirming(false)}
            className="rounded border border-stone-300 px-4 py-2 min-h-11"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          ref={startOverButton}
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded border border-stone-300 px-4 py-2 min-h-11"
        >
          Start over
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="rounded bg-stone-800 px-4 py-2 min-h-11 text-white"
      >
        Done
      </button>
    </Dialog>
  );
}
