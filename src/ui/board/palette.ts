export type PaletteName = "default" | "accessible";

// Tailwind only generates classes it can see statically, so these are literals.
const DEFAULT_BG = [
  "bg-region-0",
  "bg-region-1",
  "bg-region-2",
  "bg-region-3",
  "bg-region-4",
  "bg-region-5",
  "bg-region-6",
  "bg-region-7",
  "bg-region-8",
  "bg-region-9",
  "bg-region-10",
] as const;

const ACCESSIBLE_BG = [
  "bg-region-a-0",
  "bg-region-a-1",
  "bg-region-a-2",
  "bg-region-a-3",
  "bg-region-a-4",
  "bg-region-a-5",
  "bg-region-a-6",
  "bg-region-a-7",
  "bg-region-a-8",
  "bg-region-a-9",
  "bg-region-a-10",
] as const;

/** Background class for a region under the chosen palette. */
export function regionClass(palette: PaletteName, region: number): string {
  return (palette === "accessible" ? ACCESSIBLE_BG : DEFAULT_BG)[region];
}

// Face/mark glyph stroke; must reach 3:1 contrast on every region color.
export const GLYPH_COLOR = "#1f1f1f";

// Wrong-tap ✕ stroke; must reach 3:1 contrast on every region color.
export const WRONG_COLOR = "#7f1d1d";

// Hold-glow ring: dark stroke that carries the light region colors.
export const HOLD_RING_COLOR = "#171717";

// Hold-glow under-stroke: light, so the ring stays visible over the dark board frame.
export const HOLD_UNDERSTROKE_COLOR = "#ffffff";

// The board frame border (Board's `border-neutral-800`).
export const BOARD_FRAME_COLOR = "#262626";
