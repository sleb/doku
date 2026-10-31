import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Hearts } from "./Hearts";

describe("Hearts", () => {
  test.each([
    [3, 3],
    [2, 3],
    [0, 3],
  ])("labels %i of %i hearts", (remaining, max) => {
    render(<Hearts remaining={remaining} max={max} />);
    expect(
      screen.getByRole("img", { name: `${remaining} of ${max} hearts` }),
    ).toBeTruthy();
  });
});

describe("Hearts icons", () => {
  test.each([
    [3, 3],
    [2, 3],
    [0, 3],
    [4, 5],
  ])("first %i of %i are filled", (remaining, max) => {
    const { container } = render(<Hearts remaining={remaining} max={max} />);
    const flags = Array.from(container.querySelectorAll("[data-filled]")).map(
      (e) => e.getAttribute("data-filled"),
    );
    expect(flags).toEqual(
      Array.from({ length: max }, (_, i) => String(i < remaining)),
    );
  });

  test("icons are hidden from assistive tech; one image exposed", () => {
    const { container } = render(<Hearts remaining={2} max={3} />);
    expect(screen.queryAllByRole("img")).toHaveLength(1);
    for (const svg of container.querySelectorAll("svg"))
      expect(svg.getAttribute("aria-hidden")).toBe("true");
  });
});
