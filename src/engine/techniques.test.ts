import { describe, expect, it } from "vitest";
import { uniqueLevel7 } from "./__fixtures__/levels";
import { type Candidates, eliminate, fromBoard, placeFace } from "./candidates";
import { compile } from "./compile";
import {
  lineInRegion,
  regionInLine,
  singleCandidate,
  TECHNIQUES,
} from "./techniques";

const p = compile(uniqueLevel7);
const fresh = (): Candidates => fromBoard(p);
const at = (r: number, c: number) => r * 7 + c;
const cellsWhere = (pred: (r: number, c: number, region: number) => boolean) =>
  Array.from({ length: 49 }, (_, i) => i).filter((i) =>
    pred(Math.floor(i / 7), i % 7, p.regionOf[i]),
  );

describe("single-candidate", () => {
  // Row 3 reduced to the one cell (3,5).
  const c = eliminate(
    p,
    fresh(),
    cellsWhere((r, col) => r === 3 && col !== 5),
  );

  it("places the only alive cell of a unit", () => {
    expect(singleCandidate(p, c)).toEqual({
      technique: "single-candidate",
      tier: "easy",
      place: at(3, 5),
      eliminate: [],
      because: { units: [{ kind: "row", id: 3 }], cells: [at(3, 5)] },
    });
  });

  it("finds a region with one cell left", () => {
    const d = eliminate(
      p,
      fresh(),
      cellsWhere((r, col, g) => g === 6 && !(r === 6 && col === 6)),
    );
    expect(singleCandidate(p, d)?.place).toBe(at(6, 6));
    expect(singleCandidate(p, d)?.because.units).toEqual([
      { kind: "region", id: 6 },
    ]);
  });

  it("ignores satisfied units and returns null when nothing is forced", () => {
    expect(singleCandidate(p, fresh())).toBeNull();
    const placed = placeFace(p, c, at(3, 5));
    expect(singleCandidate(p, placed)).toBeNull();
  });
});

describe("region-in-line", () => {
  // Region 1 confined to row 0 (cols 4..6).
  const c = eliminate(
    p,
    fresh(),
    cellsWhere((r, _c, g) => g === 1 && r !== 0),
  );

  it("eliminates the other alive cells of the line", () => {
    const d = regionInLine(p, c);
    expect(d).toMatchObject({
      technique: "region-in-line",
      tier: "medium",
      eliminate: [at(0, 0), at(0, 1), at(0, 2), at(0, 3)],
    });
    expect(d?.place).toBeUndefined();
    expect(d?.because.units).toEqual([
      { kind: "region", id: 1 },
      { kind: "row", id: 0 },
    ]);
  });

  it("is invisible to the earlier technique", () => {
    expect(singleCandidate(p, c)).toBeNull();
  });

  it("works for columns", () => {
    // Region 4 is (4,2) only plus none: use region 2 confined to column 5.
    const col = eliminate(
      p,
      fresh(),
      cellsWhere((_r, cc, g) => g === 2 && cc !== 5),
    );
    const d = regionInLine(p, col);
    expect(d?.because.units).toEqual([
      { kind: "region", id: 2 },
      { kind: "col", id: 5 },
    ]);
    expect(d?.eliminate.every((i) => i % 7 === 5 && p.regionOf[i] !== 2)).toBe(
      true,
    );
    expect(d?.eliminate.length).toBeGreaterThan(0);
  });

  it("is null on a fresh board", () => {
    expect(regionInLine(p, fresh())).toBeNull();
  });
});

describe("line-in-region", () => {
  // Column 0 confined to region 3 (its region 0 cells removed).
  const c = eliminate(
    p,
    fresh(),
    cellsWhere((_r, col, g) => col === 0 && g === 0),
  );

  it("eliminates the region's alive cells outside the line", () => {
    const d = lineInRegion(p, c);
    expect(d).toMatchObject({
      technique: "line-in-region",
      tier: "medium",
      eliminate: [at(5, 1)],
    });
    expect(d?.because.units).toEqual([
      { kind: "col", id: 0 },
      { kind: "region", id: 3 },
    ]);
  });

  it("is invisible to the earlier techniques", () => {
    expect(singleCandidate(p, c)).toBeNull();
    expect(regionInLine(p, c)).toBeNull();
  });

  it("is null on a fresh board", () => {
    expect(lineInRegion(p, fresh())).toBeNull();
  });
});

describe("TECHNIQUES", () => {
  it("is ordered simplest to hardest", () => {
    expect(TECHNIQUES.map((t) => [t.id, t.tier])).toEqual([
      ["single-candidate", "easy"],
      ["region-in-line", "medium"],
      ["line-in-region", "medium"],
    ]);
  });
});
