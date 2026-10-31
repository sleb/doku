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
