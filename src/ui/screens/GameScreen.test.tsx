import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  uniqueLevel7 as level,
  uniqueLevel11,
} from "../../engine/__fixtures__/levels";
import { type GameState, idleState, startLevel } from "../../store/game";
import { gameStore } from "../../store/gameStore";
import { GameScreen } from "./GameScreen";

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

beforeEach(() => gameStore.setState(idleState, false));
afterEach(() => vi.restoreAllMocks());

/** Records the dialog present at first commit, before passive effects run. */
function Probe({ seen }: { seen: (Element | null)[] }) {
  useLayoutEffect(() => {
    seen.push(document.querySelector("[role=dialog]"));
  }, [seen]);
  return null;
}

async function dbl(cells: number[]) {
  const user = userEvent.setup();
  for (const i of cells) await user.dblClick(cell(i));
  return user;
}

describe("GameScreen", () => {
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
    await dbl(solution);
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
    await userEvent.dblClick(cell(nonSolution[0]));
    expect(label(nonSolution[0])).toBe("empty");
    expect(gameStore.getState().hearts).toBe(3);
  });

  test("does not render a stale result from a previous mount on first paint", () => {
    gameStore.setState(
      { ...startLevel(level), status: "won" } as GameState,
      false,
    );
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
    await dbl(wrongs);
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
      await dbl(cells());
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
    await dbl([nonSolution[0]]);
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
});
