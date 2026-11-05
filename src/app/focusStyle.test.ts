import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const src = new URL("../", import.meta.url).pathname;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

test("one :focus-visible rule covers every control and uses the focus token", () => {
  const rules = css.match(/[^{}]*:focus-visible[^{}]*\{[^}]*\}/g) ?? [];
  expect(rules).toHaveLength(1);
  for (const sel of [
    "button",
    '[role="switch"]',
    '[role="radio"]',
    "a",
    "[tabindex]",
  ]) {
    expect(rules[0]).toContain(sel);
  }
  expect(rules[0]).toContain("outline: 3px solid var(--color-focus)");
  expect(rules[0]).toContain("outline-offset: 2px");
});

test("no component hard-codes a focus colour or its own focus style", () => {
  for (const f of sources(src)) {
    const text = readFileSync(f, "utf8");
    expect(text, f).not.toMatch(/outline-blue-/);
    if (!f.endsWith("Cell.tsx")) expect(text, f).not.toMatch(/focus-visible:/);
  }
});

test("Cell keeps its inset focus offset with the token colour", () => {
  const cell = readFileSync(join(src, "ui/board/Cell.tsx"), "utf8");
  expect(cell).toContain("focus-visible:outline-cell-focus");
  expect(cell).not.toContain("focus-visible:outline-focus");
});

test("buttons give non-geometric pressed feedback, removed under reduced motion", () => {
  const rules =
    css.match(/button[^{}]*:active:not\(:disabled\)[^{}]*\{[^}]*\}/g) ?? [];
  const joined = rules.join("\n");
  expect(joined).toContain("brightness(");
  expect(joined).not.toMatch(/transform|scale\(/);
  expect(joined).toMatch(/80ms/);
  expect(joined).toContain(":not(.cell)");
  const reduced = css.slice(
    css.lastIndexOf("@media (prefers-reduced-motion: reduce)"),
  );
  expect(reduced).toMatch(
    /button[^{}]*:active:not\(:disabled\)[^{}]*\{[^}]*(filter: none|transition: none)/,
  );
});

test("the tutorial highlight leaves the outline free for the focus ring", () => {
  const rule = css.match(/\.cell\[data-highlight\]\s*\{[^}]*\}/)?.[0] ?? "";
  expect(rule).not.toContain("outline");
  expect(css).toMatch(/\.cell\[data-highlight\]::after\s*\{[^}]*dashed/);
});
