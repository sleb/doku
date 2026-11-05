import { describe, expect, it } from "vitest";
import { explain } from "./hintText";
import type { Deduction, TechniqueId, UnitRef } from "./techniques";

const region = (id: number): UnitRef => ({ kind: "region", id });
const row = (id: number): UnitRef => ({ kind: "row", id });
const col = (id: number): UnitRef => ({ kind: "col", id });

const make = (
  technique: TechniqueId,
  units: UnitRef[],
  extra: Partial<Deduction> = {},
): Deduction => ({
  technique,
  tier: "easy",
  eliminate: [],
  because: { units, cells: [] },
  ...extra,
});

describe("explain", () => {
  it.each<[string, Deduction, string]>([
    [
      "single-candidate (row)",
      make("single-candidate", [row(3)], { place: 5 }),
      "Row 4 has only one cell left, so its face goes there.",
    ],
    [
      "single-candidate (region)",
      make("single-candidate", [region(0)], { place: 5 }),
      "The red region has only one cell left, so its face goes there.",
    ],
    [
      "single-candidate (column)",
      make("single-candidate", [col(6)], { place: 5 }),
      "Column 7 has only one cell left, so its face goes there.",
    ],
    [
      "region-in-line",
      make("region-in-line", [region(2), row(0)], { eliminate: [1] }),
      "The amber region can only fit in row 1, so the rest of row 1 cannot hold a face.",
    ],
    [
      "line-in-region",
      make("line-in-region", [col(0), region(3)], { eliminate: [1] }),
      "Column 1 can only fit in the lime region, so the rest of the lime region cannot hold a face.",
    ],
    [
      "adjacency-pressure",
      make("adjacency-pressure", [region(4)], { eliminate: [1] }),
      "A face here would leave the emerald region with nowhere to go, so this cell cannot hold one.",
    ],
    [
      "lookahead",
      make("lookahead", [row(4)], { eliminate: [1] }),
      "A face here would leave row 5 with nowhere to go after the forced moves that follow, so this cell cannot hold one.",
    ],
    [
      "subset-regions-lines (rows)",
      make("subset-regions-lines", [region(2), region(3), row(2), row(3)], {
        eliminate: [1],
      }),
      "The amber and lime regions only fit in rows 3 and 4, so those rows belong to them and the rest of their cells cannot hold a face.",
    ],
    [
      "subset-regions-lines (three columns)",
      make(
        "subset-regions-lines",
        [region(0), region(1), region(2), col(0), col(1), col(4)],
        { eliminate: [1] },
      ),
      "The red, orange and amber regions only fit in columns 1, 2 and 5, so those columns belong to them and the rest of their cells cannot hold a face.",
    ],
    [
      "subset-lines-regions",
      make("subset-lines-regions", [row(0), row(1), region(0), region(1)], {
        eliminate: [1],
      }),
      "Rows 1 and 2 only fit in the red and orange regions, so those regions belong to them and the rest of their cells cannot hold a face.",
    ],
    [
      "region beyond the colour names falls back to its number",
      make("single-candidate", [region(11)], { place: 5 }),
      "Region 12 has only one cell left, so its face goes there.",
    ],
    [
      "subset with an unnamed region uses numbers for the group",
      make("subset-regions-lines", [region(0), region(11), row(2), row(3)], {
        eliminate: [1],
      }),
      "Regions 1 and 12 only fit in rows 3 and 4, so those rows belong to them and the rest of their cells cannot hold a face.",
    ],
  ])("%s", (_name, deduction, expected) => {
    expect(explain(deduction)).toBe(expected);
  });

  it("a namer replaces the colour names; undefined falls back to region numbers", () => {
    const none = () => undefined;
    expect(
      explain(make("single-candidate", [region(0)], { place: 5 }), none),
    ).toBe("Region 1 has only one cell left, so its face goes there.");
    expect(
      explain(
        make("subset-regions-lines", [region(0), region(2), row(2), row(3)]),
        none,
      ),
    ).toBe(
      "Regions 1 and 3 only fit in rows 3 and 4, so those rows belong to them and the rest of their cells cannot hold a face.",
    );
  });

  it("a namer can supply its own names", () => {
    expect(
      explain(
        make("single-candidate", [region(1)], { place: 5 }),
        () => "teal",
      ),
    ).toBe("The teal region has only one cell left, so its face goes there.");
  });
});
