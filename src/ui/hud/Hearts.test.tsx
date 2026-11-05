import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { fxStore } from "../fx/fxStore";
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

describe("Hearts pop", () => {
  beforeEach(() => fxStore.setState({ last: null, seq: 0 }, false));
  const popped = (c: HTMLElement) =>
    Array.from(c.querySelectorAll("svg")).flatMap((e, i) =>
      e.hasAttribute("data-pop") ? [i] : [],
    );

  test("no pop by default", () => {
    const { container } = render(<Hearts remaining={3} max={3} />);
    expect(popped(container)).toEqual([]);
  });

  test("a wrong outcome pops the heart that just emptied", () => {
    const { container } = render(<Hearts remaining={2} max={3} />);
    act(() =>
      fxStore.getState().set({ kind: "wrong", cell: 1, faces: 0, hearts: 2 }),
    );
    expect(popped(container)).toEqual([2]);
  });

  test("the final loss pops the last heart", () => {
    const { container } = render(<Hearts remaining={0} max={3} />);
    act(() =>
      fxStore.getState().set({ kind: "lose", cell: 1, faces: 0, hearts: 0 }),
    );
    expect(popped(container)).toEqual([0]);
  });

  test("place and win do not pop", () => {
    const { container } = render(<Hearts remaining={3} max={3} />);
    act(() =>
      fxStore.getState().set({ kind: "place", cell: 1, faces: 1, hearts: 3 }),
    );
    expect(popped(container)).toEqual([]);
    act(() => fxStore.getState().set({ kind: "win", faces: 7, hearts: 3 }));
    expect(popped(container)).toEqual([]);
  });

  test("clearing removes the pop", () => {
    const { container } = render(<Hearts remaining={2} max={3} />);
    act(() =>
      fxStore.getState().set({ kind: "wrong", cell: 1, faces: 0, hearts: 2 }),
    );
    act(() => fxStore.getState().clear());
    expect(popped(container)).toEqual([]);
  });
});
