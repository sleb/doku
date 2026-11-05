import { type ReactNode, useEffect, useId, useRef } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: focus moves in on open and is restored on close, Tab cycles
 * inside, siblings are inert, and Escape closes only when `onClose` is given.
 * Mount it only while open.
 */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const previous = document.activeElement as HTMLElement | null;
    const inerted: Element[] = [];
    for (const sibling of Array.from(el.parentElement?.children ?? [])) {
      // A live region must stay reachable so announcements are still spoken.
      if (
        sibling !== el &&
        sibling.getAttribute("role") !== "status" &&
        !sibling.hasAttribute("inert")
      ) {
        sibling.setAttribute("inert", "");
        inerted.push(sibling);
      }
    }
    const target =
      el.querySelector<HTMLElement>("[data-autofocus]") ??
      el.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    return () => {
      for (const s of inerted) s.removeAttribute("inert");
      previous?.focus();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && onClose) {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.from(
      root.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    );
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !root.current?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (
      !e.shiftKey &&
      (active === last || !root.current?.contains(active))
    ) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={root}
      className="dialog-backdrop fixed inset-0 z-10 flex items-center justify-center bg-black/50 safe-padding"
    >
      <div
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="dialog-in flex max-h-full min-h-0 flex-col items-center gap-4 rounded-lg border border-line bg-surface text-ink p-6 shadow-lg"
      >
        <h2 id={titleId} className="text-xl font-semibold">
          {title}
        </h2>
        <div
          data-testid="dialog-body"
          className="flex min-h-0 -mx-1 w-[calc(100%+0.5rem)] flex-1 flex-col items-center gap-4 overflow-y-auto px-1"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
