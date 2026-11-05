/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { REGION_NAMES } from "../../engine";
import {
  BOARD_FRAME_COLOR,
  GLYPH_COLOR,
  HOLD_RING_COLOR,
  HOLD_UNDERSTROKE_COLOR,
  regionClass,
  WRONG_COLOR,
} from "./palette";

const PALETTES = ["default", "accessible"] as const;
const REGIONS = Array.from({ length: 11 }, (_, i) => i);
const prefix = (p: (typeof PALETTES)[number]) =>
  p === "default" ? "region" : "region-a";

function tokenHex(i: number, p: (typeof PALETTES)[number] = "default"): string {
  const m = css.match(
    new RegExp(`--color-${prefix(p)}-${i}:\\s*(#[0-9a-fA-F]{6})\\s*;`),
  );
  if (!m)
    throw new Error(`--color-${prefix(p)}-${i} missing or not a hex color`);
  return m[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((o) => {
    const c = Number.parseInt(hex.slice(o, o + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(
  new URL("../../app/index.css", import.meta.url),
  "utf8",
);

describe("regionClass", () => {
  test("default palette maps to bg-region-N", () => {
    REGIONS.forEach((i) => {
      expect(regionClass("default", i)).toBe(`bg-region-${i}`);
    });
  });

  test("accessible palette maps to bg-region-a-N", () => {
    REGIONS.forEach((i) => {
      expect(regionClass("accessible", i)).toBe(`bg-region-a-${i}`);
    });
  });
});

describe("region palette", () => {
  test("has 11 unique non-empty names", () => {
    expect(REGION_NAMES).toHaveLength(11);
    expect(new Set(REGION_NAMES).size).toBe(11);
    for (const n of REGION_NAMES) expect(n.length).toBeGreaterThan(0);
  });
});

describe.each(PALETTES)("%s palette", (p) => {
  test("css defines every token as a unique hex color", () => {
    const hexes = REGIONS.map((i) => tokenHex(i, p).toLowerCase());
    expect(new Set(hexes).size).toBe(11);
  });

  test("every pair of region colors is at least 40 apart in RGB distance", () => {
    const rgb = (hex: string) =>
      [1, 3, 5].map((o) => Number.parseInt(hex.slice(o, o + 2), 16));
    for (let i = 0; i < 11; i++) {
      for (let j = i + 1; j < 11; j++) {
        const [a, b] = [rgb(tokenHex(i, p)), rgb(tokenHex(j, p))];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        expect(
          d,
          `${REGION_NAMES[i]} vs ${REGION_NAMES[j]}`,
        ).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test("glyph color reaches 3:1 contrast on every region color", () => {
    REGIONS.forEach((i) => {
      expect(contrast(GLYPH_COLOR, tokenHex(i, p))).toBeGreaterThanOrEqual(3);
    });
  });

  test("wrong-tap red reaches 3:1 contrast on every region color", () => {
    REGIONS.forEach((i) => {
      expect(contrast(WRONG_COLOR, tokenHex(i, p))).toBeGreaterThanOrEqual(3);
    });
  });

  test("the cell focus ring reaches 3:1 on every region color", () => {
    const m = css.match(/--color-cell-focus:\s*(#[0-9a-fA-F]{6})\s*;/);
    if (!m) throw new Error("--color-cell-focus missing");
    REGIONS.forEach((i) => {
      expect(contrast(m[1], tokenHex(i, p))).toBeGreaterThanOrEqual(3);
    });
  });

  test("the hold ring reaches 3:1 on every region color", () => {
    REGIONS.forEach((i) => {
      expect(contrast(HOLD_RING_COLOR, tokenHex(i, p))).toBeGreaterThanOrEqual(
        3,
      );
    });
  });
});

describe("hold glow colors", () => {
  test("the under-stroke reaches 3:1 on the board frame, and the ring on it", () => {
    expect(
      contrast(HOLD_UNDERSTROKE_COLOR, BOARD_FRAME_COLOR),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(HOLD_RING_COLOR, HOLD_UNDERSTROKE_COLOR),
    ).toBeGreaterThanOrEqual(3);
  });
});
