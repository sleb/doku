import { useEffect, useMemo } from "react";
import type { Level } from "../../engine";
import { feedbackFor } from "../../platform/feedback";
import { haptics } from "../../platform/haptics";
import { idleState } from "../../store/game";
import { gameStore, useGameStore } from "../../store/gameStore";
import { conflictCells } from "../../store/selectors";
import { Board } from "../board/Board";
import { TopBar } from "../hud/TopBar";
import { GameLayout } from "./GameLayout";
import { ResultModal } from "./ResultModal";

export function GameScreen({ level }: { level: Level }) {
  const storeLevel = useGameStore((s) => s.level);
  const status = useGameStore((s) => s.status);
  const board = useGameStore((s) => s.board);
  const hearts = useGameStore((s) => s.hearts);
  const wrong = useGameStore((s) => ("wrong" in s ? s.wrong : undefined));
  const { startLevel, restart, toggleMark, placeFace } = gameStore.getState();

  // The store is a singleton: reset it on unmount so a later mount never sees
  // this one's board or result.
  useEffect(() => {
    startLevel(level);
    return () => gameStore.setState(idleState, false);
  }, [startLevel, level]);

  // Buzz for the outcome of each store change. Subscribed once per mount, so the
  // unmount reset to idle (prev is not "playing") stays silent.
  useEffect(
    () =>
      gameStore.subscribe((next, prev) => {
        const kind = feedbackFor(prev, next);
        if (kind) void haptics.play(kind);
      }),
    [],
  );

  // Still needed: on the first render of a new `level` prop the store holds the
  // previous level's board until the effect above has run.
  const fresh = storeLevel === level;
  const conflicts = useMemo(
    () => (board && fresh ? conflictCells(board, level) : new Set<number>()),
    [board, level, fresh],
  );

  if (!fresh || status === "idle" || !board || !wrong) return null;

  const finished = status !== "playing";
  return (
    <>
      <GameLayout
        header={<TopBar level={level} hearts={hearts} />}
        board={
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
        }
      />
      <ResultModal status={status} onRetry={restart} />
    </>
  );
}
