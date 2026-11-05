import { explain } from "../../engine";
import type { HintShown } from "../../store/game";
import type { PaletteName } from "../board/palette";

export interface NamingOptions {
  palette: PaletteName;
  patterns: boolean;
}

/**
 * The text of a hint as the player should read or hear it. Colour names only
 * mean something on the default palette without patterns; otherwise regions go
 * by the number the cell labels use ("region 3").
 */
export function hintMessage(
  shown: HintShown,
  { palette, patterns }: NamingOptions,
): string {
  if (palette === "default" && !patterns) return shown.message;
  return explain(shown.deduction, () => undefined);
}
