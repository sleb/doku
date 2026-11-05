import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { announcerStore } from "./announcerStore";

let frames = new Map<number, FrameRequestCallback>();
let nextId = 0;
const flush = () => {
  const f = [...frames.values()];
  frames.clear();
  for (const cb of f) cb(0);
};

beforeEach(() => {
  vi.useFakeTimers();
  frames = new Map();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.set(++nextId, cb);
    return nextId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  announcerStore.getState().reset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const text = () => announcerStore.getState().text;

describe("announcerStore", () => {
  test("say clears first, then sets the text one frame later", () => {
    announcerStore.getState().say("a");
    expect(text()).toBe("");
    flush();
    expect(text()).toBe("a");
  });

  test("identical consecutive text passes through empty again", () => {
    announcerStore.getState().say("a");
    flush();
    const seen: string[] = [];
    announcerStore.subscribe((s) => seen.push(s.text));
    announcerStore.getState().say("a");
    flush();
    expect(seen).toEqual(["", "a"]);
  });

  test("a stale frame does not overwrite a newer say", () => {
    announcerStore.getState().say("a");
    announcerStore.getState().say("b");
    flush();
    expect(text()).toBe("b");
  });

  test("clears itself 1 s after the text appears", () => {
    announcerStore.getState().say("a");
    flush();
    vi.advanceTimersByTime(999);
    expect(text()).toBe("a");
    vi.advanceTimersByTime(1);
    expect(text()).toBe("");
  });

  test("reset clears the text and cancels a pending frame", () => {
    announcerStore.getState().say("a");
    flush();
    announcerStore.getState().say("b");
    announcerStore.getState().reset();
    expect(frames.size).toBe(0);
    flush();
    expect(text()).toBe("");
  });
});
