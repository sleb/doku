import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { SwitchRow } from "./SwitchRow";

test("is a switch named by its label and mirrors checked", () => {
  render(<SwitchRow label="Sound" checked onChange={() => {}} />);
  const sw = screen.getByRole("switch", { name: "Sound" });
  expect(sw).toHaveAttribute("aria-checked", "true");
  expect(sw).toHaveClass("min-h-11");
});

test("clicking calls onChange with the inverted value", async () => {
  const onChange = vi.fn();
  render(<SwitchRow label="Sound" checked={false} onChange={onChange} />);
  await userEvent.click(screen.getByRole("switch", { name: "Sound" }));
  expect(onChange).toHaveBeenCalledWith(true);
});
