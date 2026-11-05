import { memo, type RefObject, useRef } from "react";
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
  /** Roving tabindex: 0 on the board's active cell, -1 elsewhere. */
  tabIndex?: number;
  onToggleMark: (index: number) => void;
  onPlaceFace: (index: number) => void;
  /** Shared by a board's cells: the index of the cell being held, if any. Other cells ignore marks meanwhile. */
  holdOwner?: RefObject<number | null>;
  /** One-shot effect for the outcome that just hit this cell. Primitives only, so other cells stay memoised. */
  fx?: "place" | "wrong";
  /** Changes with every outcome; keys the effect so a repeat restarts it. */
  fxSeq?: number;
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
  tabIndex,
  onToggleMark,
  onPlaceFace,
  holdOwner,
  fx,
  fxSeq,
}: CellProps) {
  const hold = useHold(
    () => onPlaceFace(index),
    disabled,
    (active) => {
      if (!holdOwner) return;
      if (active) holdOwner.current = index;
      else if (holdOwner.current === index) holdOwner.current = null;
    },
  );
  // A second finger or palm on a neighbor must not mark it mid-hold.
  const toggleMark = () => {
    if (disabled) return;
    const owner = holdOwner?.current;
    if (owner == null || owner === index) onToggleMark(index);
  };
  // Keep the last seq so the wrapper (and icon) keep their identity when fx clears.
  const seqRef = useRef(fxSeq);
  if (fx) seqRef.current = fxSeq;
  const label = stateLabel(state, isWrong);
  const className = [
    "cell relative touch-none select-none flex size-full items-center justify-center border-neutral-800",
    REGION_BG[region],
    // Thin grid lines only; thick region edges are drawn by Board's overlay.
    "border-r border-b",
    // Keyboard focus: an outline inset past the 4px conflict ring so both read.
    "focus-visible:outline-3 focus-visible:-outline-offset-8 focus-visible:outline-blue-700",
    isConflict ? "ring-4 ring-inset ring-neutral-900" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const icon =
    label === "wrong" ? (
      <WrongIcon />
    ) : state === Cell.Mark ? (
      <MarkIcon />
    ) : state === Cell.Face ? (
      <FaceIcon />
    ) : null;
  return (
    <button
      type="button"
      aria-label={`Row ${row + 1}, column ${col + 1}, ${REGION_NAMES[region]} region, ${label}`}
      data-conflict={isConflict ? "true" : undefined}
      className={className}
      data-holding={hold.holding ? "true" : undefined}
      aria-disabled={disabled ? "true" : undefined}
      tabIndex={tabIndex}
      data-index={index}
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
        if (isX) toggleMark();
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
        if (!hold.swallowClick()) toggleMark();
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
      {fx === "place" ? (
        <span
          key={`ring${fxSeq}`}
          aria-hidden="true"
          data-fx-ring
          className="fx-ring pointer-events-none absolute inset-0 text-neutral-900"
        />
      ) : null}
      <span
        key={seqRef.current}
        data-fx={fx}
        className="fx-icon flex size-full items-center justify-center"
      >
        {icon}
      </span>
    </button>
  );
});
