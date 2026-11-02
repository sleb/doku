import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { idleState } from "../../store/game";
import { gameStore } from "../../store/gameStore";
import { Timer } from "./Timer";

beforeEach(() => gameStore.setState(idleState, false));

test("shows 0:00 then advances with the store clock", () => {
  act(() => gameStore.getState().startLevel(level));
  render(<Timer />);
  expect(screen.getByText("0:00")).toBeInTheDocument();
  act(() => gameStore.getState().tick(1000));
  expect(screen.getByText("0:01")).toBeInTheDocument();
  act(() => gameStore.getState().tick(500));
  expect(screen.getByText("0:01")).toBeInTheDocument();
});
