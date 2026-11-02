import { beforeEach, describe, expect, test } from "vitest";
import { LEVELS } from "../levels/campaign";
import { idleState, startLevel } from "../store/game";
import { gameStore } from "../store/gameStore";
import { defaultProgress, progressStore } from "../store/progress";
import { nextLevel, recordWins, startCurrent, startOver } from "./campaign";

const win = (index: number, elapsedMs: number) =>
  gameStore.setState({
    ...startLevel(LEVELS[index]),
    status: "won",
    elapsedMs,
  });

beforeEach(() => {
  gameStore.setState(idleState);
  progressStore.setState(defaultProgress);
});

describe("recordWins", () => {
  test("a win records the next level and the best time", () => {
    const stop = recordWins();
    win(2, 7000);
    stop();
    const { next, bestMs } = progressStore.getState();
    expect({ next, bestMs }).toEqual({
      next: 3,
      bestMs: { [LEVELS[2].id]: 7000 },
    });
  });

  test("further changes while won do not record again", () => {
    const stop = recordWins();
    win(0, 5000);
    gameStore.setState({ elapsedMs: 1 });
    stop();
    expect(progressStore.getState().bestMs[LEVELS[0].id]).toBe(5000);
  });

  test("replaying an earlier level does not move next", () => {
    const stop = recordWins();
    win(2, 7000);
    gameStore.setState(idleState);
    win(0, 5000);
    stop();
    expect(progressStore.getState().next).toBe(3);
  });
});

describe("startCurrent", () => {
  test("starts the level at progress.next", () => {
    progressStore.setState({ next: 2, bestMs: {} });
    startCurrent();
    expect(gameStore.getState().level).toBe(LEVELS[2]);
    expect(gameStore.getState().status).toBe("playing");
  });

  test("leaves the game idle once the campaign is finished", () => {
    win(0, 1000);
    progressStore.setState({ next: LEVELS.length, bestMs: {} });
    startCurrent();
    expect(gameStore.getState().status).toBe("idle");
  });
});

describe("nextLevel", () => {
  test("starts the level after the one just won", () => {
    const stop = recordWins();
    win(1, 3000);
    nextLevel();
    stop();
    expect(gameStore.getState().level).toBe(LEVELS[2]);
  });
});

describe("startOver", () => {
  test("rewinds to level 1, keeps best times and starts it", () => {
    progressStore.setState({ next: 4, bestMs: { [LEVELS[0].id]: 2000 } });
    startOver();
    const { next, bestMs } = progressStore.getState();
    expect({ next, bestMs }).toEqual({
      next: 0,
      bestMs: { [LEVELS[0].id]: 2000 },
    });
    expect(gameStore.getState().level).toBe(LEVELS[0]);
    expect(gameStore.getState().status).toBe("playing");
  });
});
