import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { prefersReducedMotion } from "../app/motion";
import { idleState, type Started, startLevel } from "../store/game";
import { createGameStore, type GameStore } from "../store/gameStore";
import { useSettingsStore } from "../store/settings";
import { Announcer } from "../ui/a11y/Announcer";
import { announcerStore } from "../ui/a11y/announcerStore";
import { useInputModeAnnouncement } from "../ui/a11y/useInputModeAnnouncement";
import { Board } from "../ui/board/Board";
import { Hearts } from "../ui/hud/Hearts";
import { ActionBar } from "../ui/screens/ActionBar";
import { GameLayout } from "../ui/screens/GameLayout";
import { useFeedback } from "../ui/screens/useFeedback";
import { useHoldRamp } from "../ui/screens/useHoldRamp";
import { useShortcuts } from "../ui/screens/useShortcuts";
import { evaluate } from "./progress";
import { STEPS, type TutorialStep } from "./steps";
import { TutorialCard } from "./TutorialCard";

/** The pause on a finished step before the next one. */
const BEAT_MS = 600;
/** How long a slip is explained before the step resets. */
const RESET_MS = 900;

const none: ReadonlySet<number> = new Set();

const stepText = (i: number) =>
  `Step ${i + 1} of ${STEPS.length}: ${STEPS[i].title}. ${STEPS[i].body}`;

const stepState = (step: TutorialStep): Started => ({
  ...(startLevel(step.level) as Started),
  board: step.start,
});

/**
 * Put step `i` on the private store. Through idle, so the store never reports
 * the swap as a placement; the announcer is reset by the level change, so the
 * step text is spoken after.
 */
function load(store: StoreApi<GameStore>, i: number): void {
  store.setState(idleState);
  store.setState(stepState(STEPS[i]));
  announcerStore.getState().say(stepText(i));
}

/**
 * The guided first-run play-through (POLISH_DESIGN 7). Runs the real Board on
 * its own game store: no campaign, progress, save or clock. `onDone` fires on
 * Skip and on Finish.
 */
export function Tutorial({ onDone }: { onDone: () => void }) {
  const [store] = useState(() => {
    const s = createGameStore();
    s.setState(stepState(STEPS[0]));
    return s;
  });
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const holdOwner = useRef<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  const inputMode = useSettingsStore((s) => s.inputMode);
  const palette = useSettingsStore((s) => s.palette);
  const patterns = useSettingsStore((s) => s.patterns);

  const status = useStore(store, (s) => s.status);
  const board = useStore(store, (s) => s.board);
  const wrong = useStore(store, (s) => ("wrong" in s ? s.wrong : none));
  const hearts = useStore(store, (s) => s.hearts);
  const progress = useStore(store, (s) => evaluate(step, s));

  useFeedback(store, { tutorial: true, describeLevel: () => null });
  useInputModeAnnouncement();
  useShortcuts({
    store,
    holdOwner,
    pause: false,
    only: step.controls ?? [],
  });
  const onHoldGlow = useHoldRamp(store);

  // Move on after a finished step; explain, then reset, after a slip.
  useEffect(() => {
    if (progress === "complete" && !last) {
      const t = setTimeout(
        () => {
          load(store, index + 1);
          setIndex(index + 1);
        },
        prefersReducedMotion() ? 0 : BEAT_MS,
      );
      return () => clearTimeout(t);
    }
    if (progress === "broken") {
      // After the generic "Not there" the store's feedback just spoke.
      announcerStore.getState().say(step.onWrong);
      const t = setTimeout(() => load(store, index), RESET_MS);
      return () => clearTimeout(t);
    }
  }, [progress, index, last, store, step]);

  // The first step is announced on mount; later ones by `load`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: index is the trigger
  useEffect(() => {
    if (first.current) {
      first.current = false;
      announcerStore.getState().say(stepText(0));
    } else {
      heading.current?.focus();
    }
  }, [index]);

  const highlight = useMemo(() => new Set(step.highlight), [step]);
  if (!board || status === "idle") return null;
  const open = status === "playing" && progress === "progress";
  return (
    <>
      <Announcer />
      <GameLayout
        header={
          <TutorialCard
            step={step}
            index={index}
            total={STEPS.length}
            inputMode={inputMode}
            broken={progress === "broken"}
            hearts={
              step.showHearts ? <Hearts remaining={hearts} max={3} /> : null
            }
            onDone={onDone}
            headingRef={heading}
          />
        }
        board={
          <div inert={!open}>
            <Board
              level={step.level}
              board={board}
              wrong={wrong}
              conflicts={none}
              highlight={highlight}
              disabled={!open}
              inputMode={inputMode}
              palette={palette}
              patterns={patterns}
              onToggleMark={store.getState().toggleMark}
              onPlaceFace={store.getState().placeFace}
              holdOwner={holdOwner}
              onHoldGlow={onHoldGlow}
            />
          </div>
        }
        controls={<ActionBar store={store} only={step.controls ?? []} />}
      />
    </>
  );
}
