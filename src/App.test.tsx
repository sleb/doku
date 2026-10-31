import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "./App";
import { demoLevel } from "./levels/demoLevel";
import { REGION_BG, REGION_NAMES } from "./ui/board/palette";

test("shows the title and demo level id", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Doku" })).toBeInTheDocument();
  expect(screen.getByText(demoLevel.id)).toBeInTheDocument();
});

test("has no Tauri scaffold", () => {
  render(<App />);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("img")).toBeNull();
});

test("renders a palette swatch per region with its class", () => {
  render(<App />);
  REGION_NAMES.forEach((name, i) => {
    expect(screen.getByTestId(`swatch-${name}`)).toHaveClass(REGION_BG[i]);
  });
});
