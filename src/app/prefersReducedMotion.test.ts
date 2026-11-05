import { afterEach, describe, expect, test, vi } from "vitest";
import { prefersReducedMotion } from "./motion";

afterEach(() => vi.unstubAllGlobals());

describe("prefersReducedMotion", () => {
  test("false when matchMedia is missing", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  test("reads the media query at call time", () => {
    const mm = vi.fn((q: string) => ({ matches: q.includes("reduce") }));
    vi.stubGlobal("matchMedia", mm);
    expect(prefersReducedMotion()).toBe(true);
    expect(mm).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
  });
});
