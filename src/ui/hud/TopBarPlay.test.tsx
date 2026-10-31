import { act, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { createGameStore, type GameStore } from "../../store/gameStore";
import { TopBar } from "./TopBar";

const n = level.size;
const solution = level.solution.map((c, r) => r * n + c);
const wrongCell = Array.from({ length: n * n }, (_, i) => i).find(
  (i) => !solution.includes(i),
) as number;

function Harness({ store }: { store: StoreApi<GameStore> }) {
  const hearts = useStore(store, (s) => s.hearts);
  return <TopBar level={level} hearts={hearts} />;
}

test("a wrong face costs a heart in the top bar", () => {
  const store = createGameStore();
  act(() => store.getState().startLevel(level));
  render(<Harness store={store} />);
  expect(screen.getByText(level.id)).toBeTruthy();
  expect(screen.getByRole("img", { name: "3 of 3 hearts" })).toBeTruthy();

  act(() => store.getState().placeFace(wrongCell));

  expect(screen.getByText(level.id)).toBeTruthy();
  expect(screen.getByRole("img", { name: "2 of 3 hearts" })).toBeTruthy();
});
