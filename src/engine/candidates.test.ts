import { describe, expect, it } from "vitest";
import { uniqueLevel7 } from "./__fixtures__/levels";
import { contradiction, eliminate, fromBoard, placeFace } from "./candidates";
import { compile } from "./compile";
import { Cell } from "./types";

const p = compile(uniqueLevel7);
const sum = (a: Uint8Array) => a.reduce((s, v) => s + v, 0);

describe("candidates", () => {
  it("starts with every cell alive on an empty board", () => {
    const c = fromBoard(p, new Uint8Array(49));
    expect(sum(c.alive)).toBe(49);
    expect(sum(c.placed)).toBe(0);
    expect(sum(c.satisfied)).toBe(0);
    expect(c.aliveCount[0]).toBe(7);
    expect(c.aliveCount[14]).toBe(p.units[14].cells.length);
  });

  it("placing a face eliminates its row, column, region and neighbors", () => {
    const c = placeFace(p, fromBoard(p, new Uint8Array(49)), 3 * 7 + 3);
    expect(c.placed[24]).toBe(1);
    const alive = [...c.alive].flatMap((v, i) => (v ? [i] : []));
    const region = p.regionOf[24];
    for (const i of alive) {
      if (i === 24) continue;
      const r = Math.floor(i / 7);
      const col = i % 7;
      expect(r).not.toBe(3);
      expect(col).not.toBe(3);
      expect(p.regionOf[i]).not.toBe(region);
      expect(Math.max(Math.abs(r - 3), Math.abs(col - 3))).toBeGreaterThan(1);
    }
    expect(c.satisfied[3]).toBe(1);
    expect(c.satisfied[7 + 3]).toBe(1);
    expect(c.satisfied[14 + region]).toBe(1);
  });

  it("keeps counters in sync with alive", () => {
    const c = placeFace(p, fromBoard(p, new Uint8Array(49)), 10);
    p.units.forEach((u, k) => {
      expect(c.aliveCount[k]).toBe(u.cells.filter((i) => c.alive[i]).length);
    });
  });

  it("seeds faces from the board and ignores marks", () => {
    const board = new Uint8Array(49);
    board[10] = Cell.Face;
    const marks = new Uint8Array(board);
    for (let i = 0; i < 49; i++)
      if (!marks[i] && i % 5 === 0) marks[i] = Cell.Mark;
    const a = fromBoard(p, board);
    const b = fromBoard(p, marks);
    expect(b).toEqual(a);
    expect(a).toEqual(placeFace(p, fromBoard(p, new Uint8Array(49)), 10));
  });

  it("eliminate clears alive cells, updates counters, ignores dead ones", () => {
    const c0 = fromBoard(p, new Uint8Array(49));
    const c1 = eliminate(p, c0, [0, 1]);
    expect(c1.alive[0]).toBe(0);
    expect(c1.aliveCount[0]).toBe(5);
    const c2 = eliminate(p, c1, [0, 1]);
    expect(c2).toEqual(c1);
  });

  it("returns new objects and never mutates its input", () => {
    const c0 = fromBoard(p, new Uint8Array(49));
    const snap = structuredClone(c0);
    const c1 = placeFace(p, c0, 10);
    const c2 = eliminate(p, c0, [20]);
    expect(c0).toEqual(snap);
    expect(c1).not.toBe(c0);
    expect(c1.alive).not.toBe(c0.alive);
    expect(c2.aliveCount).not.toBe(c0.aliveCount);
  });
});

describe("contradiction", () => {
  it("is false on a fresh board", () => {
    expect(contradiction(fromBoard(p))).toBe(false);
  });

  it("is true once an unsatisfied unit has no alive cell", () => {
    const row0 = Array.from(p.units[0].cells);
    expect(contradiction(eliminate(p, fromBoard(p), row0))).toBe(true);
  });

  it("is false when the empty unit is already satisfied", () => {
    const placed = placeFace(p, fromBoard(p), 0);
    // Row 0 holds its face; kill that face's cell too: the unit is satisfied.
    const c = eliminate(p, placed, [0]);
    expect(c.satisfied[0]).toBe(1);
    expect(c.aliveCount[0]).toBe(0);
    expect(contradiction(c)).toBe(false);
  });
});
