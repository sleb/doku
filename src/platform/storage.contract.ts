import { beforeEach, describe, expect, it } from "vitest";
import type { Storage } from "./storage";

/** Behaviour every Storage adapter must share. */
export function runStorageContract(name: string, make: () => Storage) {
  describe(`${name} contract`, () => {
    let s: Storage;
    beforeEach(() => {
      s = make();
    });

    it("returns undefined for a missing key", async () => {
      expect(await s.get("missing")).toBeUndefined();
    });

    it("round-trips objects, arrays, numbers and strings", async () => {
      await s.set("o", { a: 1, b: [1, 2, { c: "x" }] });
      await s.set("a", [1, "two", null]);
      await s.set("n", 42);
      await s.set("s", "hello");
      expect(await s.get("o")).toEqual({ a: 1, b: [1, 2, { c: "x" }] });
      expect(await s.get("a")).toEqual([1, "two", null]);
      expect(await s.get("n")).toBe(42);
      expect(await s.get("s")).toBe("hello");
    });

    it("overwrites an existing key", async () => {
      await s.set("k", 1);
      await s.set("k", 2);
      expect(await s.get("k")).toBe(2);
    });

    it("removes a key, and removing a missing key is fine", async () => {
      await s.set("k", 1);
      await s.remove("k");
      expect(await s.get("k")).toBeUndefined();
      await expect(s.remove("never")).resolves.toBeUndefined();
    });

    it("keeps keys independent", async () => {
      await s.set("a", 1);
      await s.set("b", 2);
      await s.remove("a");
      expect(await s.get("b")).toBe(2);
    });

    it("does not alias stored values", async () => {
      const v = { n: 1 };
      await s.set("k", v);
      v.n = 2;
      const got = await s.get<{ n: number }>("k");
      expect(got).toEqual({ n: 1 });
      if (got) got.n = 3;
      expect(await s.get("k")).toEqual({ n: 1 });
    });

    it("flush resolves without losing data", async () => {
      await s.set("k", "v");
      await expect(s.flush()).resolves.toBeUndefined();
      expect(await s.get("k")).toBe("v");
    });
  });
}
