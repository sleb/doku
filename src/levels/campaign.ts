import { type Level, loadLevel } from "../engine";
import { orderPackKeys } from "./packOrder";

const packs = import.meta.glob<{ levels: Level[] }>("./pack-*.json", {
  eager: true,
  import: "default",
});

// Campaign order: packs by numeric suffix (pack-2 before pack-10), levels in array order.
export const LEVELS: readonly Level[] = orderPackKeys(
  Object.keys(packs),
).flatMap((file) => packs[file].levels.map(loadLevel));

export function levelIndex(id: string): number {
  return LEVELS.findIndex((l) => l.id === id);
}
