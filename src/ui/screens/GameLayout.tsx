import type { ReactNode } from "react";

interface GameLayoutProps {
  header: ReactNode;
  board: ReactNode;
  controls?: ReactNode;
  inert?: boolean;
}

/**
 * Responsive game screen grid. Tall: header / board / controls stacked. Wide
 * (container aspect >= 1.2): board on the left, header and controls in a side
 * column. The board area is a size container so the board sizes from it.
 */
export function GameLayout({
  header,
  board,
  controls,
  inert,
}: GameLayoutProps) {
  return (
    <div
      inert={inert}
      className={`game-layout${controls ? "" : " game-layout--no-controls"}`}
    >
      <div data-area="header" className="game-header">
        {header}
      </div>
      <div data-area="board" className="game-board-area">
        {board}
      </div>
      {controls ? (
        <div data-area="controls" className="game-controls">
          {controls}
        </div>
      ) : null}
    </div>
  );
}
