import { describe, expect, it } from "vitest";

const FORBIDDEN =
  /^(?:(?:(?:\.{1,2}\/)+|\/|@\/)(?:src\/)?(?:ui|store|platform)(?:\/|$)|@tauri-apps\/)/;

const SPECIFIER_PATTERNS = [
  /\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\s*["']([^"']+)["']/g,
];

function findForbiddenImports(source: string): string[] {
  const found: string[] = [];
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      if (FORBIDDEN.test(match[1])) found.push(match[1]);
    }
  }
  return found;
}

function findNondeterminism(source: string): string[] {
  return [...source.matchAll(/\bMath\.random\b|\bDate\./g)].map((m) => m[0]);
}

describe("findNondeterminism", () => {
  it.each([
    ["const x = Math.random();", ["Math.random"]],
    ["const t = Date.now();", ["Date."]],
  ])("flags %j", (source, expected) => {
    expect(findNondeterminism(source)).toEqual(expected);
  });

  it("allows deterministic code", () => {
    expect(findNondeterminism("const x = Math.floor(1.5);")).toEqual([]);
  });
});

describe("findForbiddenImports", () => {
  it.each([
    [`import { x } from "../ui/x";`, "../ui/x"],
    [`import { y } from "../../store/y";`, "../../store/y"],
    [`import s from "../platform/storage";`, "../platform/storage"],
    [`import { invoke } from "@tauri-apps/api/core";`, "@tauri-apps/api/core"],
    [
      `const m = await import("@tauri-apps/plugin-opener");`,
      "@tauri-apps/plugin-opener",
    ],
    [`export * from "../ui";`, "../ui"],
    [`import {\n  a,\n  b,\n} from "../ui";`, "../ui"],
    [`import "../ui/side-effect";`, "../ui/side-effect"],
    [`import { g } from "../../src/store/game";`, "../../src/store/game"],
    [`import { B } from "../../../src/ui/Board";`, "../../../src/ui/Board"],
    [`import { x } from "/src/ui/x";`, "/src/ui/x"],
    [`import { x } from "@/ui/x";`, "@/ui/x"],
    [`import { x } from "@/store/x";`, "@/store/x"],
    [`import { x } from "@/platform/x";`, "@/platform/x"],
  ])("flags %j", (source, specifier) => {
    expect(findForbiddenImports(source)).toEqual([specifier]);
  });

  it.each([
    `import { a } from "./board";`,
    `import { it } from "vitest";`,
    `import type { T } from "../types";`,
  ])("allows %j", (source) => {
    expect(findForbiddenImports(source)).toEqual([]);
  });
});

describe("engine isolation", () => {
  const sources = import.meta.glob("./**/*.{ts,tsx,js,jsx,mts,cts}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  it("scans engine files", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(5);
  });

  it("imports nothing from ui, store, platform or Tauri", () => {
    const offenders = Object.entries(sources)
      .filter(([file]) => file !== "./isolation.test.ts")
      .flatMap(([file, src]) =>
        findForbiddenImports(src).map((spec) => `${file} imports ${spec}`),
      );
    expect(offenders).toEqual([]);
  });

  it("uses no Math.random or Date in engine sources", () => {
    const offenders = Object.entries(sources)
      .filter(([file]) => !/\.test\.[a-z]+$/.test(file))
      .flatMap(([file, src]) =>
        findNondeterminism(src).map((tok) => `${file} uses ${tok}`),
      );
    expect(offenders).toEqual([]);
  });

  it("runs without a DOM", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });
});
