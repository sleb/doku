import { describe, expect, it } from "vitest";
import { Cell } from "../engine";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import { MAX_HEARTS } from "./game";
import { createGameStore } from "./gameStore";

describe("createGameStore", () => {
  it("starts idle and starts a level", () => {
    const store = createGameStore();
    expect(store.getState().status).toBe("idle");
    store.getState().startLevel(uniqueLevel7);
    const s = store.getState();
    expect(s.status).toBe("playing");
    expect(s.level).toBe(uniqueLevel7);
    expect(s.hearts).toBe(MAX_HEARTS);
  });

  it("restart resets a started level and ignores idle", () => {
    const store = createGameStore();
    store.getState().restart();
    expect(store.getState().status).toBe("idle");
    store.getState().startLevel(uniqueLevel7);
    store.setState({ status: "lost", hearts: 0 });
    store.getState().restart();
    expect(store.getState().status).toBe("playing");
    expect(store.getState().hearts).toBe(MAX_HEARTS);
  });

  it("keeps stores independent", () => {
    const a = createGameStore();
    const b = createGameStore();
    a.getState().startLevel(uniqueLevel7);
    expect(b.getState().status).toBe("idle");
  });

  it("does not mutate the previous state", () => {
    const store = createGameStore();
    store.getState().startLevel(uniqueLevel7);
    const prev = store.getState();
    if (prev.status === "idle") throw new Error("unreachable");
    (prev.board as Uint8Array)[3] = Cell.Mark;
    Object.freeze(prev);
    const snapshot = prev.board.slice();
    store.getState().startLevel(uniqueLevel7);
    expect(prev.board).toEqual(snapshot);
    expect(store.getState().board).not.toBe(prev.board);
  });

  it("keeps action identities stable", () => {
    const store = createGameStore();
    const { startLevel, restart } = store.getState();
    startLevel(uniqueLevel7);
    expect(store.getState().startLevel).toBe(startLevel);
    expect(store.getState().restart).toBe(restart);
  });
});
