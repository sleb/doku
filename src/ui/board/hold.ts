/** A press must wait this long before the hold glow starts, so a normal click never shows it. */
export const HOLD_DELAY_MS = 250;

/** How long the glow traces once it starts. The face is placed when it completes. */
export const HOLD_MS = 500;

/** Total press duration, from pointerdown/keydown to placement. */
export const HOLD_TOTAL_MS = HOLD_DELAY_MS + HOLD_MS;
