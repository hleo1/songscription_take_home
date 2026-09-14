import { useEffect } from "react";

/** Calls `onEscape` on Escape, unless something that ran earlier already
    handled the key (called preventDefault), and marks it handled. Inline
    editors call preventDefault themselves; a dialog layered over another
    passes `capture` so its listener runs before the one underneath. */
export function useEscape(
  onEscape: () => void,
  { enabled = true, capture = false } = {},
) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      onEscape();
    };
    window.addEventListener("keydown", onKey, capture);
    return () => window.removeEventListener("keydown", onKey, capture);
  }, [onEscape, enabled, capture]);
}

/** Stops the page behind an open dialog from scrolling. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}
