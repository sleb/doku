/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { GLYPH_COLOR, REGION_BG, REGION_NAMES, WRONG_COLOR } from "./palette";

function tokenHex(i: number): string {
  const m = css.match(
    new RegExp(`--color-region-${i}:\\s*(#[0-9a-fA-F]{6})\\s*;`),
  );
  if (!m) throw new Error(`--color-region-${i} missing or not a hex color`);
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

describe("region palette", () => {
  test("has 11 background classes in token order", () => {
    expect(REGION_BG).toHaveLength(11);
    REGION_BG.forEach((c, i) => {
      expect(c).toBe(`bg-region-${i}`);
    });
  });

  test("has 11 unique non-empty names", () => {
    expect(REGION_NAMES).toHaveLength(11);
    expect(new Set(REGION_NAMES).size).toBe(11);
    for (const n of REGION_NAMES) expect(n.length).toBeGreaterThan(0);
  });

  test("css defines every token as a unique hex color", () => {
    const hexes = REGION_BG.map((_, i) => tokenHex(i).toLowerCase());
    expect(new Set(hexes).size).toBe(11);
  });

  test("every pair of region colors is at least 40 apart in RGB distance", () => {
    const rgb = (hex: string) =>
      [1, 3, 5].map((o) => Number.parseInt(hex.slice(o, o + 2), 16));
    for (let i = 0; i < 11; i++) {
      for (let j = i + 1; j < 11; j++) {
        const [a, b] = [rgb(tokenHex(i)), rgb(tokenHex(j))];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        expect(
          d,
          `${REGION_NAMES[i]} vs ${REGION_NAMES[j]}`,
        ).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test("glyph color reaches 3:1 contrast on every region color", () => {
    REGION_BG.forEach((_, i) => {
      expect(contrast(GLYPH_COLOR, tokenHex(i))).toBeGreaterThanOrEqual(3);
    });
  });

  test("wrong-tap red reaches 3:1 contrast on every region color", () => {
    REGION_BG.forEach((_, i) => {
      expect(
        contrast(WRONG_COLOR, tokenHex(i)),
        REGION_NAMES[i],
      ).toBeGreaterThanOrEqual(3);
    });
  });
});
