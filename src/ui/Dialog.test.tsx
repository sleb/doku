import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Dialog } from "./Dialog";

function Page({ onClose }: { onClose?: () => void }) {
  return (
    <>
      <button type="button">outside</button>
      <Dialog title="Hello" onClose={onClose}>
        <button type="button">first</button>
        <button type="button">last</button>
      </Dialog>
    </>
  );
}

test("is a modal dialog named by its title", () => {
  render(<Page />);
  const dialog = screen.getByRole("dialog", { name: "Hello" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog).toHaveAttribute("aria-labelledby");
});

test("focuses the first control on open and restores focus on close", () => {
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  const { unmount } = render(<Page />);
  expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
  unmount();
  expect(outside).toHaveFocus();
  outside.remove();
});

test("prefers the element marked data-autofocus", () => {
  render(
    <Dialog title="T">
      <button type="button">a</button>
      <button type="button" data-autofocus>
        b
      </button>
    </Dialog>,
  );
  expect(screen.getByRole("button", { name: "b" })).toHaveFocus();
});

test("Tab and Shift+Tab cycle within the dialog", async () => {
  const user = userEvent.setup();
  render(<Page />);
  await user.tab();
  expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
  await user.tab({ shift: true });
  expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
});

test("Escape closes only when onClose is passed", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const { unmount } = render(<Page />);
  await user.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
  unmount();
  render(<Page onClose={onClose} />);
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("makes siblings inert while open and restores them after", () => {
  const { unmount } = render(<Page />);
  const outside = screen.getByRole("button", { name: "outside", hidden: true });
  expect(outside).toHaveAttribute("inert");
  unmount();
  expect(outside).not.toHaveAttribute("inert");
});

test("does not leave a pre-inert sibling un-inert", () => {
  const host = document.createElement("div");
  const pre = document.createElement("div");
  pre.setAttribute("inert", "");
  host.append(pre);
  document.body.append(host);
  const { unmount } = render(<Dialog title="T">x</Dialog>, { container: host });
  unmount();
  expect(pre).toHaveAttribute("inert");
  host.remove();
});

test("children scroll inside a capped panel", () => {
  render(<Page />);
  const panel = screen.getByRole("dialog");
  expect(panel).toHaveClass("max-h-full", "min-h-0");
  const scroller = screen.getByTestId("dialog-body");
  expect(scroller).toHaveClass("flex-1", "min-h-0", "overflow-y-auto");
  expect(scroller).toContainElement(
    screen.getByRole("button", { name: "first" }),
  );
});

test("animates in with a class only: focus and input are unaffected", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<Page onClose={onClose} />);
  const dialog = screen.getByRole("dialog", { name: "Hello" });
  expect(dialog.parentElement).toHaveClass("dialog-in");
  expect(dialog.parentElement).not.toHaveAttribute("inert");
  expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});
