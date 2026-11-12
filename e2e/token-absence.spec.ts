import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  callsTo,
  control,
  mainNavigation,
  PASSWORD,
  resetBackend,
  script,
  signIn,
  signOutButton,
  TOKEN_SENTINEL,
} from "./support/auth";
import { messages } from "./support/messages";
import { appPort, appServerLog, backendPort } from "./support/ports";

test.beforeEach(resetBackend);

const NEW_PASSWORD = "synthetic-password-2";

function filesIn(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}

test("the token appears nowhere a browser can reach, in a whole journey", async ({
  page,
  context,
}) => {
  const received: string[] = [];
  const addresses: string[] = [];

  page.on("request", (request) => addresses.push(request.url()));
  page.on("response", async (response) => {
    const headers = await response.allHeaders().catch(() => ({}));
    received.push(JSON.stringify(headers));
    received.push(await response.text().catch(() => ""));
  });

  const t = messages.en.auth.account;
  await signIn(page, "administrator");
  await mainNavigation(page, "en")
    .getByRole("link", { name: messages.en.shell.nav.queue })
    .click();
  await expect(page).toHaveURL(/\/en\/queue$/);

  // A list, whose page links hold the private address.
  const list = await page.evaluate(async () => {
    const response = await fetch("/api/backend/staff", {
      headers: { Accept: "application/json" },
    });
    return response.text();
  });
  received.push(list);

  await page.getByRole("link", { name: messages.en.shell.account }).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  await page.getByLabel(new RegExp(`^${t.currentPassword}`)).fill(PASSWORD);
  await page.getByLabel(new RegExp(`^${t.newPassword}`)).fill(NEW_PASSWORD);
  await page.getByLabel(new RegExp(`^${t.confirmPassword}`)).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: t.submit }).click();
  await expect(page.getByRole("status")).toContainText(t.success);

  const stored = await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    return JSON.stringify({
      cookie: document.cookie,
      local: { ...localStorage },
      session: { ...sessionStorage },
      databases,
    });
  });

  const cookies = await context.cookies();
  const session = cookies.find(({ name }) => name === "nile_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  // -1 means it ends with the browser.
  expect(session?.expires).toBe(-1);
  expect(stored).not.toContain("nile_session");
  expect(session?.value).not.toContain(TOKEN_SENTINEL);

  await signOutButton(page, "en").click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  expect(received.length).toBeGreaterThan(10);
  const everything = [...received, ...addresses, stored].join("\n");
  expect(everything).not.toContain(TOKEN_SENTINEL);
  // The private API's address reaches the browser nowhere, including in page links.
  expect(everything).not.toContain(`:${backendPort}`);
  // A password goes out in the request, and never comes back.
  expect(received.join("\n")).not.toContain(PASSWORD);
  expect(received.join("\n")).not.toContain(NEW_PASSWORD);
  expect(addresses.join("\n")).not.toContain(PASSWORD);
});

test("the server's own output holds no token or password (FR-029)", async ({
  page,
}) => {
  await signIn(page, "doctor");
  await page.goto("/en/account");
  await script("auth/me", 500);
  await page.reload();
  await script("auth/me", 0);

  const log = readFileSync(appServerLog, "utf8");
  expect(log).not.toContain(TOKEN_SENTINEL);
  expect(log).not.toContain(PASSWORD);
  expect(log).not.toContain(NEW_PASSWORD);
});

test("no file sent to browsers holds the session secret or backend setting", () => {
  const holding = filesIn(".next/static").filter((file) => {
    const content = readFileSync(file);
    return (
      content.includes("synthetic-session-secret") ||
      content.includes("BACKEND_API_URL") ||
      content.includes("SESSION_SECRET")
    );
  });

  expect(holding).toEqual([]);
});

