import { describe, expect, it } from "vitest";
import { generate, type Level } from "../src/engine";
import {
  multiSolutionLevel7,
  uniqueLevel7,
} from "../src/engine/__fixtures__/levels";
import {
  buildPack,
  type CurriculumRow,
  canonicalForm,
  collectRow,
  computeStats,
  formatStats,
  levelId,
  rowStartIndexes,
  verifyLevel,
} from "./pack";

const rotate = (g: number[][]): number[][] =>
  g[0].map((_, c) => g.map((row) => row[c]).reverse());
const mirror = (g: number[][]): number[][] =>
  g.map((row) => [...row].reverse());

function symmetries(g: number[][]): number[][][] {
  const out: number[][][] = [];
  let cur = g;
  for (let i = 0; i < 4; i++) {
    out.push(cur, mirror(cur));
    cur = rotate(cur);
  }
  return out;
}

describe("canonicalForm", () => {
  it("is identical across all 8 symmetries", () => {
    const forms = symmetries(uniqueLevel7.regions).map((regions) =>
      canonicalForm({ ...uniqueLevel7, regions }),
    );
    expect(new Set(forms).size).toBe(1);
  });

  it("ignores region relabelling", () => {
    const n = uniqueLevel7.size;
    const regions = uniqueLevel7.regions.map((row) =>
      row.map((id) => n - 1 - id),
    );
    expect(canonicalForm({ ...uniqueLevel7, regions })).toBe(
      canonicalForm(uniqueLevel7),
    );
  });

  it("differs for a different level", () => {
    expect(canonicalForm(multiSolutionLevel7)).not.toBe(
      canonicalForm(uniqueLevel7),
    );
  });
});

describe("levelId", () => {
  it("pads size and index", () => {
    expect(levelId(undefined, 7, 3)).toBe("any-07-003");
    expect(levelId("easy", 11, 12)).toBe("easy-11-012");
  });

  it("numbers per (tier, size) over the whole curriculum, 1-based", () => {
    const curriculum: CurriculumRow[] = [
      { pack: 1, size: 7, count: 2 },
      { pack: 1, size: 8, count: 3 },
      { pack: 2, size: 7, count: 4 },
    ];
    expect(rowStartIndexes(curriculum)).toEqual([1, 1, 3]);
  });
});

// Real 7x7 generation, the same call the CLI makes.
const stubGenerate = ({ size, seed }: { size: number; seed: string }) =>
  generate({ size, seed });

