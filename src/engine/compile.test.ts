import { describe, expect, it } from "vitest";
import { uniqueLevel7, uniqueLevel11 } from "./__fixtures__/levels";
import {
  compile,
  neighborsOf,
  orthogonalNeighborsOf,
  unitIndexes,
} from "./compile";

describe("compile", () => {
  const p = compile(uniqueLevel7);

  it("flattens the region grid", () => {
    expect(p.n).toBe(7);
    expect(p.regionOf).toHaveLength(49);
    expect(p.regionOf[0]).toBe(0);
    expect(p.regionOf[4]).toBe(1);
    expect(p.regionOf[6 * 7 + 5]).toBe(6);
  });

  it("builds 3N units: rows, then columns, then regions", () => {
    expect(p.units).toHaveLength(21);
    expect(p.units.slice(0, 7).map((u) => [u.kind, u.id])).toEqual(
      [0, 1, 2, 3, 4, 5, 6].map((i) => ["row", i]),
    );
    expect(p.units[7]).toMatchObject({ kind: "col", id: 0 });
    expect(p.units[14]).toMatchObject({ kind: "region", id: 0 });
    expect([...p.units[1].cells]).toEqual([7, 8, 9, 10, 11, 12, 13]);
    expect([...p.units[7 + 2].cells]).toEqual([2, 9, 16, 23, 30, 37, 44]);
  });

  it("every cell is in exactly one row, column and region unit", () => {
    for (const level of [uniqueLevel7, uniqueLevel11]) {
      const q = compile(level);
      const seen = new Uint8Array(q.n * q.n * 3);
      for (const u of q.units) {
        for (const cell of u.cells)
          seen[cell * 3 + ["row", "col", "region"].indexOf(u.kind)]++;
      }
      expect(seen.every((v) => v === 1)).toBe(true);
      const sizes = q.units
        .slice(2 * q.n)
        .reduce((s, u) => s + u.cells.length, 0);
      expect(sizes).toBe(q.n * q.n);
    }
  });

  it("unitIndexes gives the row, column and region unit of a cell", () => {
    expect(unitIndexes(p, 1 * 7 + 4)).toEqual([1, 7 + 4, 14 + 1]);
  });

  it("neighborsOf lists the adjacent cells, edges clipped", () => {
    expect(neighborsOf(p, 0).sort((a, b) => a - b)).toEqual([1, 7, 8]);
    expect(neighborsOf(p, 24)).toHaveLength(8);
    expect(neighborsOf(p, 6).sort((a, b) => a - b)).toEqual([5, 12, 13]);
  });

  it("orthogonalNeighborsOf lists up, down, left, right, edges clipped", () => {
    expect(orthogonalNeighborsOf(p, 24)).toEqual([17, 31, 23, 25]);
    expect(orthogonalNeighborsOf(p, 0)).toEqual([7, 1]);
    expect(orthogonalNeighborsOf(p, 48)).toEqual([41, 47]);
  });
});
