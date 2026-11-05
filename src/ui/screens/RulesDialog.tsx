import { Dialog } from "../Dialog";

export function RulesDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Rules" onClose={onClose}>
      <ol className="list-decimal pl-5 text-left">
        <li>Place one face in each colored region.</li>
        <li>Place one face in each row and column.</li>
        <li>No two faces touch, even diagonally.</li>
        <li>Wrong taps cost a heart.</li>
      </ol>
      <ul className="text-left text-sm">
        <li>Tap a cell to mark it ✕.</li>
        <li>Hold a cell to place a face.</li>
        <li>
          Or switch the <strong>Tap: Face</strong> button (or press <kbd>f</kbd>
          ) so a tap places a face.
        </li>
        <li>
          <kbd>Arrows</kbd> move, <kbd>x</kbd> marks, hold <kbd>Space</kbd>{" "}
          places a face.
        </li>
        <li>
          <kbd>z</kbd> undoes, <kbd>h</kbd> gives a hint, <kbd>Esc</kbd> closes
          a dialog.
        </li>
      </ul>
      <button
        type="button"
        data-autofocus
        onClick={onClose}
        className="rounded bg-stone-800 px-4 py-2 min-h-11 text-white"
      >
        Got it
      </button>
    </Dialog>
  );
}