describe("collectRow", () => {
  const row: CurriculumRow = { pack: 1, size: 7, count: 2 };

  it("collects exactly count levels with ids and row seeds", () => {
    const seen = new Set<string>();
    const gen = (o: { size: number; seed: string }) => stubGenerate(o);
    const { levels, failure } = collectRow(row, 1, seen, gen);
    expect(failure).toBeUndefined();
    expect(levels.map((l) => l.id)).toEqual(["any-07-001", "any-07-002"]);
    for (const l of levels) {
      expect(l.seed).toMatch(/^pack-1\/7\/any\/\d+#\d+$/);
      expect(l.tier).toBeUndefined();
    }
    expect(seen.size).toBe(2);
  });

  it("skips a duplicate and moves to the next seed", () => {
    const calls: string[] = [];
    const seen = new Set([canonicalForm(uniqueLevel7)]);
    const alt = collectRow({ ...row, count: 1 }, 1, seen, ({ size, seed }) => {
      calls.push(seed);
      return calls.length < 3
        ? { ...uniqueLevel7, id: seed, seed }
        : stubGenerate({ size, seed });
    });
    expect(calls).toEqual([
      "pack-1/7/any/0",
      "pack-1/7/any/1",
      "pack-1/7/any/2",
    ]);
    expect(alt.levels).toHaveLength(1);
  });

  it("reports a failure when generate returns null", () => {
    const { levels, failure } = collectRow(row, 1, new Set(), () => null);
    expect(levels).toEqual([]);
    expect(failure).toMatch(/size 7/);
  });
});

describe("verifyLevel", () => {
  const real = { ...stubGenerate({ size: 7, seed: "v" }), id: "x" } as Level;

  it("passes a real generated level", () => {
    expect(verifyLevel(real)).toEqual([]);
  });

  it("rejects a non-unique level", () => {
    expect(verifyLevel(multiSolutionLevel7)).not.toEqual([]);
  });

  it("rejects a solution mismatch", () => {
    const solution = [...uniqueLevel7.solution].reverse();
    expect(verifyLevel({ ...uniqueLevel7, solution })).not.toEqual([]);
  });

  it("rejects an invalid level", () => {
    expect(verifyLevel({ ...uniqueLevel7, size: 6 })).not.toEqual([]);
  });
});

describe("buildPack", () => {
  const curriculum: CurriculumRow[] = [
    { pack: 1, size: 7, count: 2 },
    { pack: 1, size: 7, count: 2 },
    { pack: 2, size: 8, count: 5 },
  ];
  const gen = (o: { size: number; seed: string }) => stubGenerate(o);

  it("is byte-identical across runs, in row order, only the requested pack", () => {
    const a = buildPack(curriculum, 1, [], { generate: gen });
    const b = buildPack(curriculum, 1, [], { generate: gen });
    expect(a.json).toBe(b.json);
    expect(a.failures).toEqual([]);
    expect(a.levels.map((l) => l.id)).toEqual([
      "any-07-001",
      "any-07-002",
      "any-07-003",
      "any-07-004",
    ]);
    expect(a.json.endsWith("}\n")).toBe(true);
    // Number arrays stay on one line, the way Biome formats JSON.
    expect(a.json).toContain('"solution": [');
    expect(a.json.split("\n").some((l) => /^\s*\d+,?$/.test(l))).toBe(false);
    expect(JSON.parse(a.json).levels).toEqual(a.levels);
  });

  it("refuses an id already used by another pack", () => {
    const other = [
      { pack: 9, levels: [{ ...uniqueLevel7, id: "any-07-002" }] },
    ];
    expect(() => buildPack(curriculum, 1, other, { generate: gen })).toThrow(
      /any-07-002/,
    );
  });

  it("skips boards already in lower-numbered packs", () => {
    const first = buildPack(curriculum, 1, [], { generate: gen });
    const two = buildPack(
      [...curriculum, { pack: 2, size: 7, count: 2 }],
      2,
      [{ pack: 1, levels: first.levels }],
      { generate: gen },
    );
    const forms = new Set(first.levels.map(canonicalForm));
    for (const l of two.levels) expect(forms.has(canonicalForm(l))).toBe(false);
  });

  it("builds only rows accepted by the filter, keeping ids", () => {
    const res = buildPack(
      [...curriculum, { pack: 1, size: 8, count: 1 }],
      1,
      [],
      {
        generate: gen,
        filter: (row) => row.size === 8,
      },
    );
    expect(res.levels.map((l) => l.id)).toEqual(["any-08-006"]);
  });

  it("reports unfillable rows as failures", () => {
    const res = buildPack(curriculum, 1, [], { generate: () => null });
    expect(res.levels).toEqual([]);
    expect(res.failures).toHaveLength(2);
  });

  it("aborts on a level that fails verification", () => {
    const bad = ({ seed }: { size: number; seed: string }): Level => ({
      ...multiSolutionLevel7,
      id: seed,
      seed,
    });
    expect(() => buildPack(curriculum, 1, [], { generate: bad })).toThrow(
      /verif/i,
    );
  });
});

describe("computeStats", () => {
  const stats = computeStats(7, 5);

  it("measures attempts to first success over fixed seeds", () => {
    expect(stats.size).toBe(7);
    expect(stats.seeds).toBe(5);
    expect(stats.failed).toBe(0);
    expect(stats.medianAttempts).toBeGreaterThanOrEqual(1);
    expect(stats.p90Attempts).toBeGreaterThanOrEqual(stats.medianAttempts);
    expect(stats.attempts).toBe(
      stats.seeds + stats.rejects.repair + stats.rejects.shape,
    );
    expect(stats.wallMs).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic apart from wall time", () => {
    expect({ ...computeStats(7, 5), wallMs: 0 }).toEqual({
      ...stats,
      wallMs: 0,
    });
  });

  it("formats one line per size under a header", () => {
    const text = formatStats([stats]);
    const lines = text.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/size.*median.*p90.*repair.*shape.*ms/);
    expect(lines[1]).toMatch(/^\s*7\b/);
  });
});
