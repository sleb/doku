import { afterEach, describe, expect, it, vi } from "vitest";
import { multiSolutionLevel7 } from "./__fixtures__/levels";
import type { Level } from "./types";
import { LevelError, loadLevel, validateLevel } from "./validate";

const withRegions = (edit: (regions: number[][]) => void): Level => {
  const regions = multiSolutionLevel7.regions.map((row) => [...row]);
  edit(regions);
  return { ...multiSolutionLevel7, regions };
};

const rules = (level: Level) => validateLevel(level).map((i) => i.rule);

describe("validateLevel", () => {
  it("accepts a well-formed level", () => {
    expect(validateLevel(multiSolutionLevel7)).toEqual([]);
  });

  it.each([6, 12])("rejects size %i", (size) => {
    expect(rules({ ...multiSolutionLevel7, size })).toEqual(["size"]);
  });

  it("rejects regions with the wrong number of rows", () => {
    const level = {
      ...multiSolutionLevel7,
      regions: multiSolutionLevel7.regions.slice(0, 6),
    };
    expect(rules(level)).toEqual(["regions-shape"]);
  });

  it("rejects a ragged regions row", () => {
    const level = withRegions((r) => r[3].pop());
    expect(rules(level)).toEqual(["regions-shape"]);
  });

  it("rejects fewer than N distinct region ids", () => {
    const level = withRegions((r) => r[6].fill(5));
    expect(rules(level)).toEqual(["region-count"]);
  });

  it("rejects a region id outside 0..N-1, naming the cell", () => {
    const level = withRegions((r) => (r[2][4] = 7));
    const issues = validateLevel(level);
    expect(issues.map((i) => i.rule)).toEqual(["region-count"]);
    expect(issues[0].cells).toContainEqual({ r: 2, c: 4 });
  });

  it("rejects a region that is only diagonally connected", () => {
    // Swapping (0,1) and (1,0) splits region 0 into two pieces.
    const level = withRegions((r) => {
      r[0][1] = 1;
      r[1][0] = 0;
    });
    const issues = validateLevel(level).filter(
      (i) => i.rule === "region-connected",
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.flatMap((i) => i.cells)).toContainEqual({ r: 0, c: 6 });
  });

  it("rejects a solution of the wrong length", () => {
    expect(
      rules({ ...multiSolutionLevel7, solution: [1, 3, 5, 0, 2, 4] }),
    ).toEqual(["solution-shape"]);
  });

  it("rejects a solution entry out of range", () => {
    expect(
      rules({ ...multiSolutionLevel7, solution: [1, 3, 5, 0, 2, 4, 9] }),
    ).toEqual(["solution-shape"]);
  });

  it("rejects two faces in the same column", () => {
    const issues = validateLevel({
      ...multiSolutionLevel7,
      solution: [1, 4, 6, 1, 3, 5, 0],
    }).filter((i) => i.rule === "col");
    expect(issues).toHaveLength(1);
    expect(issues[0].cells).toEqual([
      { r: 0, c: 1 },
      { r: 3, c: 1 },
    ]);
  });

  it("rejects two faces in the same region", () => {
    const level = withRegions((r) => (r[3][0] = 4)); // faces (3,0) and (4,2)
    const issues = validateLevel(level);
    expect(issues.map((i) => i.rule)).toEqual(["region"]);
    expect(issues[0].cells).toEqual([
      { r: 3, c: 0 },
      { r: 4, c: 2 },
    ]);
  });

  it("rejects faces that touch diagonally, naming the cells", () => {
    const issues = validateLevel({
      ...multiSolutionLevel7,
      solution: [0, 1, 3, 5, 2, 4, 6],
    });
    expect(issues).toEqual([
      {
        rule: "adjacent",
        message: expect.any(String),
        cells: [
          { r: 0, c: 0 },
          { r: 1, c: 1 },
        ],
      },
    ]);
  });

  it("reports connectivity and solution problems together", () => {
    const level = {
      ...withRegions((r) => {
        r[0][1] = 1;
        r[1][0] = 0;
      }),
      solution: [0, 1, 3, 5, 2, 4, 6],
    };
    const found = rules(level);
    expect(found).toContain("region-connected");
    expect(found).toContain("adjacent");
  });

  it("skips solution checks when the structure is invalid", () => {
    const level = { ...multiSolutionLevel7, size: 12, solution: [0, 0, 0] };
    expect(rules(level)).toEqual(["size"]);
  });
});

describe("loadLevel", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns a valid level unchanged", () => {
    expect(loadLevel(multiSolutionLevel7)).toBe(multiSolutionLevel7);
  });

  it("throws naming the rule and offending cells", () => {
    const bad = { ...multiSolutionLevel7, solution: [0, 1, 3, 5, 2, 4, 6] };
    expect(() => loadLevel(bad)).toThrow(LevelError);
    expect(() => loadLevel(bad)).toThrow(/adjacent.*\(0,0\).*\(1,1\)/);
  });

  it("throws describing the failed structural check", () => {
    const bad = {
      ...multiSolutionLevel7,
      regions: multiSolutionLevel7.regions.slice(0, 6),
    };
    expect(() => loadLevel(bad)).toThrow(/regions-shape/);
  });

  it("carries the issues on the error", () => {
    const bad = { ...multiSolutionLevel7, size: 12 };
    try {
      loadLevel(bad);
      expect.unreachable();
    } catch (e) {
      expect((e as LevelError).issues.map((i) => i.rule)).toEqual(["size"]);
    }
  });

  it("skips validation outside dev builds", () => {
    vi.stubEnv("DEV", false);
    const bad = { ...multiSolutionLevel7, solution: [0, 1, 3, 5, 2, 4, 6] };
    expect(loadLevel(bad)).toBe(bad);
  });
});
