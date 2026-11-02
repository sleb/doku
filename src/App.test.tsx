import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import { LEVELS, levelIndex } from "./levels/campaign";
import { idleState } from "./store/game";
import { gameStore } from "./store/gameStore";
import { holdCell } from "./test/hold";
import { REGION_BG } from "./ui/board/palette";

beforeEach(() => gameStore.setState(idleState, false));

const demoLevel = LEVELS[0];
const demoLevel11 = LEVELS[levelIndex("demo-11")];

test("renders the demo level board with its id in the top bar", () => {
  render(<App />);
  expect(
    screen.getByRole("heading", { name: demoLevel.id }),
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

test("?level=demo-11 selects the 11x11 demo level (read once at load)", async () => {
  window.history.pushState({}, "", "/?level=demo-11");
  try {
    vi.resetModules();
    const { default: FreshApp } = await import("./App");
    render(<FreshApp />);
    expect(
      screen.getByRole("heading", { name: demoLevel11.id }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(121);
  } finally {
    window.history.pushState({}, "", "/");
  }
});
