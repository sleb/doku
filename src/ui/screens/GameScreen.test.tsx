import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  uniqueLevel7 as level,
  uniqueLevel11,
} from "../../engine/__fixtures__/levels";
import { haptics } from "../../platform/haptics";
import { idleState, startLevel } from "../../store/game";
import { gameStore } from "../../store/gameStore";
import { conflictCells } from "../../store/selectors";
import { holdCell } from "../../test/hold";
import { GameScreen } from "./GameScreen";

vi.mock("../../platform/haptics", () => ({
  haptics: { play: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../store/selectors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../store/selectors")>();
  return { ...actual, conflictCells: vi.fn(actual.conflictCells) };
});

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
  vi.mocked(haptics.play).mockClear();
});
afterEach(() => vi.restoreAllMocks());

/** Records the dialog present at first commit, before passive effects run. */
function Probe({ seen }: { seen: (Element | null)[] }) {
  useLayoutEffect(() => {
    seen.push(document.querySelector("[role=dialog]"));
  }, [seen]);
  return null;
}

function hold(cells: number[]) {
  for (const i of cells) holdCell(cell(i));
}

describe("GameScreen", () => {
  test("places the top bar and board in the layout header and board areas", () => {
    render(<GameScreen level={level} />);
    expect(screen.getByRole("banner").closest("[data-area]")).toHaveAttribute(
      "data-area",
      "header",
    );
    expect(screen.getByRole("grid").closest("[data-area]")).toHaveAttribute(
      "data-area",
      "board",
    );
  });

  test("renders the top bar and grid with no dialog while playing", () => {
    render(<GameScreen level={level} />);
    expect(screen.getByRole("heading", { name: level.id })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "3 of 3 hearts" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("grid", { name: "Puzzle board" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("starts the level on mount, also under StrictMode", () => {
    render(
      <StrictMode>
        <GameScreen level={level} />
      </StrictMode>,
    );
    expect(gameStore.getState().status).toBe("playing");
    expect(
      screen.getByRole("grid", { name: "Puzzle board" }),
    ).toBeInTheDocument();
  });

  test("solving shows 'You solved it', focused Retry, and an inert board", async () => {
    render(<GameScreen level={level} />);
    hold(solution);
    expect(
      screen.getByRole("dialog", { name: "You solved it" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
    expect(screen.getByRole("grid").closest("[inert]")).not.toBeNull();
    for (const i of nonSolution.slice(0, 3)) {
      expect(cell(i)).toBeDisabled();
      expect(label(i)).toBe("empty");
    }
    await userEvent.click(cell(nonSolution[0]));
    holdCell(cell(nonSolution[0]));
    expect(label(nonSolution[0])).toBe("empty");
    expect(gameStore.getState().hearts).toBe(3);
  });

  test("unmounting resets the store to idle", async () => {
    const { unmount } = render(<GameScreen level={level} />);
    hold([nonSolution[0]]);
    expect(gameStore.getState().hearts).toBe(2);
    unmount();
    expect(gameStore.getState().status).toBe("idle");
    expect(gameStore.getState().board).toBeNull();
    expect(gameStore.getState().hearts).toBe(3);
  });

  test("a remount after a finished game shows no old dialog on first paint", async () => {
    const first = render(<GameScreen level={level} />);
    hold(solution);
    first.unmount();
    const seen: (Element | null)[] = [];
    render(
      <>
        <GameScreen level={level} />
        <Probe seen={seen} />
      </>,
    );
    expect(seen).toEqual([null]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(gameStore.getState().status).toBe("playing");
    for (let i = 0; i < n * n; i++) expect(label(i)).toBe("empty");
  });

  test("StrictMode double-mount still leaves the level playing", async () => {
    render(
      <StrictMode>
        <GameScreen level={level} />
      </StrictMode>,
    );
    hold([nonSolution[0]]);
    expect(gameStore.getState().status).toBe("playing");
    expect(gameStore.getState().hearts).toBe(2);
  });

  test("does not throw or mismatch when the store holds a different-size level", () => {
    gameStore.setState(startLevel(uniqueLevel11), false);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<GameScreen level={level} />)).not.toThrow();
    expect(error).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button")).toHaveLength(n * n);
  });

  test("three wrong taps show 'Out of hearts' with wrong marks", async () => {
    render(<GameScreen level={level} />);
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

  test.each([
    ["win", () => solution],
    ["loss", () => nonSolution.slice(0, 3)],
  ])(
    "Retry after a %s gives a fresh board with 3 hearts",
    async (_n, cells) => {
      render(<GameScreen level={level} />);
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

  test("one wrong tap keeps the dialog hidden and shows 2 hearts", async () => {
    render(<GameScreen level={level} />);
    hold([nonSolution[0]]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("img", { name: "2 of 3 hearts" }),
    ).toBeInTheDocument();
  });

  test("an unrelated store update does not log errors or loop", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GameScreen level={level} />);
    act(() => gameStore.getState().toggleMark(solution[0]));
    expect(label(solution[0])).toBe("marked");
    expect(error).not.toHaveBeenCalled();
  });

  test("never computes conflicts for a board from a different level", () => {
    vi.mocked(conflictCells).mockClear();
    gameStore.setState(startLevel(uniqueLevel11), false);
    render(<GameScreen level={level} />);
    for (const [board, lvl] of vi.mocked(conflictCells).mock.calls) {
      expect(board).toHaveLength(lvl.size * lvl.size);
    }
  });

  describe("haptics", () => {
    const play = () => vi.mocked(haptics.play);

    test("a correct hold plays place once", () => {
      render(<GameScreen level={level} />);
      hold([solution[0]]);
      expect(play().mock.calls).toEqual([["place"]]);
    });

    test("a wrong hold plays wrong once", () => {
      render(<GameScreen level={level} />);
      hold([nonSolution[0]]);
      expect(play().mock.calls).toEqual([["wrong"]]);
    });

    test("a cross tap is silent", async () => {
      render(<GameScreen level={level} />);
      await userEvent.click(cell(nonSolution[0]));
      expect(play()).not.toHaveBeenCalled();
    });

    test("the final correct hold plays only win", () => {
      render(<GameScreen level={level} />);
      hold(solution.slice(0, -1));
      play().mockClear();
      hold(solution.slice(-1));
      expect(play().mock.calls).toEqual([["win"]]);
    });

    test("losing the last heart plays only lose", () => {
      render(<GameScreen level={level} />);
      hold(nonSolution.slice(0, 2));
      play().mockClear();
      hold(nonSolution.slice(2, 3));
      expect(play().mock.calls).toEqual([["lose"]]);
    });

    test("Retry is silent", async () => {
      render(<GameScreen level={level} />);
      hold(nonSolution.slice(0, 3));
      play().mockClear();
      await userEvent.click(screen.getByRole("button", { name: /retry/i }));
      expect(play()).not.toHaveBeenCalled();
    });

    test("after unmount, store changes are silent", () => {
      const { unmount } = render(<GameScreen level={level} />);
      unmount();
      gameStore.setState(startLevel(level), false);
      gameStore.getState().placeFace(solution[0]);
      expect(play()).not.toHaveBeenCalled();
    });

    test("buzzes once under StrictMode", () => {
      render(
        <StrictMode>
          <GameScreen level={level} />
        </StrictMode>,
      );
      hold([solution[0]]);
      expect(play().mock.calls).toEqual([["place"]]);
    });

    test("changing level neither buzzes nor stacks subscriptions", () => {
      const { rerender } = render(<GameScreen level={level} />);
      rerender(<GameScreen level={uniqueLevel11} />);
      expect(play()).not.toHaveBeenCalled();
      hold([uniqueLevel11.solution[0]]);
      expect(play().mock.calls).toHaveLength(1);
    });
  });
});
