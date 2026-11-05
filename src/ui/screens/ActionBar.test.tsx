import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { Cell } from "../../engine";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { idleState, MAX_HEARTS } from "../../store/game";
import { createGameStore, gameStore } from "../../store/gameStore";
import { defaultSettings, settingsStore } from "../../store/settings";
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
  settingsStore.setState({ ...defaultSettings });
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

describe("ActionBar tap-mode toggle", () => {
  const toggle = () => screen.getByRole("button", { name: "Tap places faces" });

  test("is a 44px toggle, off by default, with a static label", () => {
    render(<ActionBar />);
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
    expect(toggle().textContent).toContain("Tap places faces");
    expect(toggle().className).toMatch(/min-h-11/);
    expect(toggle().className).toMatch(/min-w-11/);
  });

  test("clicking flips inputMode and aria-pressed", async () => {
    const user = userEvent.setup();
    render(<ActionBar />);
    await user.click(toggle());
    expect(settingsStore.getState().inputMode).toBe("face");
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
    expect(toggle().textContent).toContain("Tap places faces");
    await user.click(toggle());
    expect(settingsStore.getState().inputMode).toBe("mark");
  });

  test("visible text contains the accessible name (label in name)", () => {
    render(<ActionBar />);
    expect(toggle().hasAttribute("aria-label")).toBe(false);
    expect(toggle().textContent).toContain("Tap places faces");
  });

  test("follows the Settings switch", () => {
    render(<ActionBar />);
    act(() => settingsStore.getState().set({ inputMode: "face" }));
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
  });

  test("is disabled when not playing", () => {
    gameStore.getState().pause();
    render(<ActionBar />);
    expect((toggle() as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("ActionBar on a private store", () => {
  const priv = () => {
    const store = createGameStore();
    store.getState().startLevel(level);
    return store;
  };

  test("drives the given store, not the singleton", async () => {
    const store = priv();
    store.getState().toggleMark(1);
    render(<ActionBar store={store} />);
    await userEvent.click(undoBtn());
    const s = store.getState();
    if (s.status === "idle") throw new Error("idle");
    expect(s.future).toEqual([1]);
    const g = gameStore.getState();
    if (g.status === "idle") throw new Error("idle");
    expect(g.future).toEqual([]);
  });

  test("only limits the action buttons; the mode toggle always shows", () => {
    render(<ActionBar store={priv()} only={["undo"]} />);
    expect(undoBtn()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redo" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Hint/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Tap places faces" }),
    ).toBeInTheDocument();
  });

  test("an empty only shows just the mode toggle", () => {
    render(<ActionBar store={priv()} only={[]} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
