import { fireEvent, render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ResultSkip } from "./ResultSkip";

test("is a transparent aria-hidden layer that skips on pointerdown", () => {
  const onSkip = vi.fn();
  const { container } = render(<ResultSkip onSkip={onSkip} />);
  const layer = container.firstElementChild as HTMLElement;
  expect(layer).toHaveAttribute("aria-hidden", "true");
  expect(layer).toHaveAttribute("data-testid", "result-skip");
  fireEvent.pointerDown(layer);
  expect(onSkip).toHaveBeenCalledTimes(1);
});
