import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { TopBar } from "./TopBar";

test("shows the level title and remaining hearts", () => {
  render(<TopBar level={level} hearts={2} />);
  expect(screen.getByText(level.id)).toBeTruthy();
  expect(screen.getByRole("img", { name: "2 of 3 hearts" })).toBeTruthy();
});
