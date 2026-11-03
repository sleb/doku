import { readdirSync, readFileSync } from "node:fs";
import { orderPackKeys } from "../src/levels/packOrder";

export type PackLevel = {
  id: string;
  size: number;
  regions: number[][];
  solution: number[];
};

// Every pack-*.json, ordered by the app's own rule, like src/levels/campaign.ts.
const dir = new URL("../src/levels/", import.meta.url);
const levels: PackLevel[] = orderPackKeys(
  readdirSync(dir).filter((f) => /^pack-\d+\.json$/.test(f)),
).flatMap(
  (f) =>
    (
      JSON.parse(readFileSync(new URL(f, dir), "utf8")) as {
        levels: PackLevel[];
      }
    ).levels,
);

export function levelById(id: string): PackLevel {
  const level = levels.find((l) => l.id === id);
  if (!level) throw new Error(`no level ${id} in the campaign packs`);
  return level;
}

/** Number of levels in the campaign (pack order). */
export const levelCount: number = levels.length;

export const levelIds: string[] = levels.map((l) => l.id);
