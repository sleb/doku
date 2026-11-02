import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { defaultSettings, settingsStore } from "../../store/settings";
import { SettingsDialog } from "./SettingsDialog";

beforeEach(() => settingsStore.setState(defaultSettings));

test("is a dialog named Settings with a Haptics switch mirroring the store", () => {
  render(<SettingsDialog onClose={() => {}} />);
  expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Haptics" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("clicking the Haptics switch toggles the store and the switch", async () => {
  render(<SettingsDialog onClose={() => {}} />);
  const sw = screen.getByRole("switch", { name: "Haptics" });
  await userEvent.click(sw);
  expect(settingsStore.getState().haptics).toBe(false);
  expect(sw).toHaveAttribute("aria-checked", "false");
  await userEvent.click(sw);
  expect(settingsStore.getState().haptics).toBe(true);
});

test("Done closes", async () => {
  const onClose = vi.fn();
  render(<SettingsDialog onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Escape closes", async () => {
  const onClose = vi.fn();
  render(<SettingsDialog onClose={onClose} />);
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});
