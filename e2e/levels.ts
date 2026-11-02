import { readFileSync } from "node:fs";

export type PackLevel = {
  id: string;
  size: number;
  regions: number[][];
  solution: number[];
};

const pack = JSON.parse(
  readFileSync(new URL("../src/levels/pack-1.json", import.meta.url), "utf8"),
) as { levels: PackLevel[] };

export function levelById(id: string): PackLevel {
  const level = pack.levels.find((l) => l.id === id);
  if (!level) throw new Error(`no level ${id} in pack-1.json`);
  return level;
}
