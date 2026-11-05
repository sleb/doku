import { describe, expect, it } from "vitest";
import { expertLevel1, expertLevel2, hardLevel1 } from "./__fixtures__/rated";
import {
  type Candidates,
  contradiction,
  eliminate,
  fromBoard,
  placeFace,
} from "./candidates";
import { compile } from "./compile";
import { solveByTechniques } from "./solver";
import {
  type Deduction,
  lookahead,
  propagate,
  TECHNIQUES,
} from "./techniques";

const rungs1to6 = TECHNIQUES.slice(0, 6);
const apply = (
  p: ReturnType<typeof compile>,
  c: Candidates,
  d: Deduction,
): Candidates =>
  d.place !== undefined ? placeFace(p, c, d.place) : eliminate(p, c, d.eliminate);

// Candidates just before the solver's first lookahead step on `level`.
function beforeLookahead(level: typeof expertLevel1) {
  const p = compile(level);
  const { steps } = solveByTechniques(level);
  const at = steps.findIndex((s) => s.technique === "lookahead");
  expect(at).toBeGreaterThanOrEqual(0);
  let c = fromBoard(p);
  for (const s of steps.slice(0, at)) c = apply(p, c, s);
  return { p, c, step: steps[at] };
}

describe("propagate", () => {
  it("runs rungs 1 to 6 to a fixpoint", () => {
    const p = compile(hardLevel1);
    const end = propagate(p, fromBoard(p));
    for (const t of rungs1to6) expect(t.run(p, end)).toBeNull();
    const { steps } = solveByTechniques(hardLevel1);
    let c = fromBoard(p);
    for (const s of steps) c = apply(p, c, s);
    expect(end.placed).toEqual(c.placed);
    expect(end.alive).toEqual(c.alive);
  });

  it("matches the solver up to its first lookahead step", () => {
    const { p, c } = beforeLookahead(expertLevel1);
    expect(propagate(p, fromBoard(p)).alive).toEqual(c.alive);
  });

  it("stops once a contradiction appears", () => {
    const p = compile(expertLevel1);
    const row0 = Array.from(p.units[0].cells);
    const broken = eliminate(p, fromBoard(p), row0);
    const end = propagate(p, broken);
    expect(contradiction(end)).toBe(true);
  });

  it("does not mutate its input", () => {
    const p = compile(hardLevel1);
    const start = fromBoard(p);
    const copy = start.alive.slice();
    propagate(p, start);
    expect(start.alive).toEqual(copy);
  });
});

describe("lookahead", () => {
  for (const [name, level] of [
    ["expertLevel1", expertLevel1],
    ["expertLevel2", expertLevel2],
  ] as const) {
    it(`${name}: rungs 1 to 6 are stuck and one assumption contradicts`, () => {
      const { p, c, step } = beforeLookahead(level);
      for (const t of rungs1to6) expect(t.run(p, c)).toBeNull();
      const d = lookahead(p, c);
      expect(d).toEqual(step);
      expect(d).toMatchObject({ technique: "lookahead", tier: "expert" });
      expect(d?.place).toBeUndefined();
      expect(d?.eliminate).toHaveLength(1);
      const [x] = d?.eliminate ?? [];
      // The eliminated cell is not a solution cell, and the cited unit is empty
      // after the assumption plus forced moves.
      expect(level.solution[Math.floor(x / level.size)]).not.toBe(x % level.size);
      expect(d?.because.cells).toEqual([x]);
      const after = propagate(p, placeFace(p, c, x));
      expect(contradiction(after)).toBe(true);
      const [unit] = d?.because.units ?? [];
      const idx = p.units.findIndex(
        (u) => u.kind === unit.kind && u.id === unit.id,
      );
      expect(after.satisfied[idx]).toBe(0);
      expect(after.aliveCount[idx]).toBe(0);
    });
  }

  it("takes the first contradictory cell in index order", () => {
    const { p, c } = beforeLookahead(expertLevel1);
    const [x] = lookahead(p, c)?.eliminate ?? [];
    for (let i = 0; i < x; i++) {
      if (!c.alive[i] || c.placed[i]) continue;
      expect(contradiction(propagate(p, placeFace(p, c, i)))).toBe(false);
    }
  });

  it("is null when no assumption contradicts", () => {
    const p = compile(expertLevel1);
    expect(lookahead(p, fromBoard(p))).toBeNull();
  });

  it("is null on a solved board", () => {
    const p = compile(expertLevel1);
    let c = fromBoard(p);
    expertLevel1.solution.forEach((col, r) => {
      c = placeFace(p, c, r * 7 + col);
    });
    expect(lookahead(p, c)).toBeNull();
  });

  it("never appears in a Hard golden's trace", () => {
    expect(
      solveByTechniques(hardLevel1).steps.some((s) => s.technique === "lookahead"),
    ).toBe(false);
  });

  it("is rung 7, tier expert", () => {
    expect(TECHNIQUES.map((t) => t.id)).toEqual([
      "single-candidate",
      "region-in-line",
      "line-in-region",
      "adjacency-pressure",
      "subset-regions-lines",
      "subset-lines-regions",
      "lookahead",
    ]);
    expect(TECHNIQUES[6].tier).toBe("expert");
  });
});
