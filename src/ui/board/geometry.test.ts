import { describe, expect, test } from "vitest";
import {
  uniqueLevel7,
  uniqueLevel11,
} from "../../engine/__fixtures__/levels";
import { cellGeometry } from "./geometry";

describe.each([
  ["uniqueLevel7", uniqueLevel7],
  ["uniqueLevel11", uniqueLevel11],
])("cellGeometry %s", (_name, level) => {
  const n = level.size;
  const geo = cellGeometry(level);

  test("has one entry per cell with matching coordinates and region", () => {
    expect(geo).toHaveLength(n * n);
    geo.forEach((g, i) => {
      expect(g.index).toBe(i);
      expect(g.row).toBe(Math.floor(i / n));
      expect(g.col).toBe(i % n);
      expect(g.region).toBe(level.regions[g.row][g.col]);
    });
  });

  test("thick edges are exactly where the neighbor is in another region", () => {
    for (const g of geo) {
      const right = g.col < n - 1 ? geo[g.index + 1] : null;
      const below = g.row < n - 1 ? geo[g.index + n] : null;
      expect(g.thickRight).toBe(right !== null && right.region !== g.region);
      expect(g.thickBottom).toBe(below !== null && below.region !== g.region);
    }
  });

  test("the last column is never thickRight and the last row never thickBottom", () => {
    for (const g of geo) {
      if (g.col === n - 1) expect(g.thickRight).toBe(false);
      if (g.row === n - 1) expect(g.thickBottom).toBe(false);
    }
  });
});

describe("cellGeometry known edges on uniqueLevel7", () => {
  const geo = cellGeometry(uniqueLevel7);
  test("region 0 -> 1 boundary in row 0 sits right of column 3", () => {
    expect(geo[3].thickRight).toBe(true);
    expect(geo[2].thickRight).toBe(false);
  });
  test("row 0 col 2 is above region 1, so thickBottom", () => {
    expect(geo[2].thickBottom).toBe(true);
    expect(geo[0].thickBottom).toBe(false);
  });
});
