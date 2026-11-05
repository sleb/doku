// Colour name of each region, in the order of the --color-region-N tokens in
// app/index.css. The board labels cells with these and hint text uses them, so
// both say "the red region". Lives in the engine so hintText can import it.
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