test("unlocking a locked record reaches the browser with no token or password (FR-014)", async ({
  page,
  context,
}) => {
  const received: string[] = [];
  const addresses: string[] = [];
  page.on("request", (request) => addresses.push(request.url()));
  page.on("response", async (response) => {
    const headers = await response.allHeaders().catch(() => ({}));
    received.push(JSON.stringify(headers));
    received.push(await response.text().catch(() => ""));
  });
  const lock = messages.en.auth.lock;
  const { id } = (await control("clinic/encounter?content=%7B%7D")) as {
    id: number;
  };

  await page.clock.install();
  await signIn(page, "doctor");
  await page.goto(`/en/my/encounters/${String(id)}`);
  // The page counts from when it's shown, so it must be there before the clock moves.
  await expect(
    page
      .getByLabel(messages.en.encounters.form.diagnosis, { exact: true })
      .locator("visible=true"),
  ).toBeVisible();
  await page.clock.fastForward("05:01");
  const dialog = page.getByRole("dialog", { name: lock.heading });
  await expect(dialog).toBeVisible();

  for (const password of ["synthetic-wrong-password", PASSWORD]) {
    await dialog.getByLabel(lock.password, { exact: false }).fill(password);
    await dialog.getByRole("button", { name: lock.unlock }).click();
  }
  await expect(dialog).toBeHidden();

  const stored = await page.evaluate(async () =>
    JSON.stringify({
      cookie: document.cookie,
      local: { ...localStorage },
      session: { ...sessionStorage },
      databases: await indexedDB.databases(),
    }),
  );
  const session = (await context.cookies()).find(
    ({ name }) => name === "nile_session",
  );
  expect(session?.httpOnly).toBe(true);
  expect(session?.value).not.toContain(TOKEN_SENTINEL);

  const everything = [...received, ...addresses, stored].join("\n");
  expect(everything).not.toContain(TOKEN_SENTINEL);
  expect(received.join("\n")).not.toContain(PASSWORD);
  expect(received.join("\n")).not.toContain("synthetic-wrong-password");
  expect(addresses.join("\n")).not.toContain(PASSWORD);
});

test("sign-in's response holds only the user", async ({ page }) => {
  await page.goto("/en/sign-in");

  const body = await page.evaluate(
    async ([email, password]) => {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return response.text();
    },
    [ACCOUNTS.doctor, PASSWORD],
  );

  expect(body).not.toContain(TOKEN_SENTINEL);
  expect(body).not.toContain("token");
  expect(JSON.parse(body).data.email).toBe(ACCOUNTS.doctor);
});

test("links in view cause no extra identity calls", async ({ page }) => {
  await signIn(page, "administrator");
  await resetCallCounts();

  await page.goto("/en/dashboard", { waitUntil: "networkidle" });
  await expect(mainNavigation(page, "en")).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await callsTo("auth/me")).toBe(1);

  await mainNavigation(page, "en")
    .getByRole("link", { name: messages.en.shell.nav.queue })
    .click();
  await expect(page).toHaveURL(/\/en\/queue$/);
  await page.waitForTimeout(1500);
  expect(await callsTo("auth/me")).toBe(2);
});

async function resetCallCounts() {
  // Scripting nothing still leaves the accounts and tokens, so only the counts start again.
  await control("calls/clear");
}

test.describe("what the same-origin route refuses", () => {
  const send = (
    page: import("@playwright/test").Page,
    path: string,
    method = "POST",
  ) =>
    page.evaluate(
      async ([target, verb]) => {
        const response = await fetch(`/api/backend/${target}`, {
          method: verb,
        });
        return response.status;
      },
      [path, method],
    );

  test("sign-in and sign-out, however they're written", async ({ page }) => {
    await signIn(page, "administrator");
    await resetCallCounts();

    for (const path of ["auth/sign-in", "AUTH/SIGN-IN", "auth/sign%2Din"]) {
      expect(await send(page, path)).toBe(404);
    }
    expect(await send(page, "auth/sign-out")).toBe(404);
    expect(await callsTo("auth/sign-in")).toBe(0);
    expect(await callsTo("auth/sign-out")).toBe(0);
  });

  test("a request with another site's origin", async ({ playwright }) => {
    const client = await playwright.request.newContext({
      baseURL: `http://localhost:${appPort}`,
      extraHTTPHeaders: { Origin: "https://evil.test" },
    });

    const signedIn = await client.post("/api/auth/sign-in", {
      data: { email: ACCOUNTS.doctor, password: PASSWORD },
    });
    expect(signedIn.status()).toBe(403);

    const proxied = await client.post("/api/backend/staff");
    expect(proxied.status()).toBe(403);

    await client.dispose();
  });

  test("an audited read opened by a link, even when signed in", async ({
    page,
  }) => {
    await signIn(page, "administrator");
    await resetCallCounts();

    const response = await page.goto("/api/backend/staff");

    expect(response?.status()).toBe(406);
    expect(await callsTo("staff")).toBe(0);
  });

  test("a read with no session", async ({ request }) => {
    const response = await request.get("/api/backend/staff");
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain("Synthetic");
  });
});
