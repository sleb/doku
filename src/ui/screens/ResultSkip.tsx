/**
 * Transparent layer over the screen while the result modal is pending, so a tap
 * skips the delay. Separate from the board wrapper, which is already `inert`.
 * Sits below `Dialog` (z-10).
 */
export function ResultSkip({ onSkip }: { onSkip: () => void }) {
  return (
    <div
      aria-hidden="true"
      data-testid="result-skip"
      className="fixed inset-0 z-[5]"
      onPointerDown={onSkip}
    />
  );
}
