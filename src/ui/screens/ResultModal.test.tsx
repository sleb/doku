import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ResultModal } from "./ResultModal";

const modal = (
  status: "won" | "lost" | "playing" | "idle",
  props: Partial<React.ComponentProps<typeof ResultModal>> = {},
) => (
  <ResultModal
    status={status}
    elapsedMs={83000}
    bestMs={83000}
    hintsUsed={0}
    isLast={false}
    onRetry={() => {}}
    onNext={() => {}}
    {...props}
  />
);

const won = (props: Partial<React.ComponentProps<typeof ResultModal>> = {}) =>
  modal("won", props);
const lost = (props: Partial<React.ComponentProps<typeof ResultModal>> = {}) =>
  modal("lost", props);

describe("ResultModal", () => {
  test.each(["playing", "idle"] as const)(
    "renders nothing while %s",
    (status) => {
      const { container } = render(modal(status));
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  test("won shows a modal dialog named 'You solved it'", () => {
    render(won());
    const dialog = screen.getByRole("dialog", { name: "You solved it" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  test("lost shows a dialog named 'Out of hearts'", () => {
    render(lost());
    expect(
      screen.getByRole("dialog", { name: "Out of hearts" }),
    ).toBeInTheDocument();
  });

  test("the action button has focus on open and when remounted", () => {
    const { rerender } = render(won());
    expect(screen.getByRole("button", { name: "Next level" })).toHaveFocus();
    rerender(modal("playing"));
    rerender(lost());
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
  });

  test("click, Enter and Space each call onRetry once", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(lost({ onRetry }));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    expect(onRetry).toHaveBeenCalledTimes(2);
    await user.keyboard(" ");
    expect(onRetry).toHaveBeenCalledTimes(3);
  });

  test("Tab and Shift+Tab keep focus on the action button", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">before</button>
        {lost()}
        <button type="button">after</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
  });
});

describe("ResultModal stats", () => {
  test("won shows the time taken", () => {
    render(
      <ResultModal
        status="won"
        elapsedMs={83000}
        bestMs={83000}
        hintsUsed={0}
        isLast={false}
        onRetry={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getByText("Time: 1:23")).toBeInTheDocument();
  });

  test("a time equal to the best shows New best", () => {
    render(won());
    expect(screen.getByText("New best")).toBeInTheDocument();
  });

  test("a slower time shows the best instead", () => {
    render(won({ elapsedMs: 90000, bestMs: 83000 }));
    expect(screen.getByText("Best: 1:23")).toBeInTheDocument();
    expect(screen.queryByText("New best")).toBeNull();
  });

  test("hints are shown only when some were used", () => {
    const { rerender } = render(won({ hintsUsed: 2 }));
    expect(screen.getByText("Hints: 2")).toBeInTheDocument();
    rerender(won({ hintsUsed: 0 }));
    expect(screen.queryByText(/Hints/)).toBeNull();
  });

  test("won offers Next level, which calls onNext, and no Retry", async () => {
    const onNext = vi.fn();
    render(won({ onNext }));
    await userEvent.click(screen.getByRole("button", { name: "Next level" }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  test("the last level offers Finish instead of Next level", () => {
    render(won({ isLast: true }));
    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next level" })).toBeNull();
  });
});
