"use client";

import { useEffect, useLayoutEffect } from "react";
import { applyTheme, subscribeToTheme } from "./theme-store";

export function ThemeSync() {
  // A language switch swaps the root layout, and the inline script doesn't run again, so without
  // this the theme is lost (research R5). There's deliberately no dependency list.
  useLayoutEffect(() => {
    applyTheme();
  });

  useEffect(() => subscribeToTheme(applyTheme), []);

  return null;
}
