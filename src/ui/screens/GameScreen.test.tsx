import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { recordWins } from "../../app/campaign";
import { LEVELS } from "../../levels/campaign";
import { haptics } from "../../platform/haptics";
import { idleState } from "../../store/game";
import { gameStore } from "../../store/gameStore";
import { defaultProgress, progressStore } from "../../store/progress";
import { defaultSettings, settingsStore } from "../../store/settings";
import { holdCell } from "../../test/hold";
import { GameScreen } from "./GameScreen";

vi.mock("../../platform/haptics", () => ({
  haptics: { play: vi.fn().mockResolvedValue(undefined) },
}));

const level = LEVELS[0];
const n = level.size;
const solution = level.solution.map((c, r) => r * n + c);
const nonSolution = Array.from({ length: n * n }, (_, i) => i).filter(
  (i) => !solution.includes(i),
);

const cell = (i: number) =>
  screen.getByRole("button", {
    name: new RegExp(`^Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1},`),
  });
const label = (i: number) =>
  cell(i).getAttribute("aria-label")?.split(", ").pop();

beforeEach(() => {
  gameStore.setState(idleState, false);
  progressStore.setState(defaultProgress);
  settingsStore.setState({ ...defaultSettings, seenRules: true });
  vi.mocked(haptics.play).mockClear();
});
afterEach(() => vi.restoreAllMocks());

function renderGame(lvl = level, strict = false) {
  act(() => gameStore.getState().startLevel(lvl));
  return render(
    strict ? (
      <StrictMode>
        <GameScreen />
      </StrictMode>
    ) : (
      <GameScreen />
    ),
  );
}

function hold(cells: number[]) {
  for (const i of cells) holdCell(cell(i));
}

