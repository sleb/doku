import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { uniqueLevel7 } from "../../engine/__fixtures__/levels";
import { idleState } from "../../store/game";
import { gameStore } from "../../store/gameStore";
import { HintBanner } from "./HintBanner";

beforeEach(() => {
  gameStore.setState(idleState, false);
  gameStore.getState().startLevel(uniqueLevel7);
});

describe("HintBanner", () => {
  test("is an empty status region until a hint is shown", () => {
    render(<HintBanner />);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  test("shows the hint's message and clears with it", () => {
    render(<HintBanner />);
    act(() => gameStore.getState().hint());
    expect(screen.getByRole("status").textContent).toMatch(
      /only one cell left/,
    );
    act(() => gameStore.getState().toggleMark(0));
    expect(screen.getByRole("status").textContent).toBe("");
  });

  test("renders an empty region while idle", () => {
    gameStore.setState(idleState, false);
    render(<HintBanner />);
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
