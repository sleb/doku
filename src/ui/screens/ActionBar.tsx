import { gameStore, useGameStore } from "../../store/gameStore";
import { settingsStore, useSettingsStore } from "../../store/settings";

const button =
  "min-h-11 min-w-11 rounded border border-stone-300 px-3 disabled:opacity-40";

/**
 * Undo/Redo for note toggles, and Hint (places a correct face for a heart), and the tap-places-faces toggle.
 * Four 44px buttons in one row so the bar does not grow taller.
 */
export function ActionBar() {
  const playing = useGameStore((s) => s.status === "playing");
  const canUndo = useGameStore((s) => "history" in s && s.history.length > 0);
  const canRedo = useGameStore((s) => "future" in s && s.future.length > 0);
  const canHint = useGameStore((s) => s.status === "playing" && s.hearts > 1);
  const faceMode = useSettingsStore((s) => s.inputMode === "face");
  const { undo, redo, hint } = gameStore.getState();
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        className={button}
        disabled={!playing || !canUndo}
        onClick={undo}
      >
        Undo
      </button>
      <button
        type="button"
        className={button}
        disabled={!playing || !canRedo}
        onClick={redo}
      >
        Redo
      </button>
      <button
        type="button"
        className={button}
        aria-label="Hint, costs one heart"
        disabled={!canHint}
        onClick={hint}
      >
        Hint
        <span className="ml-1 whitespace-nowrap text-xs">-1 ♥</span>
      </button>
      <button
        type="button"
        className={button}
        aria-label="Tap places faces"
        aria-pressed={faceMode}
        disabled={!playing}
        onClick={() =>
          settingsStore
            .getState()
            .set({ inputMode: faceMode ? "mark" : "face" })
        }
      >
        {faceMode ? "Tap: Face" : "Tap: ✕"}
      </button>
    </div>
  );
}
