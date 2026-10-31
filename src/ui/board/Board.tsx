import { type CSSProperties, useMemo } from "react";
import type { Board as BoardData, Level } from "../../engine";
import { isLocked } from "../../store/game";
import { CellView } from "./Cell";
import { type CellGeometry, cellGeometry } from "./geometry";

export interface BoardProps {
  level: Level;
  board: BoardData;
  wrong: ReadonlySet<number>;
  conflicts: ReadonlySet<number>;
  /** True when the game is not `playing`; locks the whole board. */
  disabled: boolean;
  onToggleMark: (index: number) => void;
  onPlaceFace: (index: number) => void;
}

export function Board({
  level,
  board,
  wrong,
  conflicts,
  disabled,
  onToggleMark,
  onPlaceFace,
}: BoardProps) {
  const { size } = level;
  const geometry = useMemo(() => cellGeometry(level), [level]);
  const style = {
    "--n": size,
    "--cell":
      // Budgets subtract the frame's border-4 (2 x 4px) so large boards fit.
      "min(calc((100vw - 2rem - 8px) / var(--n)), calc((100dvh - 9rem - 8px) / var(--n)), 4.5rem)",
    gridTemplateColumns: "repeat(var(--n), var(--cell))",
    gridAutoRows: "var(--cell)",
  } as CSSProperties;
  const rows = Array.from({ length: size }, (_, r) =>
    geometry.slice(r * size, (r + 1) * size),
  );
  return (
    // biome-ignore lint/a11y/useSemanticElements lint/a11y/useFocusableInteractive: ARIA grid on a CSS grid; the focusable element is the inner button (BOARD_DESIGN 4.2)
    <div
      role="grid"
      aria-label="Puzzle board"
      aria-rowcount={size}
      aria-colcount={size}
      className="relative grid w-max border-4 border-neutral-800"
      style={style}
    >
      {rows.map((cells) => (
        // biome-ignore lint/a11y/useSemanticElements lint/a11y/useFocusableInteractive: ARIA grid on a CSS grid; the focusable element is the inner button (BOARD_DESIGN 4.2)
        <div key={cells[0].row} role="row" className="contents">
          {cells.map((g) => (
            // biome-ignore lint/a11y/useSemanticElements lint/a11y/useFocusableInteractive: ARIA grid on a CSS grid; the focusable element is the inner button (BOARD_DESIGN 4.2)
            <div key={g.index} role="gridcell" className="size-full">
              <CellView
                index={g.index}
                row={g.row}
                col={g.col}
                region={g.region}
                state={board[g.index]}
                isWrong={wrong.has(g.index)}
                isConflict={conflicts.has(g.index)}
                disabled={disabled || isLocked(board, wrong, g.index)}
                onToggleMark={onToggleMark}
                onPlaceFace={onPlaceFace}
              />
            </div>
          ))}
        </div>
      ))}
      {geometry.map((g) => (
        <EdgeSegments key={g.index} g={g} />
      ))}
    </div>
  );
}

const THICK = 4; // px, region edge width
const THIN = 1; // px, cell border width

/**
 * Thick region edges, drawn as an overlay centered on the thin grid line (the
 * 1px border inside the cell, whose center is THIN/2 before the boundary), so
 * they straddle it without changing cell size. Segments extend THICK/2 past
 * each end so corners join square. Later in the DOM and absolutely positioned,
 * so they paint above cell fills and thin lines.
 */
function EdgeSegments({ g }: { g: CellGeometry }) {
  const half = THICK / 2;
  const line = THIN / 2;
  const common = "pointer-events-none absolute bg-neutral-800";
  return (
    <>
      {g.thickRight && (
        <div
          aria-hidden="true"
          data-edge="right"
          data-row={g.row}
          data-col={g.col}
          className={common}
          style={{
            left: `calc(var(--cell) * ${g.col + 1} - ${line + half}px)`,
            top: `calc(var(--cell) * ${g.row} - ${line + half}px)`,
            width: THICK,
            height: `calc(var(--cell) + ${THICK}px)`,
          }}
        />
      )}
      {g.thickBottom && (
        <div
          aria-hidden="true"
          data-edge="bottom"
          data-row={g.row}
          data-col={g.col}
          className={common}
          style={{
            left: `calc(var(--cell) * ${g.col} - ${line + half}px)`,
            top: `calc(var(--cell) * ${g.row + 1} - ${line + half}px)`,
            width: `calc(var(--cell) + ${THICK}px)`,
            height: THICK,
          }}
        />
      )}
    </>
  );
}
