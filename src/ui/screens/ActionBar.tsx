import { gameStore, useGameStore } from "../../store/gameStore";

const button =
  "min-h-11 min-w-11 rounded border border-stone-300 px-3 disabled:opacity-40";

/** Undo/Redo for note toggles. Hint joins in M4-04 (#75). */
export function ActionBar() {
  const playing = useGameStore((s) => s.status === "playing");
  const canUndo = useGameStore((s) => "history" in s && s.history.length > 0);
  const canRedo = useGameStore((s) => "future" in s && s.future.length > 0);
  const { undo, redo } = gameStore.getState();
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
    </div>
  );
}
