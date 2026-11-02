import {
  type CSSProperties,
  type RefObject,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Board as BoardData, Level } from "../../engine";
import { isLocked } from "../../store/game";
import { CellView } from "./Cell";
import { type CellGeometry, cellGeometry } from "./geometry";
import { useNoDoubleTapLoupe } from "./useNoDoubleTapLoupe";

export interface BoardProps {
  level: Level;
  board: BoardData;
  wrong: ReadonlySet<number>;
  conflicts: ReadonlySet<number>;
  /** True when the game is not `playing`; locks the whole board. */
  disabled: boolean;
  onToggleMark: (index: number) => void;
  onPlaceFace: (index: number) => void;
  /** Index of the cell being held, if any. GameScreen owns it so shortcuts can see it; defaults to an internal ref. */
  holdOwner?: RefObject<number | null>;
}

export function Board({
  level,
  board,
  wrong,
  conflicts,
  disabled,
  onToggleMark,
  onPlaceFace,
  holdOwner: sharedHoldOwner,
}: BoardProps) {
  const { size } = level;
  const ownHoldOwner = useRef<number | null>(null);
  const holdOwner = sharedHoldOwner ?? ownHoldOwner;
  const [active, setActive] = useState(0);
  // A new level starts with the first cell tabbable (state adjusted in render).
  const [activeLevel, setActiveLevel] = useState(level);
  if (activeLevel !== level) {
    setActiveLevel(level);
    setActive(0);
  }
  const gridRef = useNoDoubleTapLoupe<HTMLDivElement>();
  const geometry = useMemo(() => cellGeometry(level), [level]);
  const style = {
    "--n": size,
    "--cell":
      // Sized from the board area's container (GameLayout). Budgets subtract the frame's border-4 (2 x 4px) so large boards fit.
      "min(calc((100cqw - 8px) / var(--n)), calc((100cqh - 8px) / var(--n)), 4.5rem)",
    gridTemplateColumns: "repeat(var(--n), var(--cell))",
    gridAutoRows: "var(--cell)",
  } as CSSProperties;
  const rows = Array.from({ length: size }, (_, r) =>
    geometry.slice(r * size, (r + 1) * size),
  );
  return (
    // biome-ignore lint/a11y/useSemanticElements: ARIA grid on a CSS grid; the focusable element is the inner button (BOARD_DESIGN 4.2)
    <div
      ref={gridRef}
      role="grid"
      aria-label="Puzzle board"
      aria-rowcount={size}
      aria-colcount={size}
      onKeyDown={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        const i = Number((e.target as HTMLElement).dataset.index);
        const row = Math.floor(i / size);
        const col = i % size;
        let target: number;
        if (e.key === "Home") target = row * size;
        else if (e.key === "End") target = row * size + size - 1;
        else if (e.key === "ArrowRight") target = i + (col < size - 1 ? 1 : 0);
        else if (e.key === "ArrowLeft") target = i - (col > 0 ? 1 : 0);
        else if (e.key === "ArrowDown")
          target = i + (row < size - 1 ? size : 0);
        else if (e.key === "ArrowUp") target = i - (row > 0 ? size : 0);
        else return;
        e.preventDefault();
        gridRef.current
          ?.querySelector<HTMLElement>(`[data-index="${target}"]`)
          ?.focus();
      }}
      onFocus={(e) => {
        const i = (e.target as HTMLElement).dataset.index;
        if (i !== undefined) setActive(Number(i));
      }}
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
                tabIndex={g.index === active ? 0 : -1}
                onToggleMark={onToggleMark}
                onPlaceFace={onPlaceFace}
                holdOwner={holdOwner}
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
