import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RulesDialog } from "./RulesDialog";

test("is a dialog named Rules", () => {
  render(<RulesDialog onClose={() => {}} />);
  expect(screen.getByRole("dialog", { name: "Rules" })).toBeInTheDocument();
});

test("states the four rules", () => {
  render(<RulesDialog onClose={() => {}} />);
  const dialog = screen.getByRole("dialog", { name: "Rules" });
  expect(dialog).toHaveTextContent(/one face in each colored region/i);
  expect(dialog).toHaveTextContent(/one face in each row and column/i);
  expect(dialog).toHaveTextContent(/no two faces touch, even diagonally/i);
  expect(dialog).toHaveTextContent(/wrong taps cost a heart/i);
});

test("has an input cheat sheet", () => {
  render(<RulesDialog onClose={() => {}} />);
  const dialog = screen.getByRole("dialog", { name: "Rules" });
  expect(dialog).toHaveTextContent(/tap.*✕/i);
  expect(dialog).toHaveTextContent(/hold.*face/i);
  for (const key of ["Arrows", "x", "Space", "z", "h", "Esc"]) {
    expect(screen.getByText(key, { selector: "kbd" })).toBeInTheDocument();
  }
});

test("Got it is focused and closes", async () => {
  const onClose = vi.fn();
  render(<RulesDialog onClose={onClose} />);
  const got = screen.getByRole("button", { name: "Got it" });
  expect(got).toHaveFocus();
  await userEvent.click(got);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Escape closes", async () => {
  const onClose = vi.fn();
  render(<RulesDialog onClose={onClose} />);
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});
