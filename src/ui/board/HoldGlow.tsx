import { HOLD_MS } from "./hold";
import { HOLD_RING_COLOR, HOLD_UNDERSTROKE_COLOR } from "./palette";

const DIAMETER = "max(64px, calc(var(--cell) * 3))";

/**
 * Finger-sized progress ring centred on the held cell (POLISH_DESIGN 6.5).
 * Board-level, so it paints above region edges and neighbours and is not
 * clipped to the cell. Mounted only while a hold glows, so its CSS animation
 * starts with the glow and stays in step with the hold timer.
 */
export function HoldGlow({ row, col }: { row: number; col: number }) {
  return (
    <div
      aria-hidden="true"
      data-hold-glow
      className="hold-glow pointer-events-none absolute"
      style={{
        left: `calc(var(--cell) * ${col + 0.5})`,
        top: `calc(var(--cell) * ${row + 0.5})`,
        width: DIAMETER,
        height: DIAMETER,
        transform: "translate(-50%, -50%)",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="size-full overflow-visible"
      >
        <circle
          className="hold-under"
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={HOLD_UNDERSTROKE_COLOR}
          strokeWidth="12"
        />
        <circle
          className="hold-ring"
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={HOLD_RING_COLOR}
          strokeWidth="7"
          strokeLinecap="round"
          pathLength={1}
          transform="rotate(-90 50 50)"
          style={{ animationDuration: `${HOLD_MS}ms` }}
        />
      </svg>
    </div>
  );
}
