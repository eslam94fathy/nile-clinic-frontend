import { type FocusEvent, useLayoutEffect, useRef } from "react";

/**
 * Spread this on the part of a live list whose controls a refresh can remove. If one goes while it holds the focus,
 * focus would drop to the page's start, so it moves to `fallback`. Nothing moves otherwise (FR-015, research R5).
 */
export function useKeepFocus(fallback: () => HTMLElement | null) {
  const holding = useRef(false);

  // Every render, as any refresh can remove a control.
  useLayoutEffect(() => {
    if (!holding.current || document.activeElement !== document.body) return;
    holding.current = false;
    fallback()?.focus({ preventScroll: true });
  });

  return {
    onFocusCapture: () => {
      holding.current = true;
    },
    onBlurCapture: ({ relatedTarget, target }: FocusEvent) => {
      if (relatedTarget !== null) {
        holding.current = false;
        return;
      }
      // A control being removed can blur too, and is out of the page by the time this runs. One still there was
      // left on purpose, by clicking somewhere with nothing to focus or by leaving the window.
      queueMicrotask(() => {
        if (target.isConnected) holding.current = false;
      });
    },
  };
}
