import { type CSSProperties, useMemo } from "react";
import { type Board as BoardData, Cell, type Level } from "../../engine";
import { CellView } from "./Cell";
import { cellGeometry } from "./geometry";

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
  // An ARIA grid on a CSS grid; native <table> does not fit, and the focusable
  // element is the inner button (BOARD_DESIGN 4.2).
  const gridAria = {
    role: "grid",
    "aria-label": "Puzzle board",
    "aria-rowcount": size,
    "aria-colcount": size,
  } as const;
  const grid = (
    <div
      {...gridAria}
      className="grid w-max border-4 border-neutral-800"
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
                thickRight={g.thickRight}
                thickBottom={g.thickBottom}
                state={board[g.index]}
                isWrong={wrong.has(g.index)}
                isConflict={conflicts.has(g.index)}
                disabled={
                  disabled || board[g.index] === Cell.Face || wrong.has(g.index)
                }
                onToggleMark={onToggleMark}
                onPlaceFace={onPlaceFace}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
  return grid;
}
