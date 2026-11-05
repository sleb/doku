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
  expect(cell).toContain("focus-visible:outline-focus");
});

test("buttons give pressed feedback, removed under reduced motion", () => {
  const rules =
    css.match(/button[^{}]*:active:not\(:disabled\)[^{}]*\{[^}]*\}/g) ?? [];
  expect(rules.join("\n")).toContain("scale(0.97)");
  expect(rules.join("\n")).toMatch(/80ms/);
  expect(rules.join("\n")).toContain(":not(.cell)");
  const reduced = css.slice(
    css.lastIndexOf("@media (prefers-reduced-motion: reduce)"),
  );
  expect(reduced).toMatch(
    /button[^{}]*:active:not\(:disabled\)[^{}]*\{[^}]*(transform: none|transition: none)/,
  );
});
