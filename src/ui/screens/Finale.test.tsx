import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { LEVELS } from "../../levels/campaign";
import { defaultProgress, progressStore } from "../../store/progress";
import { formatClock } from "../hud/formatClock";
import { Finale } from "./Finale";

beforeEach(() => progressStore.setState(defaultProgress));

test("congratulates the player", () => {
  render(<Finale onStartOver={() => {}} />);
  expect(screen.getByRole("heading", { name: "You finished" })).toBeTruthy();
});

const allBests = (ms: number) =>
  Object.fromEntries(LEVELS.map((l) => [l.id, ms]));

test("shows the total of best times", () => {
  progressStore.setState({
    next: LEVELS.length,
    bestMs: { ...allBests(60000), [LEVELS[1].id]: 65000 },
  });
  render(<Finale onStartOver={() => {}} />);
  const total = (LEVELS.length - 1) * 60 + 65;
  expect(
    screen.getByText(
      `Total of best times: ${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`,
    ),
  ).toBeInTheDocument();
});

test("ignores best times for unknown levels", () => {
  progressStore.setState({
    next: LEVELS.length,
    bestMs: { ...allBests(60000), gone: 999000 },
  });
  render(<Finale onStartOver={() => {}} />);
  expect(screen.getByText(/^Total of best times: /).textContent).toBe(
    `Total of best times: ${formatClock(LEVELS.length * 60)}`,
  );
});

test("a level without a recorded best leaves the total out", () => {
  progressStore.setState({
    next: LEVELS.length,
    bestMs: { [LEVELS[0].id]: 60000 },
  });
  render(<Finale onStartOver={() => {}} />);
  expect(screen.queryByText(/Total of best times/)).toBeNull();
  expect(screen.getByText(/some best times are missing/i)).toBeInTheDocument();
});

test("Start over calls onStartOver", async () => {
  const onStartOver = vi.fn();
  render(<Finale onStartOver={onStartOver} />);
  await userEvent.click(screen.getByRole("button", { name: "Start over" }));
  expect(onStartOver).toHaveBeenCalledTimes(1);
});
