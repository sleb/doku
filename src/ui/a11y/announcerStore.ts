import { createStore } from "zustand/vanilla";

/** How long announced text stays in the live region. */
export const ANNOUNCE_CLEAR_MS = 1000;

interface AnnouncerStore {
  text: string;
  say(text: string): void;
  reset(): void;
}

let seq = 0;
let frame: number | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

export const announcerStore = createStore<AnnouncerStore>()((set) => ({
  text: "",
  // Empty first, then the text a frame later, so identical consecutive
  // text is a change the screen reader announces again.
  say(text) {
    const mine = ++seq;
    clearTimeout(timer);
    set({ text: "" });
    cancelAnimationFrame(frame ?? 0);
    frame = requestAnimationFrame(() => {
      if (mine !== seq) return;
      set({ text });
      timer = setTimeout(() => {
        if (mine === seq) set({ text: "" });
      }, ANNOUNCE_CLEAR_MS);
    });
  },
  reset() {
    seq++;
    clearTimeout(timer);
    cancelAnimationFrame(frame ?? 0);
    set({ text: "" });
  },
}));
