/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { GLYPH_COLOR } from "./palette";
import { PATTERN_NAMES, PATTERN_OPACITY, patternStyle } from "./patterns";

const REGIONS = Array.from({ length: 11 }, (_, i) => i);

describe("patterns", () => {
  test("has 11 unique names, solid first", () => {
    expect(PATTERN_NAMES).toHaveLength(11);
    expect(new Set(PATTERN_NAMES).size).toBe(11);
    expect(PATTERN_NAMES[0]).toBe("solid");
  });

  test("region 0 is solid: no background image", () => {
    expect(patternStyle(0)).toEqual({});
  });

  test("every other region has an inline SVG background", () => {
    for (const r of REGIONS.slice(1)) {
      const { backgroundImage, backgroundSize, backgroundOrigin } =
        patternStyle(r);
      expect(backgroundOrigin).toBe("border-box");
      expect(backgroundImage, PATTERN_NAMES[r]).toMatch(
        /^url\("data:image\/svg\+xml,/,
      );
      expect(backgroundSize).toContain("var(--cell)");
    }
  });

  test("all 11 styles are distinct", () => {
    const keys = REGIONS.map((r) => JSON.stringify(patternStyle(r)));
    expect(new Set(keys).size).toBe(11);
  });

  test("styles are module constants (stable identity across calls)", () => {
    for (const r of REGIONS) expect(patternStyle(r)).toBe(patternStyle(r));
  });

  test("strokes are dark and at most 25% alpha", () => {
    expect(PATTERN_OPACITY).toBeLessThanOrEqual(0.25);
    for (const r of REGIONS.slice(1)) {
      const svg = decodeURIComponent(
        String(patternStyle(r).backgroundImage).replace(
          /^url\("data:image\/svg\+xml,|"\)$/g,
          "",
        ),
      );
      expect(svg, PATTERN_NAMES[r]).toContain(`opacity='${PATTERN_OPACITY}'`);
      expect(svg).toMatch(/stroke='#000'|fill='#000'/);
    }
  });

  test("the glyph keeps 3:1 over the pattern on every region color", () => {
    const css = readFileSync(
      new URL("../../app/index.css", import.meta.url),
      "utf8",
    );
    const lin = (c: number) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    const lum = (rgb: number[]) =>
      0.2126 * lin(rgb[0] / 255) +
      0.7152 * lin(rgb[1] / 255) +
      0.0722 * lin(rgb[2] / 255);
    const rgb = (h: string) =>
      [1, 3, 5].map((o) => Number.parseInt(h.slice(o, o + 2), 16));
    const glyph = lum(rgb(GLYPH_COLOR));
    for (const prefix of ["region", "region-a"]) {
      for (const r of REGIONS) {
        const m = css.match(
          new RegExp(`--color-${prefix}-${r}:\\s*(#[0-9a-fA-F]{6})`),
        );
        if (!m) throw new Error("token missing");
        // Black at PATTERN_OPACITY composited over the region color.
        const dark = rgb(m[1]).map((c) => c * (1 - PATTERN_OPACITY));
        const l = lum(dark);
        expect(
          (l + 0.05) / (glyph + 0.05),
          `${prefix}-${r}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
