import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

const html = readFileSync("index.html", "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";

function run(opts: {
  stored?: string | null;
  throws?: boolean;
  dark: boolean;
}) {
  const root = { dataset: {} as Record<string, string> };
  const meta = { content: "" };
  const localStorage = {
    getItem(key: string) {
      if (opts.throws) throw new Error("denied");
      return key === "doku:settings" ? (opts.stored ?? null) : null;
    },
  };
  runInNewContext(script, {
    document: {
      documentElement: root,
      querySelector: () => meta,
    },
    localStorage,
    matchMedia: () => ({ matches: opts.dark }),
  });
  return { theme: root.dataset.theme, color: meta.content };
}

const saved = (theme: string) => JSON.stringify({ theme });

describe("index.html no-flash script", () => {
  test("is present, before the module script", () => {
    expect(script).not.toBe("");
    expect(html.indexOf("<script>")).toBeLessThan(
      html.indexOf('type="module"'),
    );
  });
  test("declares color-scheme and theme-color metas", () => {
    expect(html).toContain('<meta name="color-scheme" content="light dark" />');
    expect(html).toContain('<meta name="theme-color"');
  });
  test("saved dark wins over a light OS", () => {
    expect(run({ stored: saved("dark"), dark: false })).toEqual({
      theme: "dark",
      color: "#1c1917",
    });
  });
  test("saved light wins over a dark OS", () => {
    expect(run({ stored: saved("light"), dark: true }).theme).toBe("light");
  });
  test("saved system follows the OS", () => {
    expect(run({ stored: saved("system"), dark: true }).theme).toBe("dark");
    expect(run({ stored: saved("system"), dark: false }).theme).toBe("light");
  });
  test("absent follows the OS", () => {
    expect(run({ dark: true }).theme).toBe("dark");
  });
  test("corrupt JSON follows the OS", () => {
    expect(run({ stored: "{nope", dark: true }).theme).toBe("dark");
    expect(run({ stored: "null", dark: false }).theme).toBe("light");
  });
  test("throwing storage follows the OS", () => {
    expect(run({ throws: true, dark: true }).theme).toBe("dark");
  });
});
