// Usage: bun tools/generate-levels.ts [--pack N] [--stats] [--only size[:tier]]
//                                     [--max-attempts K] [--timeout SECONDS]
//   --pack N          write src/levels/pack-N.json from tools/curriculum.ts (default 1)
//   --stats           print per-size generator statistics; writes nothing
//   --only size[:tier]  build just those rows (tier "any" = untiered); writes nothing
// Exits 1 if a row cannot be filled (unless --only) or a level fails verification.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { generate, type Level } from "../src/engine";
import { CURRICULUM } from "./curriculum";
import { buildPack, computeStats, formatStats } from "./pack";

const SIZES = [7, 8, 9, 10, 11];
const dir = new URL("../src/levels/", import.meta.url);

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const has = (name: string) => process.argv.includes(`--${name}`);

function num(name: string, fallback: number): number {
  const raw = flag(name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`--${name} needs a positive number, got ${raw}`);
    process.exit(2);
  }
  return n;
}

if (has("stats")) {
  const rows = SIZES.map((size) => computeStats(size));
  process.stdout.write(formatStats(rows));
  process.exit(0);
}

const packNumber = num("pack", 1);
const maxAttempts = flag("max-attempts") ? num("max-attempts", 0) : undefined;
const timeoutMs = num("timeout", 60) * 1000;
const only = flag("only");
const onlyRows = only?.split(":");

const others = readdirSync(dir)
  .map((f) => /^pack-(\d+)\.json$/.exec(f))
  .flatMap((m) => (m && Number(m[1]) !== packNumber ? [m] : []))
  .map((m) => ({
    pack: Number(m[1]),
    levels: (
      JSON.parse(readFileSync(new URL(m[0], dir), "utf8")) as {
        levels: Level[];
      }
    ).levels,
  }));

const result = buildPack(CURRICULUM, packNumber, others, {
  generate: ({ size, seed }) =>
    generate({
      size,
      seed,
      maxAttempts,
      signal: AbortSignal.timeout(timeoutMs),
    }),
  filter: onlyRows
    ? (row) =>
        row.size === Number(onlyRows[0]) &&
        (onlyRows[1] === undefined || (row.tier ?? "any") === onlyRows[1])
    : undefined,
});

for (const f of result.failures) console.error(`unavailable: ${f}`);
const bySize = new Map<number, number>();
for (const l of result.levels)
  bySize.set(l.size, (bySize.get(l.size) ?? 0) + 1);
console.log(
  `pack-${packNumber}: ${result.levels.length} levels (${[...bySize].map(([s, n]) => `${s}x${s}:${n}`).join(" ")})`,
);

if (only) {
  console.log("--only: nothing written");
  process.exit(0);
}
if (result.failures.length > 0) process.exit(1);
writeFileSync(new URL(`pack-${packNumber}.json`, dir), result.json);
