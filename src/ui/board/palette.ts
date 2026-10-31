// Tailwind only generates classes it can see statically, so these are literals.
export const REGION_BG = [
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

// Same order as the --color-region-N tokens in app/index.css.
export const REGION_NAMES = [
  "red",
  "orange",
  "amber",
  "lime",
  "emerald",
  "teal",
  "sky",
  "indigo",
  "violet",
  "pink",
  "stone",
] as const;

// Face/mark glyph stroke; must reach 3:1 contrast on every region color.
export const GLYPH_COLOR = "#1f1f1f";

// Wrong-tap ✕ stroke; must reach 3:1 contrast on every region color.
export const WRONG_COLOR = "#7f1d1d";
