import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const css = readFileSync("src/app/index.css", "utf8");

function block(opener: RegExp): string {
  const m = opener.exec(css);
  if (!m) throw new Error(`no block ${opener}`);
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) {
      return css.slice(m.index + m[0].length, i);
    }
  }
  throw new Error("unbalanced");
}

function tokens(body: string): Record<string, string> {
  return Object.fromEntries(
    [...body.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [
      m[1],
      m[2].toLowerCase(),
    ]),
  );
}

const lightBase = tokens(block(/@theme\s*\{/));
const darkOverrides = tokens(block(/:root\[data-theme="dark"\]\s*\{/));

const light = lightBase;
const dark = { ...lightBase, ...darkOverrides };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const NAMES = [
  "surface",
  "ink",
  "ink-muted",
  "line",
  "accent",
  "on-accent",
  "focus",
  "subtle",
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme tokens", (_name, t) => {
  test("defines every semantic token", () => {
    for (const n of NAMES) expect(t[n], n).toMatch(/^#[0-9a-f]{6}$/);
  });
  test.each([
    ["ink", "surface"],
    ["ink-muted", "surface"],
    ["on-accent", "accent"],
    ["ink", "subtle"],
  ])("text %s on %s is at least 4.5:1", (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
  test.each(["line", "focus", "accent"])(
    "%s on surface is at least 3:1",
    (fg) => {
      expect(contrast(t[fg], t.surface)).toBeGreaterThanOrEqual(3);
    },
  );
});

test("the dark block leaves the board palette alone", () => {
  expect(
    Object.keys(darkOverrides).filter((k) => k.startsWith("region")),
  ).toEqual([]);
  expect(block(/:root\[data-theme="dark"\]\s*\{/)).not.toContain("region");
});

test("the dark block declares color-scheme", () => {
  expect(block(/:root\[data-theme="dark"\]\s*\{/)).toContain(
    "color-scheme: dark",
  );
});

test("surface matches the theme-color constants", () => {
  expect(light.surface).toBe("#ffffff");
  expect(dark.surface).toBe("#1c1917");
});
