export type ImpactStyle = "soft" | "light" | "medium" | "heavy";

/** Weakest to strongest. */
export const IMPACT_ORDER: readonly ImpactStyle[] = [
  "soft",
  "light",
  "medium",
  "heavy",
];

/**
 * Build-up pulses while a hold glows, as ms offsets from glow start. The peak
 * is the `place` haptic at completion (heavy), so every entry ends before
 * HOLD_MS. First guess; tune on a physical device.
 */
export const HOLD_RAMP: readonly { at: number; style: ImpactStyle }[] = [
  { at: 0, style: "soft" },
  { at: 100, style: "soft" },
  { at: 200, style: "light" },
  { at: 300, style: "light" },
  { at: 400, style: "medium" },
];
