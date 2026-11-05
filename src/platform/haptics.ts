import { HOLD_RAMP } from "./holdRamp";
import type { OutcomeKind } from "./outcome";

export interface Haptics {
  /** Always resolves: a failed buzz must never break gameplay. */
  play(kind: OutcomeKind): Promise<void>;
  /** True only in a Tauri build on mobile, where the plugin is registered. */
  supported(): boolean;
  /**
   * Starts the hold build-up pulses (`HOLD_RAMP`) and returns an idempotent
   * cancel. A new ramp cancels the previous one. No-op when unsupported.
   */
  ramp(): () => void;
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
  /** Timer functions; default to the globals. */
  setTimeout?(fn: () => void, ms: number): unknown;
  clearTimeout?(handle: unknown): void;
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

  const supported = () => deps.isTauri() && deps.isMobile();

  const setT = deps.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT =
    deps.clearTimeout ??
    ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let cancelCurrent: (() => void) | undefined;

  const impact = async (style: "soft" | "light" | "medium" | "heavy") => {
    try {
      const p = await plugin();
      const result = await p.impactFeedback(style);
      if (result?.status === "error") deps.log(result.error);
    } catch (err) {
      deps.log(err);
    }
  };

  return {
    supported,
    ramp() {
      cancelCurrent?.();
      cancelCurrent = undefined;
      if (!supported()) return () => {};
      const handles = HOLD_RAMP.map(({ at, style }) =>
        setT(() => void impact(style), at),
      );
      const cancel = () => {
        for (const h of handles) clearT(h);
        if (cancelCurrent === cancel) cancelCurrent = undefined;
      };
      cancelCurrent = cancel;
      return cancel;
    },
    async play(kind) {
      try {
        if (!supported()) return;
        const p = await plugin();
        const result =
          kind === "place"
            ? await p.impactFeedback("heavy")
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
