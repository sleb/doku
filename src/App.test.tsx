import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import App from "./App";
import { demoLevel } from "./levels/demoLevel";
import { idleState } from "./store/game";
import { gameStore } from "./store/gameStore";
import { REGION_BG } from "./ui/board/palette";

beforeEach(() => gameStore.setState(idleState, false));

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
  const user = userEvent.setup();
  const { size, solution } = demoLevel;
  for (let r = 0; r < size; r++) {
    await user.dblClick(
      screen.getByRole("button", {
        name: new RegExp(`^Row ${r + 1}, column ${solution[r] + 1},`),
      }),
    );
  }
  expect(
    screen.getByRole("dialog", { name: "You solved it" }),
  ).toBeInTheDocument();
});
