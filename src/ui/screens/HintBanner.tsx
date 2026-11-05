import { useGameStore } from "../../store/gameStore";

/**
 * The explanation of the hint on display. Always rendered, with room for a few
 * lines, so a hint appearing never resizes the board. A polite live region, so
 * screen readers hear the hint when it arrives.
 */
export function HintBanner() {
  const message = useGameStore((s) =>
    "hintShown" in s ? (s.hintShown?.message ?? "") : "",
  );
  return (
    <p
      role="status"
      className="mx-auto mb-2 min-h-[3.5rem] max-w-prose px-4 text-center text-sm leading-snug text-stone-800"
    >
      {message}
    </p>
  );
}
