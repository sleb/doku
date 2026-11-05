import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { Cell } from "../../engine";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { idleState, MAX_HEARTS } from "../../store/game";
import { gameStore } from "../../store/gameStore";
import { ActionBar } from "./ActionBar";

const undoBtn = () => screen.getByRole("button", { name: "Undo" });
const redoBtn = () => screen.getByRole("button", { name: "Redo" });
const hintBtn = () =>
  screen.getByRole("button", { name: /^Hint, costs one heart$/ });
const cellAt = (i: number) => {
  const s = gameStore.getState();
  if (s.status === "idle") throw new Error("idle");
  return s.board[i];
};

beforeEach(() => {
  gameStore.setState(idleState, false);
  gameStore.getState().startLevel(level);
});

describe("ActionBar", () => {
  test("has real Undo and Redo buttons, both disabled on a fresh level", () => {
    render(<ActionBar />);
    expect((undoBtn() as HTMLButtonElement).disabled).toBe(true);
    expect((redoBtn() as HTMLButtonElement).disabled).toBe(true);
  });

  test("buttons are at least 44px", () => {
    render(<ActionBar />);
    for (const b of [undoBtn(), redoBtn()]) {
      expect(b.className).toMatch(/min-h-11/);
      expect(b.className).toMatch(/min-w-11/);
    }
  });

  test("undo and redo flow", async () => {
    const user = userEvent.setup();
    render(<ActionBar />);
    gameStore.getState().toggleMark(4);
    expect(await screen.findByRole("button", { name: "Undo" })).toBeTruthy();
    expect((undoBtn() as HTMLButtonElement).disabled).toBe(false);
    expect((redoBtn() as HTMLButtonElement).disabled).toBe(true);
    await user.click(undoBtn());
    expect(cellAt(4)).toBe(Cell.Empty);
    expect((undoBtn() as HTMLButtonElement).disabled).toBe(true);
    expect((redoBtn() as HTMLButtonElement).disabled).toBe(false);
    await user.click(redoBtn());
    expect(cellAt(4)).toBe(Cell.Mark);
    expect((redoBtn() as HTMLButtonElement).disabled).toBe(true);
  });

  test("a new toggle after undo disables Redo", async () => {
    const user = userEvent.setup();
    render(<ActionBar />);
    gameStore.getState().toggleMark(4);
    await user.click(undoBtn());
    expect((redoBtn() as HTMLButtonElement).disabled).toBe(false);
    gameStore.getState().toggleMark(5);
    await screen.findByRole("button", { name: "Redo" });
    expect((redoBtn() as HTMLButtonElement).disabled).toBe(true);
  });

  test("both disabled when paused, won or lost", () => {
    gameStore.getState().toggleMark(4);
    gameStore.getState().toggleMark(5);
    gameStore.getState().undo();
    for (const status of ["paused", "won", "lost"] as const) {
      gameStore.setState({ status }, false);
      const { unmount } = render(<ActionBar />);
      expect((undoBtn() as HTMLButtonElement).disabled).toBe(true);
      expect((redoBtn() as HTMLButtonElement).disabled).toBe(true);
      unmount();
    }
  });

  test("Hint is enabled with 3 and 2 hearts, disabled on the last", async () => {
    const user = userEvent.setup();
    render(<ActionBar />);
    expect((hintBtn() as HTMLButtonElement).disabled).toBe(false);
    await user.click(hintBtn());
    expect(gameStore.getState().hearts).toBe(MAX_HEARTS - 1);
    expect((hintBtn() as HTMLButtonElement).disabled).toBe(false);
    await user.click(hintBtn());
    expect(gameStore.getState().hearts).toBe(1);
    expect((hintBtn() as HTMLButtonElement).disabled).toBe(true);
  });

  test("clicking Hint places the ladder's first face", async () => {
    const user = userEvent.setup();
    render(<ActionBar />);
    await user.click(hintBtn());
    expect(cellAt(4 * level.size + 2)).toBe(Cell.Face);
  });

  test("an elimination hint spends a heart and writes no marks", async () => {
    const user = userEvent.setup();
    render(<ActionBar />);
    await user.click(hintBtn());
    const before = Array.from(gameStore.getState().board ?? []);
    await user.click(hintBtn());
    expect(Array.from(gameStore.getState().board ?? [])).toEqual(before);
    expect(gameStore.getState().hearts).toBe(1);
  });

  test("Hint shows a non-wrapping cost marker and is 44px", () => {
    render(<ActionBar />);
    expect(hintBtn().textContent).toBe("Hint-1 ♥");
    const cost = hintBtn().querySelector("span");
    expect(cost?.className).toMatch(/whitespace-nowrap/);
    expect(hintBtn().className).toMatch(/min-h-11/);
    expect(hintBtn().className).toMatch(/min-w-11/);
  });

  test("Hint is disabled when paused, won or lost", () => {
    for (const status of ["paused", "won", "lost"] as const) {
      gameStore.setState({ status }, false);
      const { unmount } = render(<ActionBar />);
      expect((hintBtn() as HTMLButtonElement).disabled).toBe(true);
      unmount();
    }
  });

  test("renders disabled buttons while idle", () => {
    gameStore.setState(idleState, false);
    render(<ActionBar />);
    expect((undoBtn() as HTMLButtonElement).disabled).toBe(true);
    expect((redoBtn() as HTMLButtonElement).disabled).toBe(true);
    expect((hintBtn() as HTMLButtonElement).disabled).toBe(true);
  });
});
