import { useGameStore } from "../../store/gameStore";
import { useSettingsStore } from "../../store/settings";
import { hintMessage } from "./hintMessage";

/**
 * The explanation of the hint on display. Always mounted but empty, and so
 * zero-height, until a hint is shown: the cramped layouts keep every pixel for
 * the board, and the board re-fits while a hint is up. Not a live region: the
 * announcer speaks each hint once. It stays up until the board changes (no
 * timed dismissal).
 */
export function HintBanner() {
  const shown = useGameStore((s) => ("hintShown" in s ? s.hintShown : null));
  const palette = useSettingsStore((s) => s.palette);
  const patterns = useSettingsStore((s) => s.patterns);
  const message = shown ? hintMessage(shown, { palette, patterns }) : "";
  return (
    <p
      data-testid="hint-banner"
      className="mx-auto max-w-prose px-4 text-center text-sm leading-snug text-ink"
    >
      {message || null}
    </p>
  );
}
