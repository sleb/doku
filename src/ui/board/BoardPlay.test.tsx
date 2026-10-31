import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { memo } from "react";
import { describe, expect, test, vi } from "vitest";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { createGameStore, type GameStore } from "../../store/gameStore";
import { holdCell as hold } from "../../test/hold";
import { Board } from "./Board";
import { HOLD_MS } from "./hold";

// Count the CellView renders that get past memo, per cell index.
const renders = vi.hoisted(() => ({ byIndex: new Map<number, number>() }));
vi.mock("./Cell", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./Cell")>();
  const Inner = orig.CellView;
  const CellView = memo(function Counted(
    props: React.ComponentProps<typeof Inner>,
  ) {
    renders.byIndex.set(
      props.index,
      (renders.byIndex.get(props.index) ?? 0) + 1,
    );
    return <Inner {...props} />;
  });
  return { ...orig, CellView };
});

// Hold Space on the focused cell for HOLD_MS.
function holdSpace(el: HTMLElement) {
  el.focus();
  vi.useFakeTimers();
  try {
    fireEvent.keyDown(el, { key: " " });
    act(() => vi.advanceTimersByTime(HOLD_MS));
    fireEvent.keyUp(el, { key: " " });
  } finally {
    vi.useRealTimers();
  }
}

const n = level.size;
const solution = level.solution.map((c, r) => r * n + c);
const wrongCell = Array.from({ length: n * n }, (_, i) => i).find(
  (i) => !solution.includes(i),
) as number;

function Harness({ store }: { store: StoreApi<GameStore> }) {
  const status = useStore(store, (s) => s.status);
  const board = useStore(store, (s) => s.board);
  const wrong = useStore(store, (s) => ("wrong" in s ? s.wrong : undefined));
  const { toggleMark, placeFace } = store.getState();
  if (!board || !wrong) return null;
  return (
    <Board
      level={level}
      board={board}
      wrong={wrong}
      conflicts={new Set()}
      disabled={status !== "playing"}
      onToggleMark={toggleMark}
      onPlaceFace={placeFace}
    />
  );
}

function setup() {
  const store = createGameStore();
  store.getState().startLevel(level);
  // Spy before render: Harness captures the action from the store on render.
  const placeFace = vi.spyOn(store.getState(), "placeFace");
  render(<Harness store={store} />);
  const cell = (i: number) =>
    screen.getByRole("button", {
      name: new RegExp(`^Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1},`),
    });
  const label = (i: number) =>
    cell(i).getAttribute("aria-label")?.split(", ").pop();
  return {
    store,
    placeFace,
    cell,
    label,
    hearts: () => store.getState().hearts,
  };
}

describe("playing the board", () => {
  test("single clicks toggle a mark on and off and never place a face", async () => {
    const { cell, label, hearts, placeFace } = setup();
    await userEvent.click(cell(solution[0]));
    expect(label(solution[0])).toBe("marked");
    await userEvent.click(cell(solution[0]));
    expect(label(solution[0])).toBe("empty");
    expect(placeFace).not.toHaveBeenCalled();
    expect(hearts()).toBe(3);
  });

  test("holding places a face, or a wrong mark and one fewer heart", () => {
    const { cell, label, hearts } = setup();
    hold(cell(solution[0]));
    expect(label(solution[0])).toBe("face");
    hold(cell(wrongCell));
    expect(label(wrongCell)).toBe("wrong");
    expect(hearts()).toBe(2);
  });

  test("a hold released early places nothing and costs nothing", () => {
    const { cell, label, hearts, placeFace } = setup();
    hold(cell(wrongCell), HOLD_MS - 50);
    expect(label(wrongCell)).toBe("empty");
    expect(placeFace).not.toHaveBeenCalled();
    expect(hearts()).toBe(3);
  });

  test("double-click toggles twice, placing nothing and costing nothing", async () => {
    const { cell, label, hearts, placeFace } = setup();
    await userEvent.dblClick(cell(wrongCell));
    expect(label(wrongCell)).toBe("empty");
    expect(placeFace).not.toHaveBeenCalled();
    expect(hearts()).toBe(3);
  });

  test("holding a player's own mark places a face", async () => {
    const { cell, label } = setup();
    await userEvent.click(cell(solution[1]));
    expect(label(solution[1])).toBe("marked");
    hold(cell(solution[1]));
    expect(label(solution[1])).toBe("face");
  });

  test("keys act on the focused cell without firing a click", async () => {
    const { cell, label, hearts } = setup();
    const clicks = vi.fn();
    document.addEventListener("click", clicks);
    const b = cell(solution[2]);
    b.focus();
    await userEvent.keyboard("x");
    expect(label(solution[2])).toBe("marked");
    await userEvent.keyboard("x");
    expect(label(solution[2])).toBe("empty");
    expect(label(solution[2])).toBe("empty");
    holdSpace(cell(solution[2]));
    expect(label(solution[2])).toBe("face");
    holdSpace(cell(wrongCell));
    expect(label(wrongCell)).toBe("wrong");
    expect(hearts()).toBe(2);
    expect(clicks).not.toHaveBeenCalled();
    document.removeEventListener("click", clicks);
  });

  test("faces and wrong marks are inert; the player's own mark is not", async () => {
    const { cell, label, hearts } = setup();
    hold(cell(solution[0]));
    hold(cell(wrongCell));
    for (const i of [solution[0], wrongCell]) {
      expect(cell(i)).toBeDisabled();
      await userEvent.click(cell(i));
      hold(cell(i));
    }
    expect(label(solution[0])).toBe("face");
    expect(label(wrongCell)).toBe("wrong");
    expect(hearts()).toBe(2);
    await userEvent.click(cell(solution[1]));
    expect(cell(solution[1])).toBeEnabled();
    await userEvent.click(cell(solution[1]));
    expect(label(solution[1])).toBe("empty");
  });

  test("a won board is inert", async () => {
    const { cell, store } = setup();
    for (const i of solution) hold(cell(i));
    expect(store.getState().status).toBe("won");
    const free = Array.from({ length: n * n }, (_, i) => i).filter(
      (i) => !solution.includes(i),
    );
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
    await userEvent.click(cell(free[0]));
    hold(cell(free[0]));
    expect(screen.getAllByRole("button", { name: /empty$/ })).toHaveLength(
      free.length,
    );
  });

  test("a lost board is inert", async () => {
    const { cell, store } = setup();
    const wrongs = Array.from({ length: n * n }, (_, i) => i)
      .filter((i) => !solution.includes(i))
      .slice(0, 4);
    for (const i of wrongs.slice(0, 3)) hold(cell(i));
    expect(store.getState().status).toBe("lost");
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
    await userEvent.click(cell(wrongs[3]));
    hold(cell(wrongs[3]));
    expect(cell(wrongs[3]).getAttribute("aria-label")).toMatch(/empty$/);
  });

  test("only the changed cell re-renders", async () => {
    const { cell } = setup();
    renders.byIndex.clear();
    await act(async () => {
      await userEvent.click(cell(solution[3]));
    });
    expect([...renders.byIndex.entries()]).toEqual([[solution[3], 1]]);
  });
});
