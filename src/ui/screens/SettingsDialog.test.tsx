import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { defaultSettings, settingsStore } from "../../store/settings";
import { SettingsDialog } from "./SettingsDialog";

beforeEach(() => settingsStore.setState(defaultSettings));

test("is a dialog named Settings with a Haptics switch mirroring the store", () => {
  render(<SettingsDialog onClose={() => {}} onStartOver={() => {}} />);
  expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Haptics" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("clicking the Haptics switch toggles the store and the switch", async () => {
  render(<SettingsDialog onClose={() => {}} onStartOver={() => {}} />);
  const sw = screen.getByRole("switch", { name: "Haptics" });
  await userEvent.click(sw);
  expect(settingsStore.getState().haptics).toBe(false);
  expect(sw).toHaveAttribute("aria-checked", "false");
  await userEvent.click(sw);
  expect(settingsStore.getState().haptics).toBe(true);
});

test("Done closes", async () => {
  const onClose = vi.fn();
  render(<SettingsDialog onClose={onClose} onStartOver={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Escape closes", async () => {
  const onClose = vi.fn();
  render(<SettingsDialog onClose={onClose} onStartOver={() => {}} />);
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Start over asks for confirmation first", async () => {
  const onStartOver = vi.fn();
  render(<SettingsDialog onClose={() => {}} onStartOver={onStartOver} />);
  await userEvent.click(screen.getByRole("button", { name: "Start over" }));
  expect(
    screen.getByText("Start over? Your best times are kept."),
  ).toBeInTheDocument();
  expect(onStartOver).not.toHaveBeenCalled();
});

test("Confirm calls onStartOver once and closes the sheet", async () => {
  const onStartOver = vi.fn();
  const onClose = vi.fn();
  render(<SettingsDialog onClose={onClose} onStartOver={onStartOver} />);
  await userEvent.click(screen.getByRole("button", { name: "Start over" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(onStartOver).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Cancel returns to the Start over button without acting", async () => {
  const onStartOver = vi.fn();
  render(<SettingsDialog onClose={() => {}} onStartOver={onStartOver} />);
  await userEvent.click(screen.getByRole("button", { name: "Start over" }));
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    screen.getByRole("button", { name: "Start over" }),
  ).toBeInTheDocument();
  expect(onStartOver).not.toHaveBeenCalled();
});

test("Escape cancels the confirm first, then closes the dialog", async () => {
  const onClose = vi.fn();
  render(<SettingsDialog onClose={onClose} onStartOver={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "Start over" }));
  await userEvent.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Start over" }),
  ).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});
