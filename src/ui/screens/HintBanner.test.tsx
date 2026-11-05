import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { uniqueLevel7 } from "../../engine/__fixtures__/levels";
import { idleState } from "../../store/game";
import { gameStore } from "../../store/gameStore";
import { settingsStore } from "../../store/settings";
import { HintBanner } from "./HintBanner";

beforeEach(() => {
  settingsStore.getState().set({ palette: "default", patterns: false });
  gameStore.setState(idleState, false);
  gameStore.getState().startLevel(uniqueLevel7);
});

describe("HintBanner", () => {
  test("is empty until a hint is shown", () => {
    render(<HintBanner />);
    expect(screen.getByTestId("hint-banner").textContent).toBe("");
  });

  test("shows the hint's message and clears with it", () => {
    render(<HintBanner />);
    act(() => gameStore.getState().hint());
    expect(screen.getByTestId("hint-banner").textContent).toMatch(
      /only one cell left/,
    );
    act(() => gameStore.getState().toggleMark(0));
    expect(screen.getByTestId("hint-banner").textContent).toBe("");
  });

  test("is not a live region: the announcer is the one speaker", () => {
    render(<HintBanner />);
    act(() => gameStore.getState().hint());
    const banner = screen.getByTestId("hint-banner");
    expect(banner.getAttribute("role")).toBeNull();
    expect(banner.getAttribute("aria-live")).toBeNull();
  });

  test("names regions by number under the accessible palette", () => {
    settingsStore.getState().set({ palette: "accessible" });
    render(<HintBanner />);
    act(() => gameStore.getState().hint());
    expect(screen.getByTestId("hint-banner").textContent).toMatch(/egion \d/);
    expect(screen.getByTestId("hint-banner").textContent).not.toMatch(
      /the \w+ region/,
    );
  });

  test("renders empty while idle", () => {
    gameStore.setState(idleState, false);
    render(<HintBanner />);
    expect(screen.getByTestId("hint-banner").textContent).toBe("");
  });
});
