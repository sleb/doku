import { memo } from "react";
import { Cell } from "../../engine";
import { FaceIcon, MarkIcon, WrongIcon } from "./icons";
import { REGION_BG, REGION_NAMES } from "./palette";

export interface CellProps {
  index: number;
  row: number;
  col: number;
  region: number;
  thickRight: boolean;
  thickBottom: boolean;
  state: Cell;
  isWrong: boolean;
  isConflict: boolean;
}

function stateLabel(state: Cell, isWrong: boolean): string {
  if (isWrong && state === Cell.Mark) return "wrong";
  if (state === Cell.Mark) return "marked";
  if (state === Cell.Face) return "face";
  return "empty";
}

// Tailwind only emits literal class names, so keep these as full strings.
export const CellView = memo(function CellView({
  row,
  col,
  region,
  thickRight,
  thickBottom,
  state,
  isWrong,
  isConflict,
}: CellProps) {
  const label = stateLabel(state, isWrong);
  const className = [
    "relative flex size-full items-center justify-center border-neutral-800",
    REGION_BG[region],
    thickRight ? "border-r-4" : "border-r",
    thickBottom ? "border-b-4" : "border-b",
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
    >
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
