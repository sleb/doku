import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Cell } from "../engine";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import { MAX_HEARTS } from "./game";
import { createGameStore, gameStore, useGameStore } from "./gameStore";

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
    const lost = store.getState();
    if (lost.status === "idle") throw new Error("unreachable");
    (lost.board as Uint8Array)[3] = Cell.Mark;
    store.setState({ status: "lost", hearts: 0, wrong: new Set([3, 5]) });
    store.getState().restart();
    const s = store.getState();
    if (s.status === "idle") throw new Error("unreachable");
    expect(s.status).toBe("playing");
    expect(s.hearts).toBe(MAX_HEARTS);
    expect(s.wrong.size).toBe(0);
    expect(s.board.every((c) => c === Cell.Empty)).toBe(true);
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
    const snapshot = prev.board.slice();
    const prevFields = { ...prev };
    store.getState().startLevel(uniqueLevel7);
    expect(prev.board).toEqual(snapshot);
    expect(prev).toEqual(prevFields);
    const next = store.getState();
    if (next.status === "idle") throw new Error("unreachable");
    expect(next.board).not.toBe(prev.board);
    expect(next.board.every((c) => c === Cell.Empty)).toBe(true);
  });

  it("keeps action identities stable", () => {
    const store = createGameStore();
    const { startLevel, restart, toggleMark, placeFace } = store.getState();
    startLevel(uniqueLevel7);
    toggleMark(0);
    expect(store.getState().startLevel).toBe(startLevel);
    expect(store.getState().restart).toBe(restart);
    expect(store.getState().toggleMark).toBe(toggleMark);
    placeFace(uniqueLevel7.solution[0]);
    expect(store.getState().placeFace).toBe(placeFace);
  });

  it("toggleMark updates the board and skips no-ops", () => {
    const store = createGameStore();
    store.getState().startLevel(uniqueLevel7);
    store.getState().toggleMark(4);
    const s = store.getState();
    if (s.status === "idle") throw new Error("unreachable");
    expect(s.board[4]).toBe(Cell.Mark);

    store.setState({ wrong: new Set([4]) });
    let calls = 0;
    store.subscribe(() => {
      calls++;
    });
    store.getState().toggleMark(4);
    expect(calls).toBe(0);
  });

  describe("toggleMark no-ops fire no subscriber", () => {
    function expectSilent(
      setup: (store: ReturnType<typeof createGameStore>) => void,
    ) {
      const store = createGameStore();
      setup(store);
      let calls = 0;
      store.subscribe(() => {
        calls++;
      });
      store.getState().toggleMark(4);
      expect(calls).toBe(0);
    }

    it("on an idle store", () => {
      expectSilent(() => {});
    });

    it("on a won store", () => {
      expectSilent((store) => {
        store.getState().startLevel(uniqueLevel7);
        store.setState({ status: "won" });
      });
    });

    it("on a lost store", () => {
      expectSilent((store) => {
        store.getState().startLevel(uniqueLevel7);
        store.setState({ status: "lost", hearts: 0, wrong: new Set([3]) });
      });
    });

    it("on a Face cell", () => {
      expectSilent((store) => {
        store.getState().startLevel(uniqueLevel7);
        const s = store.getState();
        if (s.status === "idle") throw new Error("unreachable");
        const board = s.board.slice();
        board[4] = Cell.Face;
        store.setState({ board });
      });
    });
  });

  it("toggleMark throws RangeError for an out-of-range cell while playing", () => {
    const store = createGameStore();
    store.getState().startLevel(uniqueLevel7);
    expect(() => store.getState().toggleMark(999)).toThrow(RangeError);
  });

  it("placeFace updates state and skips locked no-ops", () => {
    const store = createGameStore();
    store.getState().startLevel(uniqueLevel7);
    const sol = uniqueLevel7.solution[0];
    store.getState().placeFace(sol);
    let s = store.getState();
    if (s.status === "idle") throw new Error("unreachable");
    expect(s.board[sol]).toBe(Cell.Face);
    expect(s.hearts).toBe(MAX_HEARTS);

    const wrongCell = sol === 0 ? 1 : 0;
    store.getState().placeFace(wrongCell);
    s = store.getState();
    if (s.status === "idle") throw new Error("unreachable");
    expect(s.hearts).toBe(MAX_HEARTS - 1);
    expect(s.wrong.has(wrongCell)).toBe(true);

    let calls = 0;
    store.subscribe(() => {
      calls++;
    });
    store.getState().placeFace(wrongCell);
    store.getState().placeFace(sol);
    expect(calls).toBe(0);
  });

  it("placeFace through the store reaches won", () => {
    const store = createGameStore();
    store.getState().startLevel(uniqueLevel7);
    const { size, solution } = uniqueLevel7;
    for (let r = 0; r < size; r++) {
      store.getState().placeFace(r * size + solution[r]);
    }
    expect(store.getState().status).toBe("won");
  });

  it("placeFace through the store reaches lost", () => {
    const store = createGameStore();
    store.getState().startLevel(uniqueLevel7);
    const { size, solution } = uniqueLevel7;
    const wrong = Array.from({ length: size }, (_, c) => c)
      .filter((c) => c !== solution[0])
      .slice(0, MAX_HEARTS);
    for (const c of wrong) store.getState().placeFace(c);
    const s = store.getState();
    expect(s.status).toBe("lost");
    expect(s.hearts).toBe(0);
  });

  it("finished stores ignore placeFace and toggleMark silently", () => {
    const { size, solution } = uniqueLevel7;
    const winCells = solution.map((c, r) => r * size + c);
    const wrong = Array.from({ length: size }, (_, c) => c)
      .filter((c) => c !== solution[0])
      .slice(0, MAX_HEARTS);
    for (const [status, cells] of [
      ["won", winCells],
      ["lost", wrong],
    ] as const) {
      const store = createGameStore();
      store.getState().startLevel(uniqueLevel7);
      for (const c of cells) store.getState().placeFace(c);
      expect(store.getState().status).toBe(status);
      const before = store.getState();
      if (before.status === "idle") throw new Error("unreachable");
      // Cells that would be editable if the game were still playing.
      const probes = Array.from({ length: size * size }, (_, i) => i).filter(
        (i) => before.board[i] !== Cell.Face && !before.wrong.has(i),
      );
      expect(probes.length).toBeGreaterThan(0);
      let calls = 0;
      store.subscribe(() => {
        calls++;
      });
      for (const c of probes) {
        store.getState().placeFace(c);
        store.getState().toggleMark(c);
      }
      expect(calls).toBe(0);
      expect(store.getState()).toBe(before);
    }
  });

  it("placeFace throws RangeError for an out-of-range cell while playing", () => {
    const store = createGameStore();
    store.getState().startLevel(uniqueLevel7);
    expect(() => store.getState().placeFace(uniqueLevel7.size ** 2)).toThrow(
      RangeError,
    );
  });
});

describe("useGameStore singleton", () => {
  it("is a selector hook sharing state with gameStore", () => {
    const { result } = renderHook(() => useGameStore((s) => s.hearts));
    expect(result.current).toBe(MAX_HEARTS);
    const status = renderHook(() => useGameStore((s) => s.status));
    act(() => useGameStore.getState().startLevel(uniqueLevel7));
    expect(status.result.current).toBe("playing");
    expect(gameStore.getState().status).toBe("playing");
    act(() =>
      gameStore.getState().placeFace(0 === uniqueLevel7.solution[0] ? 1 : 0),
    );
    expect(result.current).toBe(MAX_HEARTS - 1);
  });
});
