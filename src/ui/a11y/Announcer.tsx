import { useStore } from "zustand";
import { announcerStore } from "./announcerStore";

/** The one screen-reader live region. Keep it outside any `inert` subtree. */
export function Announcer() {
  const text = useStore(announcerStore, (s) => s.text);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {text}
    </div>
  );
}
