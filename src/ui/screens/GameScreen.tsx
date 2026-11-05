import { useEffect, useMemo, useRef, useState } from "react";
import { nextLevel, startOver } from "../../app/campaign";
import { LEVELS, levelIndex } from "../../levels/campaign";
import { gameStore, useGameStore } from "../../store/gameStore";
import { useProgressStore } from "../../store/progress";
import { conflictCells } from "../../store/selectors";
import { useSettingsStore } from "../../store/settings";
import { Announcer } from "../a11y/Announcer";
import { useInputModeAnnouncement } from "../a11y/useInputModeAnnouncement";
import { Board } from "../board/Board";
import { TopBar } from "../hud/TopBar";
import { ActionBar } from "./ActionBar";
import { GameLayout } from "./GameLayout";
import { PauseDialog } from "./PauseDialog";
import { ResultModal } from "./ResultModal";
import { ResultSkip } from "./ResultSkip";
import { RulesDialog } from "./RulesDialog";
import { SettingsDialog } from "./SettingsDialog";
import { useAutoPause } from "./useAutoPause";
import { useClock } from "./useClock";
import {
  LOSE_DELAY_MS,
  useDelayedStatus,
  WIN_DELAY_MS,
} from "./useDelayedStatus";
import { useFeedback } from "./useFeedback";
import { useHoldRamp } from "./useHoldRamp";
import { useShortcuts } from "./useShortcuts";

export function GameScreen({
  onReplayTutorial,
}: {
  /** Pause > Replay tutorial: the app shows the tutorial over this paused game. */
  onReplayTutorial: () => void;
}) {
  const level = useGameStore((s) => s.level);
  const status = useGameStore((s) => s.status);
  const board = useGameStore((s) => s.board);
  const hearts = useGameStore((s) => s.hearts);
  const wrong = useGameStore((s) => ("wrong" in s ? s.wrong : undefined));
  // Only the win result shows the time, and the clock is stopped by then; any
  // other status reads 0 so clock ticks do not re-render the screen and board.
  const elapsedMs = useGameStore((s) => (s.status === "won" ? s.elapsedMs : 0));
  const hintsUsed = useGameStore((s) => ("hintsUsed" in s ? s.hintsUsed : 0));
  const bestMs = useProgressStore((s) =>
    level ? s.bestMs[level.id] : undefined,
  );
  const { restart, toggleMark, placeFace, pause, resume } =
    gameStore.getState();
  const inputMode = useSettingsStore((s) => s.inputMode);
  const palette = useSettingsStore((s) => s.palette);
  const patterns = useSettingsStore((s) => s.patterns);
  const [sheet, setSheet] = useState<"rules" | "settings" | null>(null);
  const holdOwner = useRef<number | null>(null);
  const boardArea = useRef<HTMLDivElement>(null);
  const wasPaused = useRef(false);
  const result = useDelayedStatus(status, WIN_DELAY_MS, LOSE_DELAY_MS);
  useClock();
  useAutoPause();
  useShortcuts({ holdOwner });
  useFeedback();
  useInputModeAnnouncement();
  const onHoldGlow = useHoldRamp();

  // Back from a pause, hand focus to the board's active cell if it fell to the
  // page (the board is hidden while paused, so it cannot hold focus then).
  useEffect(() => {
    if (status === "paused") wasPaused.current = true;
    else if (status === "playing" && wasPaused.current) {
      wasPaused.current = false;
      const a = document.activeElement;
      if (!a || a === document.body)
        boardArea.current
          ?.querySelector<HTMLElement>("[tabindex='0']")
          ?.focus();
    }
  }, [status]);

  const conflicts = useMemo(
    () => (board && level ? conflictCells(board, level) : new Set<number>()),
    [board, level],
  );

  if (status === "idle" || !level || !board || !wrong) return null;

  const levelNumber = levelIndex(level.id) + 1;
  const paused = status === "paused";
  const finished = status === "won" || status === "lost";
  return (
    <>
      <Announcer />
      <GameLayout
        inert={result.pending}
        header={
          <TopBar
            level={level}
            levelNumber={levelNumber}
            levelCount={LEVELS.length}
            hearts={hearts}
            onPause={pause}
          />
        }
        board={
          <div
            ref={boardArea}
            inert={finished || paused}
            style={paused ? { visibility: "hidden" } : undefined}
          >
            <Board
              level={level}
              board={board}
              wrong={wrong}
              conflicts={conflicts}
              disabled={finished || paused}
              inputMode={inputMode}
              palette={palette}
              patterns={patterns}
              celebrate={result.pending && status === "won"}
              onToggleMark={toggleMark}
              onPlaceFace={placeFace}
              holdOwner={holdOwner}
              onHoldGlow={onHoldGlow}
            />
          </div>
        }
        controls={<ActionBar />}
      />
      {sheet === "rules" && <RulesDialog onClose={() => setSheet(null)} />}
      {sheet === "settings" && (
        <SettingsDialog
          onClose={() => setSheet(null)}
          onStartOver={() => {
            startOver();
            pause();
          }}
        />
      )}
      <PauseDialog
        open={paused && sheet === null}
        onResume={resume}
        onRestart={restart}
        onRules={() => setSheet("rules")}
        onReplayTutorial={onReplayTutorial}
        onSettings={() => setSheet("settings")}
      />
      {result.pending && <ResultSkip onSkip={result.skip} />}
      <ResultModal
        status={result.status}
        elapsedMs={elapsedMs}
        bestMs={bestMs}
        hintsUsed={hintsUsed}
        isLast={levelNumber === LEVELS.length}
        onRetry={restart}
        onNext={nextLevel}
      />
    </>
  );
}
