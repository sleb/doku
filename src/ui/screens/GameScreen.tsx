import { useEffect, useMemo, useState } from "react";
import type { Level } from "../../engine";
import { feedbackFor } from "../../platform/feedback";
import { haptics } from "../../platform/haptics";
import { idleState } from "../../store/game";
import { gameStore, useGameStore } from "../../store/gameStore";
import { conflictCells } from "../../store/selectors";
import { settingsStore, useSettingsStore } from "../../store/settings";
import { Board } from "../board/Board";
import { TopBar } from "../hud/TopBar";
import { ActionBar } from "./ActionBar";
import { GameLayout } from "./GameLayout";
import { PauseDialog } from "./PauseDialog";
import { ResultModal } from "./ResultModal";
import { RulesDialog } from "./RulesDialog";
import { SettingsDialog } from "./SettingsDialog";
import { useActionShortcuts } from "./useActionShortcuts";
import { useAutoPause } from "./useAutoPause";
import { useClock } from "./useClock";

export function GameScreen({ level }: { level: Level }) {
  const storeLevel = useGameStore((s) => s.level);
  const status = useGameStore((s) => s.status);
  const board = useGameStore((s) => s.board);
  const hearts = useGameStore((s) => s.hearts);
  const wrong = useGameStore((s) => ("wrong" in s ? s.wrong : undefined));
  const { startLevel, restart, toggleMark, placeFace, pause, resume } =
    gameStore.getState();
  const [sheet, setSheet] = useState<"rules" | "settings" | null>(null);
  useClock();
  useAutoPause();
  useActionShortcuts();

  // The store is a singleton: reset it on unmount so a later mount never sees
  // this one's board or result.
  useEffect(() => {
    startLevel(level);
    return () => gameStore.setState(idleState, false);
  }, [startLevel, level]);

  // Buzz for the outcome of each store change. Subscribed once per mount. The
  // unmount reset to idle stays silent even mid-game: idle has full hearts and
  // no board, so there is no heart drop, no face increase, and status is idle.
  useEffect(
    () =>
      gameStore.subscribe((next, prev) => {
        const kind = feedbackFor(prev, next);
        if (kind && settingsStore.getState().haptics) void haptics.play(kind);
      }),
    [],
  );

  // Still needed: on the first render of a new `level` prop the store holds the
  // previous level's board until the effect above has run.
  const fresh = storeLevel === level;

  // First launch: Rules open over a paused game. Derived from `seenRules`
  // (set on dismissal), so StrictMode's double effects cannot reopen it.
  const seenRules = useSettingsStore((s) => s.seenRules);
  const firstRules = !seenRules && fresh && status !== "idle";
  useEffect(() => {
    if (firstRules) gameStore.getState().pause();
  }, [firstRules]);
  const conflicts = useMemo(
    () => (board && fresh ? conflictCells(board, level) : new Set<number>()),
    [board, level, fresh],
  );

  if (!fresh || status === "idle" || !board || !wrong) return null;

  const paused = status === "paused";
  const finished = status === "won" || status === "lost";
  return (
    <>
      <GameLayout
        header={<TopBar level={level} hearts={hearts} onPause={pause} />}
        board={
          <div
            inert={finished || paused}
            style={paused ? { visibility: "hidden" } : undefined}
          >
            <Board
              level={level}
              board={board}
              wrong={wrong}
              conflicts={conflicts}
              disabled={finished || paused}
              onToggleMark={toggleMark}
              onPlaceFace={placeFace}
            />
          </div>
        }
        controls={<ActionBar />}
      />
      {(firstRules || sheet === "rules") && (
        <RulesDialog
          onClose={() => {
            settingsStore.getState().set({ seenRules: true });
            setSheet(null);
            if (firstRules) resume();
          }}
        />
      )}
      {sheet === "settings" && (
        <SettingsDialog onClose={() => setSheet(null)} />
      )}
      <PauseDialog
        open={paused && !firstRules && sheet === null}
        onResume={resume}
        onRestart={restart}
        onRules={() => setSheet("rules")}
        onSettings={() => setSheet("settings")}
      />
      <ResultModal status={status} onRetry={restart} />
    </>
  );
}
