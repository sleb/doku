import { explain } from "../../engine";
import type { HintShown } from "../../store/game";
import { type NamingOptions, regionNamer } from "../board/regionNaming";

/**
 * The text of a hint as the player should read or hear it. Regions are named by
 * the shared rule in `regionNaming` (the same one the cell labels use).
 */
export function hintMessage(shown: HintShown, opts: NamingOptions): string {
  return explain(shown.deduction, regionNamer(opts));
}
