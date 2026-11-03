import { beforeEach, expect, test, vi } from "vitest";
import { idleState } from "../store/game";
import { gameStore } from "../store/gameStore";
import { defaultProgress, progressStore } from "../store/progress";
import { launch } from "./launch";

beforeEach(() => {
  gameStore.setState(idleState, false);
  progressStore.setState(defaultProgress);
  vi.restoreAllMocks();
});

test("renders after a successful boot", async () => {
  const render = vi.fn();
  await launch(async () => {}, render);
  expect(render).toHaveBeenCalledTimes(1);
});

test("a rejected boot is logged and the app still renders on level 1", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const render = vi.fn();
  const boom = new Error("boom");
  await launch(() => Promise.reject(boom), render);
  expect(error).toHaveBeenCalledWith(expect.any(String), boom);
  expect(render).toHaveBeenCalledTimes(1);
  expect(gameStore.getState().status).toBe("playing");
});
