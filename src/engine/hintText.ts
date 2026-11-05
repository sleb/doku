import type { Deduction, TechniqueId, UnitRef } from "./techniques";

// One template per technique. Pure: it reads only the deduction, so the UI can
// show the text without knowing anything about the solver. Units are numbered
// from 1 for the player.

const noun = (u: UnitRef) => (u.kind === "col" ? "column" : u.kind);
const label = (u: UnitRef) => `${noun(u)} ${u.id + 1}`;
const plural = (kind: UnitRef["kind"]) =>
  `${kind === "col" ? "column" : kind}s`;

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// "regions 3 and 4" from units that share a kind.
function group(units: UnitRef[]): string {
  const word = units.length === 1 ? noun(units[0]) : plural(units[0].kind);
  return `${word} ${list(units.map((u) => String(u.id + 1)))}`;
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

export function explain(d: Deduction): string {
  return TEMPLATES[d.technique](d.because.units);
}
