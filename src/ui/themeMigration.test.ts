import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "board" ? [] : files(p);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

const LITERAL =
  /\b(?:bg|text|border|ring|stroke|fill|divide|outline|from|to|via)-(?:white|black|(?:stone|neutral|slate|gray|zinc|red|blue)-\d+)(?:\/\d+)?\b/g;

/** Literal on purpose: the dialog scrim and the red heart are theme-independent. */
const ALLOWED = new Set([
  "bg-black/50",
  "fill-current",
  "stroke-red-500",
  "text-red-500",
]);

test("chrome uses theme tokens, not literal Tailwind colours", () => {
  const offenders = [...files("src/ui"), "src/App.tsx"].flatMap((f) =>
    [...readFileSync(f, "utf8").matchAll(LITERAL)]
      .map((m) => m[0])
      .filter((c) => !ALLOWED.has(c))
      .map((c) => `${f}: ${c}`),
  );
  expect(offenders).toEqual([]);
});
