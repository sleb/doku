import type { ReactNode } from "react";

interface GameLayoutProps {
  header: ReactNode;
  board: ReactNode;
  controls?: ReactNode;
}

/**
 * Responsive game screen grid. Tall: header / board / controls stacked. Wide
 * (container aspect >= 1.2): board on the left, header and controls in a side
 * column. The board area is a size container so the board sizes from it.
 */
export function GameLayout({ header, board, controls }: GameLayoutProps) {
  return (
    <div className="game-layout">
      <div data-area="header" className="game-header">
        {header}
      </div>
      <div data-area="board" className="game-board-area">
        {board}
      </div>
      <div data-area="controls" className="game-controls">
        {controls}
      </div>
    </div>
  );
}
