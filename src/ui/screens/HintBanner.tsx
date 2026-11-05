import { useGameStore } from "../../store/gameStore";

/**
 * The explanation of the hint on display. Always mounted but empty, and so
 * zero-height, until a hint is shown: the cramped layouts keep every pixel for
 * the board, and the board re-fits while a hint is up. A polite live region, so
 * screen readers hear the hint when it arrives.
 */
export function HintBanner() {
  const message = useGameStore((s) =>
    "hintShown" in s ? (s.hintShown?.message ?? "") : "",
  );
  return (
    <p
      role="status"
      data-testid="hint-banner"
      className="mx-auto max-w-prose px-4 text-center text-sm leading-snug text-ink"
    >
      {message || null}
    </p>
  );
}
