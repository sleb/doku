import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { boot } from "../../app/boot";
import { haptics } from "../../platform/haptics";
import { MemoryStorage } from "../../platform/storage";
import { defaultSettings, settingsStore } from "../../store/settings";
import { SettingsDialog } from "./SettingsDialog";

beforeEach(() => {
  settingsStore.setState(defaultSettings);
  vi.spyOn(haptics, "supported").mockReturnValue(true);
});

afterEach(() => vi.restoreAllMocks());

const open = () =>
  render(<SettingsDialog onClose={() => {}} onStartOver={() => {}} />);

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

test("shows the Feedback, Display, Play sections", () => {
  open();
  for (const name of ["Feedback", "Display", "Play"]) {
    expect(screen.getByRole("heading", { name })).toBeInTheDocument();
  }
});

test("the Haptics row is hidden where haptics are unsupported", () => {
  vi.spyOn(haptics, "supported").mockReturnValue(false);
  open();
  expect(screen.queryByRole("switch", { name: "Haptics" })).toBeNull();
  expect(screen.getByRole("switch", { name: "Sound" })).toBeInTheDocument();
});

test("Sound and Patterns switches toggle their fields", async () => {
  open();
  await userEvent.click(screen.getByRole("switch", { name: "Sound" }));
  expect(settingsStore.getState().sound).toBe(false);
  await userEvent.click(screen.getByRole("switch", { name: "Patterns" }));
  expect(settingsStore.getState().patterns).toBe(true);
});

test("Theme radiogroup sets theme", async () => {
  open();
  const group = screen.getByRole("radiogroup", { name: "Theme" });
  expect(within(group).getByRole("radio", { name: "System" })).toBeChecked();
  await userEvent.click(within(group).getByRole("radio", { name: "Dark" }));
  expect(settingsStore.getState().theme).toBe("dark");
  expect(within(group).getByRole("radio", { name: "Dark" })).toBeChecked();
  await userEvent.click(within(group).getByRole("radio", { name: "Light" }));
  expect(settingsStore.getState().theme).toBe("light");
});

test("choosing Dark switches the document theme once booted", async () => {
  await boot(new MemoryStorage(), { devLevel: 0 });
  open();
  const group = screen.getByRole("radiogroup", { name: "Theme" });
  await userEvent.click(within(group).getByRole("radio", { name: "Dark" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  await userEvent.click(within(group).getByRole("radio", { name: "Light" }));
  expect(document.documentElement.dataset.theme).toBe("light");
});

test("Colors radiogroup sets palette", async () => {
  open();
  const group = screen.getByRole("radiogroup", { name: "Colors" });
  await userEvent.click(
    within(group).getByRole("radio", { name: "Color-blind safe" }),
  );
  expect(settingsStore.getState().palette).toBe("accessible");
  await userEvent.click(within(group).getByRole("radio", { name: "Default" }));
  expect(settingsStore.getState().palette).toBe("default");
});

test("Tap places faces switch maps to inputMode", async () => {
  open();
  const sw = screen.getByRole("switch", { name: "Tap places faces" });
  expect(sw).toHaveAttribute("aria-checked", "false");
  await userEvent.click(sw);
  expect(settingsStore.getState().inputMode).toBe("face");
  expect(sw).toHaveAttribute("aria-checked", "true");
  await userEvent.click(sw);
  expect(settingsStore.getState().inputMode).toBe("mark");
});

test("the body scrolls inside the safe area", () => {
  open();
  const body = screen.getByTestId("dialog-body");
  expect(body).toHaveClass("overflow-y-auto");
  expect(body).toHaveClass("flex-1", "min-h-0");
  expect(screen.getByRole("dialog")).toHaveClass("max-h-full", "min-h-0");
});

test("Theme radiogroup is operable by arrow keys", async () => {
  open();
  const group = screen.getByRole("radiogroup", { name: "Theme" });
  within(group).getByRole("radio", { name: "System" }).focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(settingsStore.getState().theme).toBe("light");
  expect(within(group).getByRole("radio", { name: "Light" })).toHaveFocus();
});
