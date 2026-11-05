import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { settingsStore } from "../../store/settings";
import { announcerStore } from "./announcerStore";
import { useInputModeAnnouncement } from "./useInputModeAnnouncement";

const text = () => announcerStore.getState().text;

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  announcerStore.getState().reset();
  settingsStore.getState().set({ inputMode: "mark" });
});

test("says nothing on mount", () => {
  renderHook(() => useInputModeAnnouncement());
  expect(text()).toBe("");
});

test("announces a change from any writer, in both directions", () => {
  renderHook(() => useInputModeAnnouncement());
  act(() => settingsStore.getState().set({ inputMode: "face" }));
  expect(text()).toBe("Tapping now places faces.");
  act(() => settingsStore.getState().set({ inputMode: "mark" }));
  expect(text()).toBe("Tapping now marks cells.");
});

test("an unchanged value, or another setting, is silent", () => {
  renderHook(() => useInputModeAnnouncement());
  act(() => settingsStore.getState().set({ inputMode: "mark", sound: false }));
  expect(text()).toBe("");
});

test("stops listening on unmount", () => {
  const { unmount } = renderHook(() => useInputModeAnnouncement());
  unmount();
  act(() => settingsStore.getState().set({ inputMode: "face" }));
  expect(text()).toBe("");
});
