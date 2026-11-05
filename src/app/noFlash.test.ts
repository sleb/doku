// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const html = readFileSync("index.html", "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";

function run(items: Record<string, string>, dark = false) {
  vi.stubGlobal("matchMedia", () => ({ matches: dark }));
  localStorage.clear();
  for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
  delete document.documentElement.dataset.theme;
  new Function(script)();
  return document.documentElement.dataset.theme;
}

beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="#ffffff">';
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("no-flash inline script", () => {
  test("found the script", () => expect(script).toContain("doku:theme"));
  test("reads doku:theme", () => {
    expect(run({ "doku:theme": "dark" })).toBe("dark");
    expect(run({ "doku:theme": "light" }, true)).toBe("light");
  });
  test("doku:theme wins over doku:settings", () => {
    expect(
      run({ "doku:theme": "light", "doku:settings": '{"theme":"dark"}' }),
    ).toBe("light");
  });
  test("system or absent follows the OS", () => {
    expect(run({ "doku:theme": "system" }, true)).toBe("dark");
    expect(run({}, false)).toBe("light");
    expect(run({}, true)).toBe("dark");
  });
  test("falls back to doku:settings", () => {
    expect(run({ "doku:settings": '{"theme":"dark"}' })).toBe("dark");
  });
  test("corrupt settings fall back to the OS", () => {
    expect(run({ "doku:settings": "{nope" }, true)).toBe("dark");
  });
  test("throwing storage falls back to the OS", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    delete document.documentElement.dataset.theme;
    new Function(script)();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
