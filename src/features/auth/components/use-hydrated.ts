"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Until React has hydrated, a form's submit would be handled by the browser, not by this code. Keeping
 * the submit button disabled until then stops that, including the Enter key.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
