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
    [2, 2, 4, 4, 3, 3, 3],
    [2, 5, 4, 4, 4, 6, 6],
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
  // Region 6 reduced to (4,5) and (5,6): they touch, and a face at (4,6) or
  // (5,5) would remove both.
  const keep = [at(4, 5), at(5, 6)];
  const c = without(
    fresh(),
    cellsWhere((_r, _c, g) => g === 6 && !keep.includes(_r * 7 + _c)),
  );

  it("eliminates a cell whose face would empty another unit", () => {
    const d = adjacencyPressure(p, c);
    expect(d?.technique).toBe("adjacency-pressure");
    expect(d?.tier).toBe("hard");
    expect(d?.place).toBeUndefined();
    expect(d?.eliminate).toHaveLength(1);
    expect(d?.because).toEqual({
      units: [{ kind: "region", id: 6 }],
      cells: keep,
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
    // Place a face in region 6's cell: the unit is satisfied, nothing to fear.
    const placed = placeFace(p, c, at(4, 5));
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
  // Regions 3 and 4 confined to rows 3 and 4: they own those rows.
  const c = without(
    fresh(),
    cellsWhere((r, _c, g) => (g === 3 || g === 4) && r !== 3 && r !== 4),
  );

  it("eliminates other regions' cells from the owned rows", () => {
    const d = subsetRegionsLines(p, c);
    expect(d).toMatchObject({
      technique: "subset-regions-lines",
      tier: "hard",
    });
    expect(d?.eliminate).toEqual(
      cellsWhere(
        (r, _c, g) => (r === 3 || r === 4) && g !== 3 && g !== 4,
      ).filter((i) => c.alive[i]),
    );
    expect(d?.because.units).toEqual([
      { kind: "region", id: 3 },
      { kind: "region", id: 4 },
      { kind: "row", id: 3 },
      { kind: "row", id: 4 },
    ]);
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
    // Region 4 also keeps a cell in row 5: three lines for two regions.
    const loose = without(
      fresh(),
      cellsWhere(
        (r, _c, g) => (g === 3 && r !== 3 && r !== 4) || (g === 4 && r > 5),
      ),
    );
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
    const loose = without(c, [at(1, 3)]);
    // Rows 0 and 1 still touch only regions 0 and 1; make row 1 reach region 3.
    expect(subsetLinesRegions(p, loose)?.because.units).toEqual([
      { kind: "row", id: 0 },
      { kind: "row", id: 1 },
      { kind: "region", id: 0 },
      { kind: "region", id: 1 },
    ]);
    const none = without(c, [at(2, 0)]);
    expect(subsetLinesRegions(p, none)).toBeNull();
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
