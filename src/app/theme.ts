import type { Settings } from "../store/settings";

export type ResolvedTheme = "light" | "dark";

/** `theme-color` per resolved theme; must match `--color-surface` in index.css. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#ffffff",
  dark: "#1c1917",
};

const QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(
  setting: Settings["theme"],
  prefersDark: boolean,
): ResolvedTheme {
  if (setting === "system") return prefersDark ? "dark" : "light";
  return setting;
}

type MediaQueryLike = {
  matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
};

export type ThemeDeps = {
  root: { dataset: DOMStringMap | Record<string, string | undefined> } | null;
  meta: { content: string } | null;
  matchMedia: ((query: string) => MediaQueryLike) | undefined;
};

function browserDeps(): ThemeDeps {
  if (typeof document === "undefined") {
    return { root: null, meta: null, matchMedia: undefined };
  }
  return {
    root: document.documentElement,
    meta: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]'),
    matchMedia:
      typeof window.matchMedia === "function"
        ? (q) => window.matchMedia(q)
        : undefined,
  };
}

/**
 * Sets `data-theme` on `<html>` and the `theme-color` meta. While the setting is
 * `system` it follows the OS live. Returns an unsubscribe.
 */
export function applyTheme(
  setting: Settings["theme"],
  deps: ThemeDeps = browserDeps(),
): () => void {
  const mql = setting === "system" ? deps.matchMedia?.(QUERY) : undefined;
  const apply = () => {
    const theme = resolveTheme(setting, mql?.matches ?? false);
    if (deps.root) deps.root.dataset.theme = theme;
    if (deps.meta) deps.meta.content = THEME_COLOR[theme];
  };
  apply();
  if (typeof mql?.addEventListener !== "function") return () => {};
  mql.addEventListener("change", apply);
  return () => mql.removeEventListener("change", apply);
}
