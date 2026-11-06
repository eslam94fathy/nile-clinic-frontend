import { expect, type Page } from "@playwright/test";
import { messages } from "./messages";
import { backendControlUrl } from "./ports";

export type Locale = "ar" | "en";

/** The fake backend's accounts: see `e2e/support/fake-backend.mjs`. */
export const ACCOUNTS = {
  administrator: "synthetic.admin@example.test",
  receptionist: "synthetic.reception@example.test",
  doctor: "synthetic.doctor@example.test",
  newDoctor: "synthetic.newdoctor@example.test",
} as const;

export const PASSWORD = "synthetic-password-1";
export const TOKEN_SENTINEL = "SENTINEL-TOKEN";

export async function control(path: string): Promise<unknown> {
  const response = await fetch(`${backendControlUrl}/${path}`);
  expect(response.ok).toBe(true);
  return response.json();
}

export const resetBackend = () => control("reset");

export const script = (endpoint: string, status: number) =>
  control(
    `script?endpoint=${encodeURIComponent(endpoint)}&status=${String(status)}`,
  );

export async function callsTo(endpoint: string): Promise<number> {
  const calls = (await control("calls")) as Record<string, number>;
  return calls[endpoint] ?? 0;
}

export async function fillSignIn(
  page: Page,
  locale: Locale,
  email: string,
  password: string,
) {
  const t = messages[locale].auth.signIn;
  await page.getByLabel(t.email).fill(email);
  await page.getByLabel(t.password).fill(password);
  await page.getByRole("button", { name: t.submit, exact: true }).click();
}

export async function signIn(
  page: Page,
  account: keyof typeof ACCOUNTS,
  locale: Locale = "en",
  password = PASSWORD,
) {
  await page.goto(`/${locale}/sign-in`);
  await fillSignIn(page, locale, ACCOUNTS[account], password);
  await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
}

export const mainNavigation = (page: Page, locale: Locale) =>
  page.getByRole("navigation", { name: messages[locale].shell.navigation });

export const signOutButton = (page: Page, locale: Locale) =>
  page.getByRole("button", { name: messages[locale].auth.signOut.label });
