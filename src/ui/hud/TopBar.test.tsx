import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { TopBar } from "./TopBar";

test("shows the level title and remaining hearts", () => {
  render(<TopBar level={level} hearts={2} onPause={() => {}} />);
  expect(screen.getByText(level.id)).toBeTruthy();
  expect(screen.getByRole("img", { name: "2 of 3 hearts" })).toBeTruthy();
});

test("the Pause button is at least 44px and calls onPause", async () => {
  const onPause = vi.fn();
  render(<TopBar level={level} hearts={3} onPause={onPause} />);
  const button = screen.getByRole("button", { name: "Pause" });
  expect(button.className).toMatch(/min-h-11/);
  expect(button.className).toMatch(/min-w-11/);
  await userEvent.click(button);
  expect(onPause).toHaveBeenCalledTimes(1);
});

test("shows the clock", () => {
  render(<TopBar level={level} hearts={3} onPause={() => {}} />);
  expect(screen.getByText("0:00")).toBeInTheDocument();
});
