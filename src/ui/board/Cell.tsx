import { memo, type RefObject, useEffect, useRef } from "react";
import { Cell } from "../../engine";
import { HINT_RING_MS } from "./hintRing";
import { FaceIcon, MarkIcon, WrongIcon } from "./icons";
import {
  HINT_RING_COLOR,
  HINT_RING_UNDERSTROKE_COLOR,
  type PaletteName,
  regionClass,
} from "./palette";
import { patternStyle } from "./patterns";
import { regionLabel } from "./regionNaming";
import { useHold } from "./useHold";

export interface CellProps {
  index: number;
  row: number;
  col: number;
  region: number;
  state: Cell;
  isWrong: boolean;
  isConflict: boolean;
  /** A hint on display: `cause` cells force it, `target` cells it rules out. */
  hint?: "cause" | "target";
  disabled: boolean;
  /** "face": a click, Enter or Space places a face (no timed hold needed). Default "mark". */
  inputMode?: "mark" | "face";
  /** Region color set. Default "default". */
  palette?: PaletteName;
  /** Overlay the region's pattern so color is not the only identity. Default off. */
  patterns?: boolean;
  /** Tutorial "look here" ring; also named in the label, so it is not colour-only. */
  highlight?: boolean;
  /** Roving tabindex: 0 on the board's active cell, -1 elsewhere. */
  tabIndex?: number;
  onToggleMark: (index: number) => void;
  onPlaceFace: (index: number) => void;
  /** Shared by a board's cells: the index of the cell being held, if any. Other cells ignore marks meanwhile. */
  holdOwner?: RefObject<number | null>;
  /** Reports the cell while its hold glows (`index`) and when it stops (`null`). Must be stable. */
  onGlow?: (glowing: number | null, owner?: number) => void;
  /** Set on the cell a hint just filled; the value keys the 2 s ring so a new hint restarts it. */
  hintRing?: number;
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
  hint,
  disabled,
  highlight = false,
  inputMode,
  palette = "default",
  patterns = false,
  tabIndex,
  onToggleMark,
  onPlaceFace,
  holdOwner,
  onGlow,
  fx,
  fxSeq,
  hintRing,
}: CellProps) {
  const hold = useHold(
    () => {
      // Another cell's hold owns the board: a stray touch must not place.
      const owner = holdOwner?.current;
      if (owner == null || owner === index) onPlaceFace(index);
    },
    disabled,
    (active) => {
      if (!holdOwner) return;
      if (active) holdOwner.current ??= index;
      else if (holdOwner.current === index) holdOwner.current = null;
    },
  );
  // A second finger or palm on a neighbor must not mark it mid-hold.
  const free = () => {
    const owner = holdOwner?.current;
    return owner == null || owner === index;
  };
  // A cell that does not own the board's hold never starts one, so a second
  // finger cannot move the glow ring or restart the haptic ramp.
  const startHold = (source: "pointer" | "key") => {
    if (free()) hold.start(source);
  };
  const holding = hold.holding;
  useEffect(() => {
    if (!holding || !onGlow) return;
    onGlow(index);
    return () => onGlow(null, index);
  }, [holding, onGlow, index]);
  const toggleMark = () => {
    if (!disabled && free()) onToggleMark(index);
  };
  // Keep the last seq so the wrapper (and icon) keep their identity when fx clears.
  const seqRef = useRef(fxSeq);
  if (fx) seqRef.current = fxSeq;
  const placeNow = () => {
    if (!disabled && free()) onPlaceFace(index);
  };
  const label = stateLabel(state, isWrong);
  const className = [
    "cell relative touch-none select-none flex size-full items-center justify-center border-neutral-800",
    regionClass(palette, region),
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
      aria-label={`Row ${row + 1}, column ${col + 1}, ${regionLabel(region, { palette, patterns })}, ${label}${isConflict ? ", conflict" : ""}${highlight ? ", highlighted" : ""}`}
      data-conflict={isConflict ? "true" : undefined}
      data-highlight={highlight ? "true" : undefined}
      data-hint={hint}
      aria-description={
        hint === "cause"
          ? "Hint: part of the reason"
          : hint === "target"
            ? "Hint: cannot hold a face"
            : undefined
      }
      className={className}
      style={patterns ? patternStyle(region) : undefined}
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
        startHold("pointer");
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
        else if (inputMode === "face") placeNow();
        else startHold("key");
      }}
      onKeyUp={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === " ") {
          e.preventDefault();
          hold.cancel();
        }
      }}
      onClick={() => {
        if (hold.swallowClick()) return;
        if (inputMode === "face") placeNow();
        else toggleMark();
      }}
    >
      {hint ? (
        <span
          data-hint-marker
          aria-hidden="true"
          className={`pointer-events-none absolute inset-1 rounded-sm border-2 border-blue-700 ${
            hint === "cause" ? "border-dashed" : "border-solid bg-blue-700/15"
          }`}
        />
      ) : null}
      {fx === "place" ? (
        <span
          key={`ring${fxSeq}`}
          aria-hidden="true"
          data-fx-ring
          className="fx-ring pointer-events-none absolute inset-0 text-neutral-900"
        />
      ) : null}
      {hintRing !== undefined ? (
        <span
          key={`hint-ring${hintRing}`}
          aria-hidden="true"
          data-hint-ring
          className="hint-ring pointer-events-none absolute inset-0"
          style={{
            animationDuration: `${HINT_RING_MS}ms`,
            borderColor: HINT_RING_COLOR,
            boxShadow: `0 0 0 2px ${HINT_RING_UNDERSTROKE_COLOR}`,
          }}
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
