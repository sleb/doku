import { describe, expect, test, vi } from "vitest";
import { applyTheme, resolveTheme } from "./theme";

describe("resolveTheme", () => {
  test("light and dark override the system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  test("system follows prefers-color-scheme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

function fakeDeps(dark: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: dark,
    addEventListener: vi.fn((_: string, l: () => void) => listeners.add(l)),
    removeEventListener: vi.fn((_: string, l: () => void) => {
      listeners.delete(l);
    }),
  };
  const root = { dataset: {} as Record<string, string> };
  const meta = { content: "" };
  return {
    mql,
    listeners,
    root,
    meta,
    deps: { root, meta, matchMedia: vi.fn(() => mql) },
    flip(next: boolean) {
      mql.matches = next;
      for (const l of [...listeners]) l();
    },
  };
}

describe("applyTheme", () => {
  test("sets data-theme and theme-color from the resolved theme", () => {
    const f = fakeDeps(false);
    applyTheme("dark", f.deps);
    expect(f.root.dataset.theme).toBe("dark");
    expect(f.meta.content).toBe("#1c1917");
    applyTheme("light", f.deps);
    expect(f.root.dataset.theme).toBe("light");
    expect(f.meta.content).toBe("#ffffff");
  });

  test("system follows the media query live", () => {
    const f = fakeDeps(false);
    applyTheme("system", f.deps);
    expect(f.root.dataset.theme).toBe("light");
    f.flip(true);
    expect(f.root.dataset.theme).toBe("dark");
  });

  test("does not listen unless system", () => {
    const f = fakeDeps(false);
    applyTheme("light", f.deps);
    expect(f.mql.addEventListener).not.toHaveBeenCalled();
  });

  test("unsubscribe stops following", () => {
    const f = fakeDeps(false);
    const stop = applyTheme("system", f.deps);
    stop();
    f.flip(true);
    expect(f.root.dataset.theme).toBe("light");
  });

  test("works without matchMedia or a meta tag", () => {
    const root = { dataset: {} as Record<string, string> };
    const stop = applyTheme("system", {
      root,
      meta: null,
      matchMedia: undefined,
    });
    expect(root.dataset.theme).toBe("light");
    stop();
  });

  test("tolerates a matchMedia result without event listeners", () => {
    const root = { dataset: {} as Record<string, string> };
    const stop = applyTheme("system", {
      root,
      meta: null,
      matchMedia: (() => ({ matches: true })) as never,
    });
    expect(root.dataset.theme).toBe("dark");
    stop();
  });
});
