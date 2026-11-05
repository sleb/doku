import { beforeEach, describe, expect, test } from "vitest";
import { fxStore } from "./fxStore";

beforeEach(() => fxStore.setState({ last: null, seq: 0 }, false));

describe("fxStore", () => {
  test("starts empty", () => {
    expect(fxStore.getState().last).toBeNull();
  });

  test("set records kind, cell and hearts with an incrementing seq", () => {
    fxStore.getState().set({ kind: "place", cell: 4, faces: 1, hearts: 3 });
    expect(fxStore.getState().last).toEqual({
      seq: 1,
      kind: "place",
      cell: 4,
      hearts: 3,
    });
    fxStore.getState().set({ kind: "place", cell: 4, faces: 2, hearts: 3 });
    expect(fxStore.getState().last?.seq).toBe(2);
  });

  test("a win has no cell", () => {
    fxStore.getState().set({ kind: "win", faces: 7, hearts: 2 });
    expect(fxStore.getState().last?.cell).toBeUndefined();
  });

  test("clear empties last but seq keeps counting", () => {
    fxStore.getState().set({ kind: "wrong", cell: 1, faces: 0, hearts: 2 });
    fxStore.getState().clear();
    expect(fxStore.getState().last).toBeNull();
    fxStore.getState().set({ kind: "wrong", cell: 1, faces: 0, hearts: 1 });
    expect(fxStore.getState().last?.seq).toBe(2);
  });
});
