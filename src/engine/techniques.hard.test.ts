import { describe, expect, it } from "vitest";
import { type Candidates, eliminate, fromBoard, placeFace } from "./candidates";
import { compile } from "./compile";
import {
  adjacencyPressure,
  lineInRegion,
  regionInLine,
  singleCandidate,
  subsetLinesRegions,
  subsetRegionsLines,
  TECHNIQUES,
} from "./techniques";
import type { Level } from "./types";

// A hand-made 7x7 region map (no solution needed: techniques read candidates,
// not the solution) where a fresh board forces nothing from techniques 1 to 5.
const level: Level = {
  id: "hard-crafted-7",
  size: 7,
  regions: [
    [0, 0, 0, 0, 1, 1, 1],
    [0, 0, 0, 1, 1, 1, 1],
    [0, 2, 2, 3, 3, 3, 3],
    [2, 2, 2, 4, 3, 3, 3],
    [2, 2, 4, 4, 4, 6, 6],
    [5, 5, 5, 4, 6, 6, 6],
    [5, 5, 5, 5, 6, 6, 6],
  ],
  solution: [0, 0, 0, 0, 0, 0, 0],
};
const p = compile(level);
const fresh = (): Candidates => fromBoard(p);
const at = (r: number, c: number) => r * 7 + c;
const cellsWhere = (pred: (r: number, c: number, region: number) => boolean) =>
  Array.from({ length: 49 }, (_, i) => i).filter((i) =>
    pred(Math.floor(i / 7), i % 7, p.regionOf[i]),
  );
const without = (c: Candidates, cells: number[]) => eliminate(p, c, cells);
const earlier = [singleCandidate, regionInLine, lineInRegion];

describe("adjacency-pressure", () => {
  // Region 4 reduced to (4,2) and (5,3): they touch, and a face at (5,1) would
  // remove both.
  const keep = [at(4, 2), at(5, 3)];
  const c = without(
    fresh(),
    cellsWhere((r, col, g) => g === 4 && !keep.includes(r * 7 + col)),
  );

  it("eliminates a cell whose face would empty another unit", () => {
    expect(adjacencyPressure(p, c)).toEqual({
      technique: "adjacency-pressure",
      tier: "hard",
      eliminate: [at(5, 1)],
      because: { units: [{ kind: "region", id: 4 }], cells: keep },
    });
  });

  it("only ever eliminates cells that placeFace proves impossible", () => {
    const [x] = adjacencyPressure(p, c)?.eliminate ?? [];
    const after = placeFace(p, c, x);
    const emptied = p.units.some(
      (u, i) =>
        !after.satisfied[i] &&
        after.aliveCount[i] === 0 &&
        !u.cells.includes(x),
    );
    expect(emptied).toBe(true);
  });

  it("is invisible to the earlier techniques", () => {
    for (const t of earlier) expect(t(p, c)).toBeNull();
  });

  it("is null on a fresh board", () => {
    expect(adjacencyPressure(p, fresh())).toBeNull();
  });

  it("skips satisfied units", () => {
    // Place a face in region 4's cell: the unit is satisfied, nothing to fear.
    const placed = placeFace(p, c, at(4, 2));
    expect(adjacencyPressure(p, placed)?.because.units).not.toContainEqual({
      kind: "region",
      id: 6,
    });
  });

  it("never eliminates a placed cell", () => {
    const placed = placeFace(p, fresh(), at(0, 0));
    const d = adjacencyPressure(p, placed);
    for (const i of d?.eliminate ?? []) expect(placed.placed[i]).toBe(0);
  });
});

describe("subset-regions-lines", () => {
  // Regions 2 and 3 confined to rows 2 and 3: they own those rows.
  const c = without(
    fresh(),
    cellsWhere((r, _c, g) => g === 2 && r === 4),
  );

  it("eliminates other regions' cells from the owned rows", () => {
    expect(subsetRegionsLines(p, c)).toEqual({
      technique: "subset-regions-lines",
      tier: "hard",
      eliminate: [at(2, 0), at(3, 3)],
      because: {
        units: [
          { kind: "region", id: 2 },
          { kind: "region", id: 3 },
          { kind: "row", id: 2 },
          { kind: "row", id: 3 },
        ],
        cells: [15, 16, 21, 22, 23, 17, 18, 19, 20, 25, 26, 27],
      },
    });
  });

  it("is invisible to the earlier techniques", () => {
    for (const t of [...earlier, adjacencyPressure]) expect(t(p, c)).toBeNull();
  });

  it("works for columns", () => {
    // Regions 2 and 5 confined to columns 0 and 1.
    const cols = without(
      fresh(),
      cellsWhere((_r, col, g) => (g === 2 || g === 5) && col > 1),
    );
    const d = subsetRegionsLines(p, cols);
    expect(d?.because.units).toEqual([
      { kind: "region", id: 2 },
      { kind: "region", id: 5 },
      { kind: "col", id: 0 },
      { kind: "col", id: 1 },
    ]);
    expect(d?.eliminate.every((i) => i % 7 <= 1)).toBe(true);
    expect(d?.eliminate.every((i) => ![2, 5].includes(p.regionOf[i]))).toBe(
      true,
    );
  });

  it("needs exactly M lines for M regions", () => {
    // Region 2 keeps (4,1): three rows for two regions.
    const loose = without(fresh(), [at(4, 0)]);
    expect(subsetRegionsLines(p, loose)).toBeNull();
  });

  it("is null on a fresh board", () => {
    expect(subsetRegionsLines(p, fresh())).toBeNull();
  });

  it("skips a subset whose regions are satisfied", () => {
    const placed = placeFace(p, c, at(3, 2));
    const d = subsetRegionsLines(p, placed);
    for (const u of d?.because.units ?? []) {
      expect(u).not.toEqual({ kind: "region", id: 4 });
    }
  });
});

describe("subset-lines-regions", () => {
  // Rows 0 and 1 hold only regions 0 and 1, so they own those regions.
  const c = fresh();

  it("eliminates the owned regions' cells outside the lines", () => {
    const d = subsetLinesRegions(p, c);
    expect(d).toMatchObject({
      technique: "subset-lines-regions",
      tier: "hard",
      eliminate: [at(2, 0)],
    });
    expect(d?.because.units).toEqual([
      { kind: "row", id: 0 },
      { kind: "row", id: 1 },
      { kind: "region", id: 0 },
      { kind: "region", id: 1 },
    ]);
  });

  it("is invisible to the earlier techniques", () => {
    for (const t of [...earlier, adjacencyPressure, subsetRegionsLines]) {
      expect(t(p, c)).toBeNull();
    }
  });

  it("needs exactly M regions for M lines", () => {
    // Nothing left outside rows 0 and 1 to eliminate.
    expect(subsetLinesRegions(p, without(c, [at(2, 0)]))).toBeNull();
  });
});

describe("TECHNIQUES with the hard rungs", () => {
  it("lists the six rungs in order", () => {
    expect(TECHNIQUES.map((t) => [t.id, t.tier])).toEqual([
      ["single-candidate", "easy"],
      ["region-in-line", "medium"],
      ["line-in-region", "medium"],
      ["adjacency-pressure", "hard"],
      ["subset-regions-lines", "hard"],
      ["subset-lines-regions", "hard"],
    ]);
  });
});
