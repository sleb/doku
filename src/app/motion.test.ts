import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

/** The body of the `prefers-reduced-motion: reduce` blocks, concatenated. */
function reducedBlocks(): string {
  const out: string[] = [];
  const re = /@media \(prefers-reduced-motion: reduce\) \{/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < css.length) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    out.push(css.slice(re.lastIndex, i - 1));
  }
  return out.join("\n");
}

function rule(source: string, selector: string): string {
  const at = source.indexOf(`${selector} {`);
  expect(at, `${selector} rule`).toBeGreaterThanOrEqual(0);
  const start = source.lastIndexOf("}", at) + 1;
  return source.slice(start, source.indexOf("}", at));
}

describe("effect keyframes", () => {
  test.each([
    "fx-place",
    "fx-wrong",
    "fx-ring",
    "heart-pop",
    "dialog-in",
    "fx-fade",
  ])("defines @keyframes %s", (name) => {
    expect(css).toContain(`@keyframes ${name}`);
  });

  test("effects animate only transform and opacity", () => {
    const frames = [
      ...css.matchAll(
        /@keyframes (fx-|heart-pop|dialog-in)[^{]*\{([\s\S]*?\n\})/g,
      ),
    ];
    expect(frames.length).toBeGreaterThan(0);
    for (const [, , body] of frames)
      for (const [, prop] of body.matchAll(/^\s+([a-z-]+):/gm))
        expect(["transform", "opacity", "scale"]).toContain(prop);
  });
});

describe("reduced motion", () => {
  const reduced = reducedBlocks();

  test("cell effects become a plain opacity fade", () => {
    const r = rule(reduced, '[data-fx="wrong"]');
    expect(r).toContain('[data-fx="place"],');
    expect(r).toContain("animation-name: fx-fade");
    expect(r).not.toMatch(/transform|scale/);
  });

  test("the ring and heart pop are removed", () => {
    expect(rule(reduced, ".fx-ring")).toContain("animation: none");
    expect(rule(reduced, '[data-pop="true"]')).toContain("animation: none");
  });

  test("the dialog keeps opacity only", () => {
    const r = rule(reduced, ".dialog-in");
    expect(r).toContain("animation-name: fx-fade");
    expect(r).not.toMatch(/transform|scale/);
  });
});
