// Colour name of each region, in the order of the --color-region-N tokens in
// app/index.css. Both the cell labels and hint text name regions with these on
// the default palette without patterns ("red region", "the red region"); on the
// accessible palette or with patterns both use "region N" instead. That choice
// is one shared rule, src/ui/board/regionNaming.ts. Lives in the engine so
// hintText can import it.
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