describe("GameScreen without props", () => {
  test("plays the store's level and shows its campaign position", () => {
    act(() => gameStore.getState().startLevel(LEVELS[2]));
    render(<GameScreen />);
    expect(
      screen.getByRole("heading", { name: `Level 3 of ${LEVELS.length}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });
});

describe("GameScreen", () => {
  test("places the top bar and board in the layout header and board areas", () => {
    renderGame();
    expect(
      screen.getByTestId("top-bar").closest("[data-area]"),
    ).toHaveAttribute("data-area", "header");
    expect(screen.getByRole("grid").closest("[data-area]")).toHaveAttribute(
      "data-area",
      "board",
    );
  });

  test("renders the top bar and grid with no dialog while playing", () => {
    renderGame();
    expect(
      screen.getByRole("heading", { name: `Level 1 of ${LEVELS.length}` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "3 of 3 hearts" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("grid", { name: "Puzzle board" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("solving shows 'You solved it', focused Next level, and an inert board", async () => {
    renderGame();
    hold(solution);
    expect(
      screen.getByRole("dialog", { name: "You solved it" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next level" })).toHaveFocus();
    expect(screen.getByRole("grid").closest("[inert]")).not.toBeNull();
    for (const i of nonSolution.slice(0, 3)) {
      expect(cell(i)).toHaveAttribute("aria-disabled", "true");
      expect(label(i)).toBe("empty");
    }
    await userEvent.click(cell(nonSolution[0]));
    holdCell(cell(nonSolution[0]));
    expect(label(nonSolution[0])).toBe("empty");
    expect(gameStore.getState().hearts).toBe(3);
  });

  test("three wrong taps show 'Out of hearts' with wrong marks", async () => {
    renderGame();
    const wrongs = nonSolution.slice(0, 3);
    hold(wrongs);
    expect(
      screen.getByRole("dialog", { name: "Out of hearts" }),
    ).toBeInTheDocument();
    for (const i of wrongs) expect(label(i)).toBe("wrong");
    expect(
      screen.getByRole("img", { name: "0 of 3 hearts" }),
    ).toBeInTheDocument();
  });

  test.each([["loss", () => nonSolution.slice(0, 3)]])(
    "Retry after a %s gives a fresh board with 3 hearts",
    async (_n, cells) => {
      renderGame();
      hold(cells());
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(
        screen.getByRole("img", { name: "3 of 3 hearts" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("grid").closest("[inert]")).toBeNull();
      for (let i = 0; i < n * n; i++) expect(label(i)).toBe("empty");
    },
  );

  test("Next level after a win starts level 2", async () => {
    const stop = recordWins();
    renderGame();
    hold(solution);
    await userEvent.click(screen.getByRole("button", { name: "Next level" }));
    stop();
    expect(
      screen.getByRole("heading", { name: `Level 2 of ${LEVELS.length}` }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Tab enters the board on the active cell; pause then resume returns focus to it", async () => {
    const user = userEvent.setup();
    renderGame();
    act(() => cell(7).focus());
    act(() => cell(7).blur());
    await user.tab(); // the top bar's Pause button comes first
    await user.tab();
    expect(cell(7)).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(gameStore.getState().status).toBe("paused");
    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(cell(7)).toHaveFocus();
  });

  test("resume focuses the active cell when focus was lost while paused", async () => {
    const user = userEvent.setup();
    renderGame();
    expect(document.body).toHaveFocus();
    act(() => gameStore.getState().pause());
    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(cell(0)).toHaveFocus();
  });

  test("a focused cell that becomes a face keeps focus", () => {
    renderGame();
    const target = cell(solution[0]);
    act(() => target.focus());
    holdCell(target);
    expect(label(solution[0])).toBe("face");
    expect(target).toHaveFocus();
    expect(target).toHaveAttribute("aria-disabled", "true");
  });

  test("one wrong tap keeps the dialog hidden and shows 2 hearts", async () => {
    renderGame();
    hold([nonSolution[0]]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("img", { name: "2 of 3 hearts" }),
    ).toBeInTheDocument();
  });

  test("an unrelated store update does not log errors or loop", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderGame();
    act(() => gameStore.getState().toggleMark(solution[0]));
    expect(label(solution[0])).toBe("marked");
    expect(error).not.toHaveBeenCalled();
  });

  describe("haptics", () => {
    const play = () => vi.mocked(haptics.play);

    test("a correct hold plays place once", () => {
      renderGame();
      hold([solution[0]]);
      expect(play().mock.calls).toEqual([["place"]]);
    });

    test("nothing plays for a correct or wrong hold when haptics are off", () => {
      settingsStore.getState().set({ haptics: false });
      renderGame();
      hold([solution[0], nonSolution[0]]);
      expect(play()).not.toHaveBeenCalled();
    });

    test("turning haptics off mid-game applies to the next move", () => {
      renderGame();
      hold([solution[0]]);
      settingsStore.getState().set({ haptics: false });
      hold([solution[1]]);
      expect(play().mock.calls).toEqual([["place"]]);
    });

    test("a wrong hold plays wrong once", () => {
      renderGame();
      hold([nonSolution[0]]);
      expect(play().mock.calls).toEqual([["wrong"]]);
    });

    test("the Hint button plays place, not wrong, and drops a heart", async () => {
      renderGame();
      await userEvent.click(
        screen.getByRole("button", { name: "Hint, costs one heart" }),
      );
      expect(play().mock.calls).toEqual([["place"]]);
      expect(screen.getByRole("img", { name: "2 of 3 hearts" })).toBeTruthy();
      expect(label(solution[0])).toMatch(/face/i);
    });

    test("a cross tap is silent", async () => {
      renderGame();
      await userEvent.click(cell(nonSolution[0]));
      expect(play()).not.toHaveBeenCalled();
    });

    test("the final correct hold plays only win", () => {
      renderGame();
      hold(solution.slice(0, -1));
      play().mockClear();
      hold(solution.slice(-1));
      expect(play().mock.calls).toEqual([["win"]]);
    });

    test("losing the last heart plays only lose", () => {
      renderGame();
      hold(nonSolution.slice(0, 2));
      play().mockClear();
      hold(nonSolution.slice(2, 3));
      expect(play().mock.calls).toEqual([["lose"]]);
    });

    test("Retry is silent", async () => {
      renderGame();
      hold(nonSolution.slice(0, 3));
      play().mockClear();
      await userEvent.click(screen.getByRole("button", { name: /retry/i }));
      expect(play()).not.toHaveBeenCalled();
    });

    test("buzzes once under StrictMode", () => {
      renderGame(level, true);
      hold([solution[0]]);
      expect(play().mock.calls).toEqual([["place"]]);
    });
  });

  describe("timer and pause", () => {
    const elapsed = () => {
      const s = gameStore.getState();
      return s.status === "idle" ? -1 : s.elapsedMs;
    };

    test("the clock advances while playing", () => {
      renderGame();
      expect(screen.getByText("0:00")).toBeInTheDocument();
      act(() => gameStore.getState().tick(2000));
      expect(screen.getByText("0:02")).toBeInTheDocument();
    });

    test("Pause shows the dialog and hides and inerts the board", async () => {
      const user = userEvent.setup();
      renderGame();
      await user.click(screen.getByRole("button", { name: "Pause" }));
      expect(gameStore.getState().status).toBe("paused");
      expect(
        screen.getByRole("dialog", { name: "Paused" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Resume" })).toHaveFocus();
      const grid = screen.getByRole("grid", { hidden: true });
      expect(grid.parentElement).toHaveAttribute("inert");
      expect(grid.parentElement).toHaveStyle({ visibility: "hidden" });
      expect(
        screen.queryByRole("button", { name: /^Row 1, column 1,/ }),
      ).toBeNull();
    });

    test("input is ignored while paused", () => {
      renderGame();
      act(() => gameStore.getState().pause());
      const before = gameStore.getState();
      const cell0 = document.querySelector<HTMLElement>(
        '[aria-label^="Row 1, column 1,"]',
      );
      if (!cell0) throw new Error("no cell");
      holdCell(cell0);
      fireEvent.keyDown(document.body, { key: "x" });
      expect(gameStore.getState().board).toEqual(before.board);
      expect(gameStore.getState().hearts).toBe(3);
    });

    test("Resume continues from the same elapsed time", async () => {
      const user = userEvent.setup();
      // A frozen clock: the pause credits no real time since the last tick.
      vi.spyOn(performance, "now").mockReturnValue(1000);
      renderGame();
      act(() => gameStore.getState().tick(3000));
      await user.click(screen.getByRole("button", { name: "Pause" }));
      await user.click(screen.getByRole("button", { name: "Resume" }));
      expect(gameStore.getState().status).toBe("playing");
      expect(elapsed()).toBe(3000);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    test("Restart level from the pause dialog resets to 0:00", async () => {
      const user = userEvent.setup();
      renderGame();
      act(() => gameStore.getState().tick(3000));
      await user.click(screen.getByRole("button", { name: "Pause" }));
      await user.click(screen.getByRole("button", { name: "Restart level" }));
      expect(gameStore.getState().status).toBe("playing");
      expect(elapsed()).toBe(0);
    });

    test("hiding the document auto-pauses; pausing buzzes nothing", () => {
      renderGame();
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      expect(
        screen.getByRole("dialog", { name: "Paused" }),
      ).toBeInTheDocument();
      expect(haptics.play).not.toHaveBeenCalled();
    });

    test("a finished game shows the result, not the pause dialog", () => {
      renderGame();
      hold(nonSolution.slice(0, 3));
      expect(
        screen.getByRole("dialog", { name: "Out of hearts" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
    });
  });

  describe("undo and redo", () => {
    test("the controls slot holds Undo and Redo", () => {
      renderGame();
      const undo = screen.getByRole("button", { name: "Undo" });
      expect(undo.closest("[data-area]")).toHaveAttribute(
        "data-area",
        "controls",
      );
      expect(screen.getByRole("button", { name: "Redo" })).toBeInTheDocument();
    });

    test("undoes and redoes a note on the real board", async () => {
      const user = userEvent.setup();
      renderGame();
      await user.click(cell(nonSolution[0]));
      expect(label(nonSolution[0])).toBe("marked");
      await user.click(screen.getByRole("button", { name: "Undo" }));
      expect(label(nonSolution[0])).toBe("empty");
      await user.click(screen.getByRole("button", { name: "Redo" }));
      expect(label(nonSolution[0])).toBe("marked");
    });

    test("the z key undoes a note", async () => {
      const user = userEvent.setup();
      renderGame();
      await user.click(cell(nonSolution[0]));
      await user.keyboard("z");
      expect(label(nonSolution[0])).toBe("empty");
    });

    test("z does nothing while a cell is being held, and works after", async () => {
      const user = userEvent.setup();
      renderGame();
      await user.click(cell(nonSolution[0]));
      const target = cell(nonSolution[1]);
      fireEvent.pointerDown(target, { button: 0, pointerId: 1 });
      fireEvent.keyDown(window, { key: "z" });
      expect(label(nonSolution[0])).toBe("marked");
      fireEvent.pointerUp(target, { pointerId: 1 });
      fireEvent.keyDown(window, { key: "z" });
      expect(label(nonSolution[0])).toBe("empty");
    });

    test("a face placed over a note is not touched by Undo", async () => {
      const user = userEvent.setup();
      renderGame();
      await user.click(cell(solution[0]));
      holdCell(cell(solution[0]));
      const placed = label(solution[0]);
      expect(placed).not.toBe("marked");
      expect(placed).not.toBe("empty");
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
      expect(label(solution[0])).toBe(placed);
    });
  });

  describe("rules and settings", () => {
    const fresh = () => settingsStore.setState(defaultSettings);

    test("a fresh install opens Rules and pauses the game", () => {
      fresh();
      renderGame();
      expect(screen.getByRole("dialog", { name: "Rules" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
      expect(gameStore.getState().status).toBe("paused");
    });

    test("dismissing first-launch Rules sets seenRules and resumes", async () => {
      fresh();
      renderGame();
      await userEvent.click(screen.getByRole("button", { name: "Got it" }));
      expect(settingsStore.getState().seenRules).toBe(true);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(gameStore.getState().status).toBe("playing");
    });

    test("a remount with seenRules true does not reopen Rules", () => {
      renderGame();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(gameStore.getState().status).toBe("playing");
    });

    test("the clock does not advance under first-launch Rules", () => {
      vi.useFakeTimers();
      try {
        fresh();
        renderGame();
        act(() => {
          vi.advanceTimersByTime(5000);
        });
        const state = gameStore.getState();
        expect(state.status === "idle" ? -1 : state.elapsedMs).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    test("Pause > Rules > Got it returns to Pause and Resume works", async () => {
      renderGame();
      await userEvent.click(screen.getByRole("button", { name: "Pause" }));
      await userEvent.click(screen.getByRole("button", { name: "Rules" }));
      expect(screen.getByRole("dialog", { name: "Rules" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Got it" }));
      expect(
        screen.getByRole("dialog", { name: "Paused" }),
      ).toBeInTheDocument();
      expect(gameStore.getState().status).toBe("paused");
      await userEvent.click(screen.getByRole("button", { name: "Resume" }));
      expect(gameStore.getState().status).toBe("playing");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    test("Pause > Settings > toggle updates the store, Done returns to Pause", async () => {
      renderGame();
      await userEvent.click(screen.getByRole("button", { name: "Pause" }));
      await userEvent.click(screen.getByRole("button", { name: "Settings" }));
      expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
      await userEvent.click(screen.getByRole("switch", { name: "Haptics" }));
      expect(settingsStore.getState().haptics).toBe(false);
      await userEvent.click(screen.getByRole("button", { name: "Done" }));
      expect(
        screen.getByRole("dialog", { name: "Paused" }),
      ).toBeInTheDocument();
      expect(gameStore.getState().status).toBe("paused");
    });

    test("Pause > Settings > Start over returns to level 1, keeping bests", async () => {
      progressStore.setState({ next: 3, bestMs: { [LEVELS[0].id]: 2000 } });
      renderGame(LEVELS[3]);
      await userEvent.click(screen.getByRole("button", { name: "Pause" }));
      await userEvent.click(screen.getByRole("button", { name: "Settings" }));
      await userEvent.click(screen.getByRole("button", { name: "Start over" }));
      await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
      // Level 1 comes up paused, with the Pause dialog showing.
      expect(
        screen.getByRole("dialog", { name: "Paused" }),
      ).toBeInTheDocument();
      expect(gameStore.getState().status).toBe("paused");
      expect(
        screen.getByRole("heading", { name: `Level 1 of ${LEVELS.length}` }),
      ).toBeInTheDocument();
      expect(progressStore.getState().bestMs[LEVELS[0].id]).toBe(2000);
    });

    test("Escape in Rules or Settings returns to Pause without resuming", async () => {
      renderGame();
      await userEvent.click(screen.getByRole("button", { name: "Pause" }));
      for (const name of ["Rules", "Settings"]) {
        await userEvent.click(screen.getByRole("button", { name }));
        await userEvent.keyboard("{Escape}");
        expect(
          screen.getByRole("dialog", { name: "Paused" }),
        ).toBeInTheDocument();
        expect(gameStore.getState().status).toBe("paused");
      }
    });

    test("Rules opened from Pause restores focus and un-inerts Pause", async () => {
      renderGame();
      await userEvent.click(screen.getByRole("button", { name: "Pause" }));
      await userEvent.click(screen.getByRole("button", { name: "Rules" }));
      await userEvent.click(screen.getByRole("button", { name: "Got it" }));
      expect(screen.getByRole("button", { name: "Resume" })).toHaveFocus();
      expect(
        screen.getByRole("dialog", { name: "Paused" }).closest("[inert]"),
      ).toBeNull();
    });

    test("restart and a later startLevel do not reopen Rules", async () => {
      fresh();
      renderGame();
      await userEvent.click(screen.getByRole("button", { name: "Got it" }));
      act(() => gameStore.getState().restart());
      act(() => gameStore.getState().startLevel(level));
      expect(screen.queryByRole("dialog", { name: "Rules" })).toBeNull();
    });

    test("first-launch Rules open once under StrictMode", () => {
      fresh();
      renderGame(level, true);
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(gameStore.getState().status).toBe("paused");
    });
  });
});
