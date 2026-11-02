import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { LEVELS } from "../../levels/campaign";
import { defaultProgress, progressStore } from "../../store/progress";
import { Finale } from "./Finale";

beforeEach(() => progressStore.setState(defaultProgress));

test("congratulates the player", () => {
  render(<Finale onStartOver={() => {}} />);
  expect(screen.getByRole("heading", { name: "You finished" })).toBeTruthy();
});

test("shows the total of best times", () => {
  progressStore.setState({
    next: LEVELS.length,
    bestMs: { [LEVELS[0].id]: 60000, [LEVELS[1].id]: 65000 },
  });
  render(<Finale onStartOver={() => {}} />);
  expect(screen.getByText("Total of best times: 2:05")).toBeInTheDocument();
});

test("ignores best times for unknown levels", () => {
  progressStore.setState({
    next: LEVELS.length,
    bestMs: { [LEVELS[0].id]: 60000, gone: 999000 },
  });
  render(<Finale onStartOver={() => {}} />);
  expect(screen.getByText("Total of best times: 1:00")).toBeInTheDocument();
});

test("Start over calls onStartOver", async () => {
  const onStartOver = vi.fn();
  render(<Finale onStartOver={onStartOver} />);
  await userEvent.click(screen.getByRole("button", { name: "Start over" }));
  expect(onStartOver).toHaveBeenCalledTimes(1);
});
