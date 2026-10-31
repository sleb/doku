/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { GLYPH_COLOR, REGION_BG, REGION_NAMES } from "./palette";

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

  test("glyph color reaches 3:1 contrast on every region color", () => {
    REGION_BG.forEach((_, i) => {
      expect(contrast(GLYPH_COLOR, tokenHex(i))).toBeGreaterThanOrEqual(3);
    });
  });
});
