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
  loadPlugin(): Promise<Plugin>;
  /** Receives swallowed failures. */
  log(err: unknown): void;
}

const defaultDeps: HapticsDeps = {
  isTauri: () =>
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window,
  loadPlugin: () => import("@tauri-apps/plugin-haptics"),
  log: (err) => {
    if (import.meta.env.DEV) console.debug("haptics:", err);
  },
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
        if (!deps.isTauri()) return;
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
        // No plugin registered (desktop Tauri) or the call failed: stay silent.
        deps.log(err);
      }
    },
  };
}

export const haptics: Haptics = createHaptics();
