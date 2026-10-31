import { memo } from "react";
import { Cell } from "../../engine";
import { HOLD_MS } from "./hold";
import { FaceIcon, MarkIcon, WrongIcon } from "./icons";
import { REGION_BG, REGION_NAMES } from "./palette";
import { useHold } from "./useHold";

export interface CellProps {
  index: number;
  row: number;
  col: number;
  region: number;
  state: Cell;
  isWrong: boolean;
  isConflict: boolean;
  disabled: boolean;
  onToggleMark: (index: number) => void;
  onPlaceFace: (index: number) => void;
}

function stateLabel(state: Cell, isWrong: boolean): string {
  if (isWrong && state === Cell.Mark) return "wrong";
  if (state === Cell.Mark) return "marked";
  if (state === Cell.Face) return "face";
  return "empty";
}

// Tailwind only emits literal class names, so keep these as full strings.
export const CellView = memo(function CellView({
  index,
  row,
  col,
  region,
  state,
  isWrong,
  isConflict,
  disabled,
  onToggleMark,
  onPlaceFace,
}: CellProps) {
  const hold = useHold(() => onPlaceFace(index), disabled);
  const label = stateLabel(state, isWrong);
  const className = [
    "cell relative touch-none select-none flex size-full items-center justify-center border-neutral-800",
    REGION_BG[region],
    // Thin grid lines only; thick region edges are drawn by Board's overlay.
    "border-r border-b",
    isConflict ? "ring-4 ring-inset ring-neutral-900" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      aria-label={`Row ${row + 1}, column ${col + 1}, ${REGION_NAMES[region]} region, ${label}`}
      data-conflict={isConflict ? "true" : undefined}
      className={className}
      data-holding={hold.holding ? "true" : undefined}
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        // Touch pointers are implicitly captured, which would suppress
        // pointerleave; release so dragging off cancels the hold.
        if (e.currentTarget.hasPointerCapture?.(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
        hold.start("pointer");
      }}
      onPointerUp={hold.cancel}
      onPointerCancel={hold.cancel}
      onPointerLeave={() => {
        hold.cancel();
        hold.clearSwallow();
      }}
      onBlur={hold.cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        hold.clearSwallow();
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        // Native click repeats on auto-repeat Enter; swallow repeats so a
        // held key does not flicker the mark. The first press still clicks.
        if (e.key === "Enter" && e.repeat) {
          e.preventDefault();
          return;
        }
        const isX = e.key === "x" || e.key === "X";
        if (!isX && e.key !== " ") return;
        // Always swallow, so Space never scrolls or synthesizes a click.
        e.preventDefault();
        if (e.repeat) return; // a held key must not flicker or restart
        if (isX) onToggleMark(index);
        else hold.start("key");
      }}
      onKeyUp={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === " ") {
          e.preventDefault();
          hold.cancel();
        }
      }}
      onClick={() => {
        if (!hold.swallowClick()) onToggleMark(index);
      }}
    >
      {hold.holding ? (
        <svg
          data-hold-glow
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="hold-glow pointer-events-none absolute inset-0 size-full"
        >
          <rect
            x="4"
            y="4"
            width="92"
            height="92"
            pathLength={1}
            style={{ animationDuration: `${HOLD_MS}ms` }}
          />
        </svg>
      ) : null}
      {label === "wrong" ? (
        <WrongIcon />
      ) : state === Cell.Mark ? (
        <MarkIcon />
      ) : state === Cell.Face ? (
        <FaceIcon />
      ) : null}
    </button>
  );
});
