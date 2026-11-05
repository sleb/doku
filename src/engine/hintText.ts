import { REGION_NAMES } from "./regionNames";
import type { Deduction, TechniqueId, UnitRef } from "./techniques";

// One template per technique. Pure: it reads only the deduction, so the UI can
// show the text without knowing anything about the solver. Rows and columns are
// numbered from 1 for the player; regions go by the colour the board shows
// ("the red region"), falling back to a number past the end of the name list.

const noun = (u: UnitRef) => (u.kind === "col" ? "column" : u.kind);
/** Names a region by id, or undefined to fall back to its number. */
export type RegionNamer = (region: number) => string | undefined;

const colourNames: RegionNamer = (id) => REGION_NAMES[id];

// The explanation currently being built; set by `explain` for its synchronous run.
let namer: RegionNamer = colourNames;
const regionName = (u: UnitRef): string | undefined =>
  u.kind === "region" ? namer(u.id) : undefined;
const label = (u: UnitRef) => {
  const name = regionName(u);
  return name ? `the ${name} region` : `${noun(u)} ${u.id + 1}`;
};
const plural = (kind: UnitRef["kind"]) =>
  `${kind === "col" ? "column" : kind}s`;

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// "the red and orange regions" or "rows 3 and 4", from units that share a kind.
function group(units: UnitRef[]): string {
  if (units.length === 1) return label(units[0]);
  const names = units.map(regionName);
  if (names.every((n) => n !== undefined)) {
    return `the ${list(names as string[])} regions`;
  }
  return `${plural(units[0].kind)} ${list(units.map((u) => String(u.id + 1)))}`;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TEMPLATES: Record<TechniqueId, (units: UnitRef[]) => string> = {
  "single-candidate": ([u]) =>
    `${capital(label(u))} has only one cell left, so its face goes there.`,
  "region-in-line": ([region, line]) =>
    `${capital(label(region))} can only fit in ${label(line)}, so the rest of ${label(line)} cannot hold a face.`,
  "line-in-region": ([line, region]) =>
    `${capital(label(line))} can only fit in ${label(region)}, so the rest of ${label(region)} cannot hold a face.`,
  "adjacency-pressure": ([u]) =>
    `A face here would leave ${label(u)} with nowhere to go, so this cell cannot hold one.`,
  lookahead: ([u]) =>
    `A face here would leave ${label(u)} with nowhere to go after the forced moves that follow, so this cell cannot hold one.`,
  "subset-regions-lines": (units) => subsetText(units),
  "subset-lines-regions": (units) => subsetText(units),
};

// The units are the subset first, then the units it owns; both halves have the
// same length M.
function subsetText(units: UnitRef[]): string {
  const half = units.length / 2;
  const subset = units.slice(0, half);
  const owned = units.slice(half);
  return `${capital(group(subset))} only fit in ${group(owned)}, so those ${plural(owned[0].kind)} belong to them and the rest of their cells cannot hold a face.`;
}

/** The hint text for a deduction; regions are named by `names` (colours by default). */
export function explain(
  d: Deduction,
  names: RegionNamer = colourNames,
): string {
  namer = names;
  try {
    return TEMPLATES[d.technique](d.because.units);
  } finally {
    namer = colourNames;
  }
}
