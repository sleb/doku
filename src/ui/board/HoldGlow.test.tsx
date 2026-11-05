import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { HoldGlow } from "./HoldGlow";
import { HOLD_MS } from "./hold";
import { HOLD_RING_COLOR, HOLD_UNDERSTROKE_COLOR } from "./palette";

afterEach(cleanup);

function glow(row = 2, col = 3) {
  const { container } = render(<HoldGlow row={row} col={col} />);
  return container.querySelector("[data-hold-glow]") as HTMLElement;
}

describe("HoldGlow", () => {
  test("is decorative and never takes pointer events", () => {
    const g = glow();
    expect(g.getAttribute("aria-hidden")).toBe("true");
    expect(g.className).toContain("pointer-events-none");
    expect(g.className).toContain("absolute");
  });

  test("is centred on the held cell", () => {
    const g = glow(2, 3);
    expect(g.style.left).toBe("calc(var(--cell) * 3.5)");
    expect(g.style.top).toBe("calc(var(--cell) * 2.5)");
  });

  test("is finger sized: about 3 cells with a 64px floor", () => {
    const g = glow();
    expect(g.style.width).toBe("max(64px, calc(var(--cell) * 3))");
    expect(g.style.height).toBe("max(64px, calc(var(--cell) * 3))");
  });

  test("sweeps a ring over HOLD_MS with a light under-stroke", () => {
    const g = glow();
    const ring = g.querySelector("circle.hold-ring") as SVGCircleElement;
    expect(ring.getAttribute("pathLength")).toBe("1");
    expect(ring.style.animationDuration).toBe(`${HOLD_MS}ms`);
    expect(ring.getAttribute("stroke")).toBe(HOLD_RING_COLOR);
    const under = g.querySelector("circle.hold-under") as SVGCircleElement;
    expect(under.getAttribute("stroke")).toBe(HOLD_UNDERSTROKE_COLOR);
  });
});
