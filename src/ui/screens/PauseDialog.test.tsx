import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { PauseDialog } from "./PauseDialog";

test("renders nothing when closed", () => {
  const { container } = render(
    <PauseDialog
      open={false}
      onResume={() => {}}
      onRestart={() => {}}
      onRules={() => {}}
      onReplayTutorial={() => {}}
      onSettings={() => {}}
    />,
  );
  expect(container).toBeEmptyDOMElement();
});

test("Resume is focused and resumes; Restart level restarts", async () => {
  const user = userEvent.setup();
  const onResume = vi.fn();
  const onRestart = vi.fn();
  render(
    <PauseDialog
      open
      onResume={onResume}
      onRestart={onRestart}
      onRules={() => {}}
      onReplayTutorial={() => {}}
      onSettings={() => {}}
    />,
  );
  expect(screen.getByRole("dialog", { name: "Paused" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Resume" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Resume" }));
  expect(onResume).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Restart level" }));
  expect(onRestart).toHaveBeenCalledTimes(1);
});

test("Escape does not resume", async () => {
  const onResume = vi.fn();
  render(
    <PauseDialog
      open
      onResume={onResume}
      onRestart={() => {}}
      onRules={() => {}}
      onReplayTutorial={() => {}}
      onSettings={() => {}}
    />,
  );
  await userEvent.keyboard("{Escape}");
  expect(onResume).not.toHaveBeenCalled();
});

test("Rules and Settings buttons call their handlers", async () => {
  const user = userEvent.setup();
  const onRules = vi.fn();
  const onSettings = vi.fn();
  render(
    <PauseDialog
      open
      onResume={() => {}}
      onRestart={() => {}}
      onRules={onRules}
      onReplayTutorial={() => {}}
      onSettings={onSettings}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Rules" }));
  expect(onRules).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Settings" }));
  expect(onSettings).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
    "Resume",
    "Restart level",
    "Rules",
    "Replay tutorial",
    "Settings",
  ]);
});

test("Replay tutorial calls onReplayTutorial", async () => {
  const onReplayTutorial = vi.fn();
  render(
    <PauseDialog
      open
      onResume={() => {}}
      onRestart={() => {}}
      onRules={() => {}}
      onReplayTutorial={onReplayTutorial}
      onSettings={() => {}}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Replay tutorial" }),
  );
  expect(onReplayTutorial).toHaveBeenCalledTimes(1);
});
