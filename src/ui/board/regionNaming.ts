import { REGION_NAMES, type RegionNamer } from "../../engine";
import type { PaletteName } from "./palette";

export interface NamingOptions {
  palette: PaletteName;
  patterns: boolean;
}

/**
 * The one rule for how a region is named to the player: colour names only mean
 * something on the default palette without patterns; otherwise regions go by
 * number. Cell labels and hint text both use it, so they never disagree.
 */
export function regionNamer({ palette, patterns }: NamingOptions): RegionNamer {
  return palette === "default" && !patterns
    ? (id) => REGION_NAMES[id]
    : () => undefined;
}

/** A cell's region as spoken in its label: "red region" or "region 3". */
export function regionLabel(region: number, opts: NamingOptions): string {
  const name = regionNamer(opts)(region);
  return name ? `${name} region` : `region ${region + 1}`;
}
