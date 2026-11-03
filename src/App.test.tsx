import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import App from "./App";
import { boot } from "./app/boot";
import { recordWins, startCurrent } from "./app/campaign";
import { LEVELS } from "./levels/campaign";
import { MemoryStorage } from "./platform/storage";
import {
  idleState,
  type Started,
  startLevel,
  tick,
  toggleMark,
} from "./store/game";
import { gameStore } from "./store/gameStore";
import { toSaved } from "./store/persist";
import { defaultProgress, progressStore } from "./store/progress";
import { defaultSettings, settingsStore } from "./store/settings";
import { holdCell } from "./test/hold";
import { REGION_BG } from "./ui/board/palette";

beforeEach(() => {
  gameStore.setState(idleState, false);
  settingsStore.setState({ ...defaultSettings, seenRules: true });
  progressStore.setState(defaultProgress);
  startCurrent();
});

const demoLevel = LEVELS[0];

test("renders the first level board with its position in the top bar", () => {
  render(<App />);
  expect(
    screen.getByRole("heading", { name: `Level 1 of ${LEVELS.length}` }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("grid", { name: "Puzzle board" }),
  ).toBeInTheDocument();
});

test("cells carry their region background class", () => {
  render(<App />);
  const region = demoLevel.regions[0][0];
  expect(screen.getByRole("button", { name: /^Row 1, column 1,/ })).toHaveClass(
    REGION_BG[region],
  );
});

test("has no scaffold input or palette swatches", () => {
  render(<App />);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByTestId("swatch-red")).toBeNull();
});

test("solving the demo level shows the result dialog", async () => {
  render(<App />);
  const { size, solution } = demoLevel;
  for (let r = 0; r < size; r++) {
    holdCell(
      screen.getByRole("button", {
        name: new RegExp(`^Row ${r + 1}, column ${solution[r] + 1},`),
      }),
    );
  }
  expect(
    screen.getByRole("dialog", { name: "You solved it" }),
  ).toBeInTheDocument();
});

test("main fills the viewport height and is not shrink-wrapped", () => {
  render(<App />);
  const main = screen.getByRole("main");
  expect(main).toHaveClass("h-dvh");
  expect(main).not.toHaveClass("w-fit");
  expect(main).not.toHaveClass("px-4");
});

test("renders the top bar", () => {
  render(<App />);
  expect(screen.getByTestId("top-bar")).toBeInTheDocument();
});

test("shows the Finale when the campaign is finished", () => {
  progressStore.setState({ next: LEVELS.length, bestMs: {} });
  startCurrent();
  render(<App />);
  expect(screen.getByRole("heading", { name: "You finished" })).toBeTruthy();
  expect(screen.queryByTestId("top-bar")).toBeNull();
});

function solveCurrent() {
  const level = gameStore.getState().level;
  if (!level) throw new Error("no level");
  for (let r = 0; r < level.size; r++) {
    holdCell(
      screen.getByRole("button", {
        name: new RegExp(`^Row ${r + 1}, column ${level.solution[r] + 1},`),
      }),
    );
  }
}

test("winning the last level shows the result modal, not the Finale", () => {
  const stop = recordWins();
  progressStore.setState({ next: LEVELS.length - 1, bestMs: {} });
  startCurrent();
  render(<App />);
  solveCurrent();
  stop();
  expect(
    screen.getByRole("dialog", { name: "You solved it" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "You finished" })).toBeNull();
});

test("Finish leads to the Finale, whose Start over returns to level 1", async () => {
  const stop = recordWins();
  progressStore.setState({ next: LEVELS.length - 1, bestMs: {} });
  startCurrent();
  render(<App />);
  solveCurrent();
  await userEvent.click(screen.getByRole("button", { name: "Finish" }));
  expect(screen.getByRole("heading", { name: "You finished" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Start over" }));
  stop();
  expect(
    screen.getByRole("heading", { name: `Level 1 of ${LEVELS.length}` }),
  ).toBeInTheDocument();
  expect(Object.keys(progressStore.getState().bestMs).length).toBeGreaterThan(
    0,
  );
});

test("a restored save opens paused; Resume continues the same game", async () => {
  const storage = new MemoryStorage();
  await storage.set("settings", { haptics: true, seenRules: true });
  const played = tick(toggleMark(startLevel(demoLevel), 4), 0) as Started;
  await storage.set("save", toSaved({ ...played, elapsedMs: 42000 }));
  await boot(storage);
  render(<App />);
  expect(gameStore.getState().status).toBe("paused");
  await userEvent.click(screen.getByRole("button", { name: "Resume" }));
  expect(gameStore.getState().status).toBe("playing");
  expect(gameStore.getState().board?.[4]).toBe(1);
  expect(gameStore.getState()).toMatchObject({ elapsedMs: 42000 });
});

test("hiding the app pauses and the saved elapsed time lands", async () => {
  const storage = new MemoryStorage();
  await storage.set("settings", { haptics: true, seenRules: true });
  await boot(storage);
  render(<App />);
  act(() => gameStore.getState().tick(6000));
  act(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(gameStore.getState().status).toBe("paused");
  expect(await storage.get("save")).toMatchObject({ elapsedMs: 6000 });
});
