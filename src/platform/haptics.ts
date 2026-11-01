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
}

const defaultDeps: HapticsDeps = {
  isTauri: () =>
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window,
  loadPlugin: () => import("@tauri-apps/plugin-haptics"),
};

export function createHaptics(deps: HapticsDeps = defaultDeps): Haptics {
  return {
    async play(kind) {
      try {
        if (!deps.isTauri()) return;
        const p = await deps.loadPlugin();
        if (kind === "place") await p.impactFeedback("light");
        else if (kind === "wrong") await p.notificationFeedback("warning");
        else if (kind === "win") await p.notificationFeedback("success");
        else await p.notificationFeedback("error");
      } catch {
        // No plugin registered (desktop Tauri) or the call failed: stay silent.
      }
    },
  };
}

export const haptics: Haptics = createHaptics();
