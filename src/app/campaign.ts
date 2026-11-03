// Campaign flow: ties the game store to the player's progress. Not to be
// confused with src/levels/campaign.ts, which is only the ordered level list.
import { levelIndex } from "../levels/campaign";
import { idleState } from "../store/game";
import { gameStore } from "../store/gameStore";
import { currentLevel, progressStore } from "../store/progress";

/** Records progress when a game transitions into `won`. Returns unsubscribe. */
export function recordWins(): () => void {
  return gameStore.subscribe((state, prev) => {
    if (state.status !== "won" || prev.status === "won") return;
    progressStore
      .getState()
      .record(levelIndex(state.level.id), state.elapsedMs);
  });
}

/** Starts the level progress points at; goes idle when the campaign is done. */
export function startCurrent(): void {
  const level = currentLevel(progressStore.getState());
  if (level) gameStore.getState().startLevel(level);
  else gameStore.setState(idleState);
}

/** Alias for the "Next level" / "Finish" buttons. */
export function nextLevel(): void {
  startCurrent();
}

/** Rewinds to level 1 (best times are kept) and starts it. */
export function startOver(): void {
  progressStore.getState().startOver();
  startCurrent();
}
