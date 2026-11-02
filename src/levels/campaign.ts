import { type Level, loadLevel } from "../engine";

const packs = import.meta.glob<{ levels: Level[] }>("./pack-*.json", {
  eager: true,
  import: "default",
});

// Campaign order: packs in filename order, levels in array order.
export const LEVELS: readonly Level[] = Object.keys(packs)
  .sort()
  .flatMap((file) => packs[file].levels.map(loadLevel));

export function levelIndex(id: string): number {
  return LEVELS.findIndex((l) => l.id === id);
}
