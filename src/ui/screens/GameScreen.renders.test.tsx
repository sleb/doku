import { act, render } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { LEVELS } from "../../levels/campaign";
import { idleState } from "../../store/game";
import { gameStore } from "../../store/gameStore";
import { defaultSettings, settingsStore } from "../../store/settings";

const boardRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock("../board/Board", async (importActual) => {
  const actual = await importActual<typeof import("../board/Board")>();
  return {
    Board: (props: Parameters<typeof actual.Board>[0]) => {
      boardRenders.count++;
      return actual.Board(props);
    },
  };
});

import { GameScreen } from "./GameScreen";

beforeEach(() => {
  gameStore.setState(idleState, false);
  settingsStore.setState({ ...defaultSettings, seenRules: true });
});

test("a clock tick does not re-render the board", () => {
  act(() => gameStore.getState().startLevel(LEVELS[0]));
  render(<GameScreen />);
  boardRenders.count = 0;
  act(() => gameStore.getState().tick(500));
  act(() => gameStore.getState().tick(500));
  expect(boardRenders.count).toBe(0);
});
