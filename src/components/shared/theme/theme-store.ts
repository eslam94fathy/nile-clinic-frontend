import { useSyncExternalStore } from "react";
import {
  type EffectiveTheme,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "./theme-constants";

const DARK_QUERY = "(prefers-color-scheme: dark)";

// Holds a choice that storage refused, so the switch still works until the page reloads.
let unsavedChoice: ThemeChoice | null = null;

function readChoice(): ThemeChoice {
  if (unsavedChoice) return unsavedChoice;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "device";
  } catch {
    // Storage can be blocked. The device's setting then applies.
    return "device";
  }
}

function effectiveTheme(): EffectiveTheme {
  const choice = readChoice();
  if (choice !== "device") return choice;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function applyTheme(): void {
  document.documentElement.dataset.theme = effectiveTheme();
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  listeners.add(listener);
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "device") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
    unsavedChoice = null;
  } catch {
    unsavedChoice = choice;
  }
  applyTheme();
  listeners.forEach((listener) => listener());
}

/** Calls `listener` when the theme may have changed, such as a change of the device's setting. */
export const subscribeToTheme = subscribe;

const deviceOnServer = (): ThemeChoice => "device";
const lightOnServer = (): EffectiveTheme => "light";

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, readChoice, deviceOnServer);
}

export function useEffectiveTheme(): EffectiveTheme {
  return useSyncExternalStore(subscribe, effectiveTheme, lightOnServer);
}
