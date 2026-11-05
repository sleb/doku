import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { type GameStore, gameStore } from "../../store/gameStore";
import { settingsStore, useSettingsStore } from "../../store/settings";

const button =
  "min-h-11 min-w-11 rounded border border-line px-3 disabled:opacity-40";

export type Control = "undo" | "redo" | "hint";

export interface ActionBarProps {
  /** The store the buttons drive. Defaults to the app's game store. */
  store?: StoreApi<GameStore>;
  /** Which action buttons to show. The input-mode toggle always shows. Default all. */
  only?: readonly Control[];
}

/**
 * Undo/Redo for note toggles, Hint (explains the next deduction for a heart), and the tap-places-faces toggle.
 * Four 44px buttons in one row so the bar does not grow taller.
 */
export function ActionBar({
  store = gameStore,
  only = ["undo", "redo", "hint"],
}: ActionBarProps = {}) {
  const playing = useStore(store, (s) => s.status === "playing");
  const canUndo = useStore(
    store,
    (s) => "history" in s && s.history.length > 0,
  );
  const canRedo = useStore(store, (s) => "future" in s && s.future.length > 0);
  const canHint = useStore(
    store,
    (s) => s.status === "playing" && s.hearts > 1,
  );
  const faceMode = useSettingsStore((s) => s.inputMode === "face");
  const { undo, redo, hint } = store.getState();
  return (
    <div className="flex items-center justify-center gap-3">
      {only.includes("undo") && (
        <button
          type="button"
          className={button}
          disabled={!playing || !canUndo}
          onClick={undo}
        >
          Undo
        </button>
      )}
      {only.includes("redo") && (
        <button
          type="button"
          className={button}
          disabled={!playing || !canRedo}
          onClick={redo}
        >
          Redo
        </button>
      )}
      {only.includes("hint") && (
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
      )}
      <button
        type="button"
        className={`${button} max-w-24 text-xs leading-tight aria-pressed:border-ink aria-pressed:bg-subtle aria-pressed:font-semibold`}
        aria-pressed={faceMode}
        disabled={!playing}
        onClick={() =>
          settingsStore
            .getState()
            .set({ inputMode: faceMode ? "mark" : "face" })
        }
      >
        Tap places faces
      </button>
    </div>
  );
}
