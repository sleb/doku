import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { GameLayout } from "./GameLayout";

test("renders slots into their named areas", () => {
  const { container } = render(
    <GameLayout
      header={<p>head</p>}
      board={<p>brd</p>}
      controls={<p>ctl</p>}
    />,
  );
  expect(screen.getByText("head").closest("[data-area]")).toHaveAttribute(
    "data-area",
    "header",
  );
  expect(screen.getByText("brd").closest("[data-area]")).toHaveAttribute(
    "data-area",
    "board",
  );
  expect(screen.getByText("ctl").closest("[data-area]")).toHaveAttribute(
    "data-area",
    "controls",
  );
  expect(container.firstElementChild).toHaveClass("game-layout");
});

test("board area is a size container", () => {
  const { container } = render(
    <GameLayout header={<p>h</p>} board={<p>b</p>} />,
  );
  expect(container.querySelector("[data-area=board]")).toHaveClass(
    "game-board-area",
  );
  expect(container.querySelector("[data-area=controls]")).toBeEmptyDOMElement();
});
