import { describe, expect, test } from "vitest";
import { HOLD_MS } from "../ui/board/hold";
import { HOLD_RAMP, IMPACT_ORDER } from "./holdRamp";

describe("HOLD_RAMP", () => {
  test("starts at 0 and strictly increases", () => {
    expect(HOLD_RAMP[0].at).toBe(0);
    HOLD_RAMP.forEach((p, i) => {
      if (i > 0) expect(p.at).toBeGreaterThan(HOLD_RAMP[i - 1].at);
    });
  });

  test("ends before HOLD_MS, leaving the peak to place", () => {
    expect(HOLD_RAMP[HOLD_RAMP.length - 1].at).toBeLessThan(HOLD_MS);
  });

  test("intensity never decreases and stays below heavy", () => {
    const ranks = HOLD_RAMP.map((p) => IMPACT_ORDER.indexOf(p.style));
    for (const r of ranks) expect(r).toBeGreaterThanOrEqual(0);
    ranks.forEach((r, i) => {
      if (i > 0) expect(r).toBeGreaterThanOrEqual(ranks[i - 1]);
    });
    expect(Math.max(...ranks)).toBeLessThan(IMPACT_ORDER.indexOf("heavy"));
  });
});
