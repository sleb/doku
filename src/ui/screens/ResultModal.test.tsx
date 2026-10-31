import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ResultModal } from "./ResultModal";

describe("ResultModal", () => {
  test.each(["playing", "idle"] as const)(
    "renders nothing while %s",
    (status) => {
      const { container } = render(
        <ResultModal status={status} onRetry={() => {}} />,
      );
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  test("won shows a modal dialog named 'You solved it'", () => {
    render(<ResultModal status="won" onRetry={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "You solved it" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  test("lost shows a dialog named 'Out of hearts'", () => {
    render(<ResultModal status="lost" onRetry={() => {}} />);
    expect(
      screen.getByRole("dialog", { name: "Out of hearts" }),
    ).toBeInTheDocument();
  });

  test("Retry has focus on open and when remounted with another status", () => {
    const { rerender } = render(
      <ResultModal status="won" onRetry={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
    rerender(<ResultModal status="playing" onRetry={() => {}} />);
    rerender(<ResultModal status="lost" onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
  });

  test("click, Enter and Space each call onRetry once", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ResultModal status="won" onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    expect(onRetry).toHaveBeenCalledTimes(2);
    await user.keyboard(" ");
    expect(onRetry).toHaveBeenCalledTimes(3);
  });

  test("Tab and Shift+Tab keep focus on Retry", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">before</button>
        <ResultModal status="lost" onRetry={() => {}} />
        <button type="button">after</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
  });
});
