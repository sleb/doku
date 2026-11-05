import { act, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Announcer } from "./Announcer";
import { announcerStore } from "./announcerStore";

test("is a polite, atomic, visually hidden status region showing the text", () => {
  render(<Announcer />);
  const region = screen.getByRole("status");
  expect(region).toHaveAttribute("aria-live", "polite");
  expect(region).toHaveAttribute("aria-atomic", "true");
  expect(region).toHaveClass("sr-only");
  act(() => announcerStore.setState({ text: "Hello" }));
  expect(region).toHaveTextContent("Hello");
});
