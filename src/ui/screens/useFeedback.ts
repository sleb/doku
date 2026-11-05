import { useEffect, useRef } from "react";
import type { StoreApi } from "zustand/vanilla";
import { Cell, type Level } from "../../engine";
import { LEVELS, levelIndex } from "../../levels/campaign";
import { haptics } from "../../platform/haptics";
import { outcomeFor } from "../../platform/outcome";
import { sound } from "../../platform/sound";
import { MAX_HEARTS } from "../../store/game";
import { type GameStore, gameStore } from "../../store/gameStore";
import { progressStore } from "../../store/progress";
import { settingsStore } from "../../store/settings";
import {
  announce,
  announceLevelStart,
  announcePause,
  announceResume,
} from "../a11y/announce";
import { announcerStore } from "../a11y/announcerStore";
import { fxStore } from "../fx/fxStore";

/** How long an outcome stays in `fxStore` (longer than any effect). */
export const FX_MS = 350;

const faces = (b: GameStore["board"]) =>
  b ? b.filter((c) => c === Cell.Face).length : 0;

export interface FeedbackOptions {
  /** Speak no hearts: the tutorial does not show them. */
  tutorial?: boolean;
  /** Position of a level in its campaign, or null to skip the level text. */
  describeLevel?: (level: Level) => { number: number; count: number } | null;
}

const campaignPosition: NonNullable<FeedbackOptions["describeLevel"]> = (
  level,
) => {
  const i = levelIndex(level.id);
  return i < 0 ? null : { number: i + 1, count: LEVELS.length };
};

/** A just-started attempt: nothing placed, no time, no hearts lost. */
const fresh = (s: GameStore) =>
  s.status === "playing" &&
  s.elapsedMs === 0 &&
  s.hearts === MAX_HEARTS &&
  s.hintsUsed === 0 &&
  s.history.length === 0 &&
  s.future.length === 0 &&
  s.board.every((c) => c === Cell.Empty);

/**
 * Plays feedback for the outcome of each store change: haptics, sound, effects
 * and screen-reader announcements. Subscribes once.
 */
export function useFeedback(
  store: StoreApi<GameStore> = gameStore,
  options: FeedbackOptions = {},
) {
  // Read at event time, so inline options never resubscribe.
  const opts = useRef(options);
  opts.current = options;
  useEffect(() => {
    let pauseAnnounced = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      clearTimeout(timer);
      timer = undefined;
      fxStore.getState().clear();
    };
    const unsubscribe = store.subscribe((next, prev) => {
      const outcome = outcomeFor(prev, next);
      if (!outcome) {
        // A new level, restart or restore must never animate or replay.
        const reset =
          next.level !== prev.level ||
          prev.status !== "playing" ||
          next.hearts > prev.hearts ||
          faces(next.board) < faces(prev.board);
        if (reset) {
          clear();
          announcerStore.getState().reset();
        }
        const say = announcerStore.getState().say;
        if (next.status === "idle") return;
        if (fresh(next) && next.board !== prev.board) {
          const pos = (opts.current.describeLevel ?? campaignPosition)(
            next.level,
          );
          if (pos)
            say(announceLevelStart(pos.number, pos.count, next.level.size));
        } else if (prev.status === "playing" && next.status === "paused") {
          // The first-run Rules dialog forces a pause; it announces itself.
          pauseAnnounced = settingsStore.getState().seenTutorial;
          if (pauseAnnounced) say(announcePause());
        } else if (prev.status === "paused" && next.status === "playing") {
          if (pauseAnnounced) say(announceResume());
          pauseAnnounced = false;
        }
        return;
      }
      fxStore.getState().set(outcome);
      if (next.level)
        announcerStore.getState().say(
          announce(outcome, {
            size: next.level.size,
            tutorial: opts.current.tutorial,
            elapsedMs: next.elapsedMs,
            bestMs: progressStore.getState().bestMs[next.level.id],
          }),
        );
      clearTimeout(timer);
      timer = setTimeout(clear, FX_MS);
      const settings = settingsStore.getState();
      if (settings.haptics) void haptics.play(outcome.kind);
      if (settings.sound && next.level)
        void sound.play(outcome.kind, outcome.faces, next.level.size);
    });
    return () => {
      unsubscribe();
      clear();
      announcerStore.getState().reset();
    };
  }, [store]);

  // Capture phase, so unlock runs before a cell handler plays the first cue.
  // Audio starts suspended until a user-activation gesture (pointerdown is
  // not one on touch). Keep trying until the context is actually running.
  useEffect(() => {
    const events = ["pointerup", "touchend", "click", "keydown"] as const;
    const remove = () => {
      for (const e of events) window.removeEventListener(e, unlock, true);
    };
    const unlock = () => {
      void sound.unlock().then((running) => {
        if (running) remove();
      });
    };
    for (const e of events) window.addEventListener(e, unlock, true);
    const suspend = () => sound.suspend();
    const onVisibility = () =>
      document.visibilityState === "hidden" ? sound.suspend() : sound.resume();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", suspend);
    return () => {
      remove();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", suspend);
    };
  }, []);
}
