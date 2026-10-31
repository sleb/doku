import { type CSSProperties, useMemo } from "react";
import type { Board as BoardData, Level } from "../../engine";
import { CellView } from "./Cell";
import { cellGeometry } from "./geometry";

export interface BoardProps {
  level: Level;
  board: BoardData;
  wrong: ReadonlySet<number>;
  conflicts: ReadonlySet<number>;
}

export function Board({ level, board, wrong, conflicts }: BoardProps) {
  const { size } = level;
  const geometry = useMemo(() => cellGeometry(level), [level]);
  const style = {
    "--n": size,
    "--cell":
      "min(calc((100vw - 2rem) / var(--n)), calc((100vh - 9rem) / var(--n)), 4.5rem)",
    gridTemplateColumns: "repeat(var(--n), var(--cell))",
    gridAutoRows: "var(--cell)",
  } as CSSProperties;
  const rows = Array.from({ length: size }, (_, r) =>
    geometry.slice(r * size, (r + 1) * size),
  );
  return (
    <div
      role="grid"
      aria-label="Puzzle board"
      aria-rowcount={size}
      aria-colcount={size}
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
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
