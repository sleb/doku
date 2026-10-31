import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import { idleState, MAX_HEARTS } from "./game";
import { gameStore, useGameStore } from "./gameStore";

afterEach(() => gameStore.setState(idleState, false));

describe("useGameStore singleton", () => {
  it("is a selector hook sharing state with gameStore", () => {
    const hearts = renderHook(() => useGameStore((s) => s.hearts));
    const status = renderHook(() => useGameStore((s) => s.status));
    expect(hearts.result.current).toBe(MAX_HEARTS);
    act(() => useGameStore.getState().startLevel(uniqueLevel7));
    expect(status.result.current).toBe("playing");
    expect(gameStore.getState().status).toBe("playing");
    const wrong = uniqueLevel7.solution[0] === 0 ? 1 : 0;
    act(() => gameStore.getState().placeFace(wrong));
    expect(hearts.result.current).toBe(MAX_HEARTS - 1);
  });
});
