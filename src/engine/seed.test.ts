import { describe, expect, it } from "vitest";
import { hashSeed, makeRng } from "./seed";

describe("makeRng", () => {
  it("is deterministic and in [0, 1)", () => {
    const a = makeRng("doku");
    const b = makeRng("doku");
    const xs = Array.from({ length: 1000 }, () => a.next());
    const ys = Array.from({ length: 1000 }, () => b.next());
    expect(xs).toEqual(ys);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(1);
  });

  it("differs across seeds", () => {
    const xs = Array.from(
      { length: 5 },
      (
        (r) => () =>
          r.next()
      )(makeRng("a")),
    );
    const ys = Array.from(
      { length: 5 },
      (
        (r) => () =>
          r.next()
      )(makeRng("b")),
    );
    expect(xs).not.toEqual(ys);
  });

  it("matches the frozen vector for 'doku'", () => {
    expect(hashSeed("doku")).toBe(1694227345);
    const r = makeRng("doku");
    expect([r.next(), r.next(), r.next(), r.next(), r.next()]).toEqual([
      0.8074243797454983, 0.28086769953370094, 0.6483440473675728,
      0.3739689262583852, 0.49767888570204377,
    ]);
  });
});

describe("int", () => {
  it("stays in [0, n)", () => {
    const r = makeRng("int");
    for (let i = 0; i < 500; i++) {
      const v = r.int(7);
      expect(Number.isInteger(v) && v >= 0 && v < 7).toBe(true);
    }
    expect(r.int(1)).toBe(0);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws RangeError for %s",
    (n) => {
      expect(() => makeRng("x").int(n)).toThrow(RangeError);
    },
  );
});

describe("shuffle", () => {
  it("returns a deterministic permutation without touching the input", () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const out = makeRng("s").shuffle(input);
    expect(out).not.toBe(input);
    expect([...out].sort((a, b) => a - b)).toEqual([...input]);
    expect(makeRng("s").shuffle(input)).toEqual(out);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("handles length 0 and 1", () => {
    expect(makeRng("s").shuffle([])).toEqual([]);
    expect(makeRng("s").shuffle([9])).toEqual([9]);
  });
});

describe("pick", () => {
  it("returns a member deterministically", () => {
    const items = ["a", "b", "c", "d"];
    const v = makeRng("p").pick(items);
    expect(items).toContain(v);
    expect(makeRng("p").pick(items)).toBe(v);
  });

  it("throws RangeError on empty", () => {
    expect(() => makeRng("p").pick([])).toThrow(RangeError);
  });
});
