import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { TopBar } from "./TopBar";

const pos = { levelNumber: 1, levelCount: 8 };

test("shows the remaining hearts and keeps the level id as data", () => {
  render(<TopBar level={level} {...pos} hearts={2} onPause={() => {}} />);
  expect(screen.getByRole("heading")).toHaveAttribute("data-level-id", level.id);
  expect(screen.getByRole("img", { name: "2 of 3 hearts" })).toBeTruthy();
});

test("the Pause button is at least 44px and calls onPause", async () => {
  const onPause = vi.fn();
  render(<TopBar level={level} {...pos} hearts={3} onPause={onPause} />);
  const button = screen.getByRole("button", { name: "Pause" });
  expect(button.className).toMatch(/min-h-11/);
  expect(button.className).toMatch(/min-w-11/);
  await userEvent.click(button);
  expect(onPause).toHaveBeenCalledTimes(1);
});

test("shows the clock", () => {
  render(<TopBar level={level} {...pos} hearts={3} onPause={() => {}} />);
  expect(screen.getByText("0:00")).toBeInTheDocument();
});

test("shows the campaign position", () => {
  render(
    <TopBar
      level={level}
      levelNumber={3}
      levelCount={8}
      hearts={3}
      onPause={() => {}}
    />,
  );
  expect(screen.getByRole("heading", { name: "Level 3 of 8" })).toBeTruthy();
});
