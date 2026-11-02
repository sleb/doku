import { settingsStore, useSettingsStore } from "../../store/settings";
import { Dialog } from "../Dialog";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const haptics = useSettingsStore((s) => s.haptics);
  return (
    <Dialog title="Settings" onClose={onClose}>
      <button
        type="button"
        role="switch"
        aria-checked={haptics}
        onClick={() => settingsStore.getState().set({ haptics: !haptics })}
        className="rounded border border-stone-300 px-4 py-2 min-h-11"
      >
        Haptics
      </button>
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
