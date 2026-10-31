import { useEffect, useMemo } from "react";
import type { Level } from "../../engine";
import { gameStore, useGameStore } from "../../store/gameStore";
import { conflictCells } from "../../store/selectors";
import { Board } from "../board/Board";
import { TopBar } from "../hud/TopBar";
import { ResultModal } from "./ResultModal";

export function GameScreen({ level }: { level: Level }) {
  const status = useGameStore((s) => s.status);
  const board = useGameStore((s) => s.board);
  const hearts = useGameStore((s) => s.hearts);
  const wrong = useGameStore((s) => ("wrong" in s ? s.wrong : undefined));
  const { startLevel, restart, toggleMark, placeFace } = gameStore.getState();

  useEffect(() => {
    startLevel(level);
  }, [startLevel, level]);

  const conflicts = useMemo(
    () => (board ? conflictCells(board, level) : new Set<number>()),
    [board, level],
  );

  if (status === "idle" || !board || !wrong) return null;

  const finished = status !== "playing";
  return (
    <>
      <TopBar level={level} hearts={hearts} />
      <div inert={finished}>
        <Board
          level={level}
          board={board}
          wrong={wrong}
          conflicts={conflicts}
          disabled={finished}
          onToggleMark={toggleMark}
          onPlaceFace={placeFace}
        />
      </div>
      <ResultModal status={status} onRetry={restart} />
    </>
  );
}
