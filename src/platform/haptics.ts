export type HapticKind = "place" | "wrong" | "win" | "lose";

export interface Haptics {
  /** Always resolves: a failed buzz must never break gameplay. */
  play(kind: HapticKind): Promise<void>;
}

type Plugin = Pick<
  typeof import("@tauri-apps/plugin-haptics"),
  "impactFeedback" | "notificationFeedback"
>;

export interface HapticsDeps {
  isTauri(): boolean;
  /** The plugin is registered on mobile only; desktop must not invoke it. */
  isMobile(): boolean;
  loadPlugin(): Promise<Plugin>;
  /** Receives swallowed failures. */
  log(err: unknown): void;
}

/** iPhone/iPad/Android UA, or iPadOS reporting as a touch-capable Mac. */
export function detectMobile(
  ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent,
  maxTouchPoints: number = typeof navigator === "undefined"
    ? 0
    : navigator.maxTouchPoints,
): boolean {
  return (
    /iPhone|iPad|iPod|Android/i.test(ua) ||
    (/Macintosh/.test(ua) && maxTouchPoints > 1)
  );
}

/**
 * On mobile the plugin is registered, so a failure is real: keep it visible
 * even in release builds. Elsewhere stay quiet outside dev.
 */
export function defaultLog(err: unknown, mobile: boolean = detectMobile()) {
  if (mobile) console.warn("haptics:", err);
  else if (import.meta.env.DEV) console.debug("haptics:", err);
}

const defaultDeps: HapticsDeps = {
  isTauri: () =>
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window,
  isMobile: () => detectMobile(),
  loadPlugin: () => import("@tauri-apps/plugin-haptics"),
  log: (err) => defaultLog(err),
};

export function createHaptics(deps: HapticsDeps = defaultDeps): Haptics {
  let loading: Promise<Plugin> | undefined;
  const plugin = () => {
    if (!loading) {
      loading = deps.loadPlugin();
      loading.catch(() => {
        loading = undefined; // allow a later play to retry
      });
    }
    return loading;
  };

  return {
    async play(kind) {
      try {
        if (!deps.isTauri() || !deps.isMobile()) return;
        const p = await plugin();
        const result =
          kind === "place"
            ? await p.impactFeedback("light")
            : await p.notificationFeedback(
                kind === "wrong"
                  ? "warning"
                  : kind === "win"
                    ? "success"
                    : "error",
              );
        if (result?.status === "error") deps.log(result.error);
      } catch (err) {
        // The call failed: never break gameplay.
        deps.log(err);
      }
    },
  };
}

export const haptics: Haptics = createHaptics();
