import { expect, type Page } from "@playwright/test";
import { messages } from "../support/messages";

export type LiveAccount = { id: number; email: string; password: string };

export type LiveAccounts = {
  receptionist: LiveAccount;
  doctor: LiveAccount;
  newDoctor: LiveAccount;
  /** Used up by the tests that end sessions. */
  disposable: LiveAccount;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set in .env.local`);
  return value;
}

export const apiUrl = () => requireEnv("BACKEND_API_URL").replace(/\/+$/, "");

export function liveAccounts(): LiveAccounts {
  return JSON.parse(requireEnv("LIVE_ACCOUNTS")) as LiveAccounts;
}

export async function api(
  path: string,
  {
    method = "GET",
    token,
    body,
  }: { method?: string; token?: string; body?: unknown } = {},
): Promise<{
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}> {
  return fetch(`${apiUrl()}/${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Waits out the shared sign-in limit, which answers `422` even to correct details. */
export async function apiSignIn(
  email: string,
  password: string,
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await api("auth/sign-in", {
      method: "POST",
      body: { email, password },
    });
    if (response.status === 200) {
      const { data } = (await response.json()) as { data: { token: string } };
      return data.token;
    }
    await new Promise((resolve) => setTimeout(resolve, 61_000));
  }
  throw new Error("Couldn't sign in to the API for the live tests.");
}

export const adminToken = () =>
  apiSignIn(requireEnv("LIVE_ADMIN_EMAIL"), requireEnv("LIVE_ADMIN_PASSWORD"));

/** Signs in through the page, waiting out the shared limit if it's reached. */
export async function signInLive(
  page: Page,
  account: Pick<LiveAccount, "email" | "password">,
  locale: "ar" | "en" = "en",
) {
  const t = messages[locale].auth.signIn;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`/${locale}/sign-in`);
    await page.getByLabel(t.email).fill(account.email);
    await page.getByLabel(t.password).fill(account.password);
    const answer = page.waitForResponse("**/api/auth/sign-in");
    await page.getByRole("button", { name: t.submit, exact: true }).click();

    if ((await answer).status() === 200) {
      await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
      return;
    }
    await page.waitForTimeout(61_000);
  }
  throw new Error("Couldn't sign in through the page.");
}
