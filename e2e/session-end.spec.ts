import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  callsTo,
  control,
  fillSignIn,
  mainNavigation,
  PASSWORD,
  resetBackend,
  script,
  signIn,
  signOutButton,
} from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const hasSessionCookie = async (page: import("@playwright/test").Page) =>
  (await page.context().cookies()).some(({ name }) => name === "nile_session");

const sessionEnded = messages.en.auth.signIn.sessionEnded;

test.describe("signing out", () => {
  test("ends the token and clears the session", async ({ page }) => {
    await signIn(page, "doctor");

    await signOutButton(page, "en").click();

    await expect(page).toHaveURL(/\/en\/sign-in$/);
    expect(await hasSessionCookie(page)).toBe(false);
    expect(await callsTo("auth/sign-out")).toBe(1);
  });

  for (const status of [500, -1]) {
    test(`still works when the API answers ${String(status)}`, async ({
      page,
    }) => {
      await signIn(page, "doctor");
      await script("auth/sign-out", status);

      await signOutButton(page, "en").click();

      await expect(page).toHaveURL(/\/en\/sign-in$/);
      expect(await hasSessionCookie(page)).toBe(false);
    });
  }

  test("stays and says so when the application can't be reached", async ({
    page,
  }) => {
    await signIn(page, "doctor");
    await page.route("**/api/auth/sign-out", (route) => route.abort());

    await signOutButton(page, "en").click();

    await expect(
      page.getByText(messages.en.auth.signOut.failure),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    expect(await hasSessionCookie(page)).toBe(true);
  });

  test("leaves nothing behind for the back button", async ({ page }) => {
    await signIn(page, "receptionist");
    await mainNavigation(page, "en")
      .getByRole("link", { name: messages.en.shell.nav.queue })
      .click();
    await expect(page).toHaveURL(/\/en\/queue$/);

    await signOutButton(page, "en").click();
    await expect(page).toHaveURL(/\/en\/sign-in$/);

    await page.goBack();

    await expect(page).toHaveURL(/\/en\/sign-in/);
    await expect(mainNavigation(page, "en")).toHaveCount(0);
    await expect(page.getByText("Synthetic Reception")).toHaveCount(0);
  });

  test("sends signed-in pages as not to be stored", async ({ page }) => {
    await signIn(page, "doctor");

    const response = await page.request.get("/en/dashboard");

    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("leaves no hidden screen mounted", async ({ page }) => {
    await signIn(page, "receptionist");
    await mainNavigation(page, "en")
      .getByRole("link", { name: messages.en.shell.nav.queue })
      .click();
    await expect(page).toHaveURL(/\/en\/queue$/);

    await page.evaluate(() => {
      Object.assign(window, { sameDocument: true });
    });
    await signOutButton(page, "en").click();
    await expect(page).toHaveURL(/\/en\/sign-in$/);

    // A full navigation replaces the document, and everything Next.js kept hidden in it.
    expect(await page.evaluate(() => "sameDocument" in window)).toBe(false);
    expect(await page.content()).not.toContain("Synthetic Reception");
  });
});

test.describe("a session that ended elsewhere", () => {
  test("goes to sign-in on the next page load", async ({ page }) => {
    await signIn(page, "doctor");
    await control(`revoke?email=${ACCOUNTS.doctor}`);

    await page.goto("/en/dashboard");

    await expect(page).toHaveURL(/\/en\/sign-in\?ended=1&return=%2Fdashboard$/);
    await expect(page.getByText(sessionEnded)).toBeVisible();
    expect(await hasSessionCookie(page)).toBe(false);
  });

  test("goes to sign-in on the next navigation", async ({ page }) => {
    await signIn(page, "receptionist");
    await control(`revoke?email=${ACCOUNTS.receptionist}`);

    await mainNavigation(page, "en")
      .getByRole("link", { name: messages.en.shell.nav.queue })
      .click();

    await expect(page).toHaveURL(/\/en\/sign-in\?ended=1/);
    expect(await hasSessionCookie(page)).toBe(false);
    await expect(page.getByText("Synthetic Reception")).toHaveCount(0);
  });

  test("goes to sign-in from a browser request, in Arabic", async ({
    page,
  }) => {
    await signIn(page, "doctor", "ar");
    await page.goto("/ar/account");
    await control(`revoke?email=${ACCOUNTS.doctor}`);
    const t = messages.ar.auth.account;

    await page.getByLabel(new RegExp(`^${t.currentPassword}`)).fill(PASSWORD);
    await page
      .getByLabel(new RegExp(`^${t.newPassword}`))
      .fill("synthetic-password-2");
    await page
      .getByLabel(new RegExp(`^${t.confirmPassword}`))
      .fill("synthetic-password-2");
    await page.getByRole("button", { name: t.submit }).click();

    await expect(page).toHaveURL(/\/ar\/sign-in\?ended=1/);
    await expect(
      page.getByText(messages.ar.auth.signIn.sessionEnded),
    ).toBeVisible();
    expect(await hasSessionCookie(page)).toBe(false);
  });

  test("redirects once, however many requests fail together", async ({
    page,
  }) => {
    await signIn(page, "doctor");
    await page.goto("/en/account");
    await control(`revoke?email=${ACCOUNTS.doctor}`);
    const ended: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/auth/session-ended")) {
        ended.push(request.url());
      }
    });

    // The page's own module, as the application's client calls go through it.
    await page.evaluate(async () => {
      await Promise.all(
        [1, 2, 3].map(() =>
          fetch("/api/backend/auth/me", {
            headers: { Accept: "application/json" },
          }),
        ),
      );
    });
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/sign-in\?ended=1/);

    expect(ended).toHaveLength(1);
  });

  test("a tampered cookie counts as no session, with no error page", async ({
    page,
    context,
  }) => {
    await signIn(page, "doctor");
    const cookies = await context.cookies();
    const session = cookies.find(({ name }) => name === "nile_session");
    expect(session).toBeDefined();
    if (!session) return;
    await context.addCookies([
      { ...session, value: `${session.value.slice(0, -4)}AAAA` },
    ]);

    await page.goto("/en/dashboard");

    await expect(page).toHaveURL(/\/en\/sign-in\?ended=1/);
    await expect(
      page.getByRole("heading", { name: messages.en.auth.signIn.heading }),
    ).toBeVisible();
    expect(await hasSessionCookie(page)).toBe(false);
  });

  test("the session-ended address can't sign out a working session", async ({
    page,
  }) => {
    await signIn(page, "doctor");

    await page.goto("/api/auth/session-ended?locale=en");

    await expect(page).toHaveURL(/\/en\/dashboard$/);
    expect(await hasSessionCookie(page)).toBe(true);
    await expect(mainNavigation(page, "en")).toBeVisible();
  });
});

test.describe("two tabs", () => {
  test("signing out in one leaves the other's screen", async ({
    context,
    page,
  }) => {
    await signIn(page, "doctor");
    const other = await context.newPage();
    await other.goto("/en/account");
    await expect(mainNavigation(other, "en")).toBeVisible();

    await signOutButton(page, "en").click();

    await expect(other).toHaveURL(/\/en\/sign-in$/);
    await expect(mainNavigation(other, "en")).toHaveCount(0);
  });

  test("a session found to have ended in one leaves the other's screen", async ({
    context,
    page,
  }) => {
    await signIn(page, "receptionist");
    const other = await context.newPage();
    await other.goto("/en/account");
    await expect(mainNavigation(other, "en")).toBeVisible();
    await control(`revoke?email=${ACCOUNTS.receptionist}`);

    await mainNavigation(page, "en")
      .getByRole("link", { name: messages.en.shell.nav.queue })
      .click();

    await expect(page).toHaveURL(/\/en\/sign-in\?ended=1/);
    await expect(other).toHaveURL(/\/en\/sign-in/);
  });
});

test.describe("when the API is failing", () => {
  for (const status of [500, 503, -1]) {
    test(`stays signed in, with a retry, on ${String(status)}`, async ({
      page,
    }) => {
      await signIn(page, "doctor");
      await script("auth/me", status);

      await page.goto("/en/account");

      await expect(
        page.getByText(messages.en.auth.errors.unavailable),
      ).toBeVisible();
      expect(await hasSessionCookie(page)).toBe(true);
      await expect(page).toHaveURL(/\/en\/account$/);

      await script("auth/me", 0);
      await page
        .getByRole("button", { name: messages.en.shared.states.retry })
        .click();

      await expect(mainNavigation(page, "en")).toBeVisible();
    });
  }
});

test.describe("returning after a session ended", () => {
  test("goes back to the page, without its query", async ({ page }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/queue?search=Synthetic");
    await control(`revoke?email=${ACCOUNTS.receptionist}`);

    await page.goto("/en/queue?search=Synthetic");
    await expect(page).toHaveURL(/\/en\/sign-in\?ended=1&return=%2Fqueue$/);

    await fillSignIn(page, "en", ACCOUNTS.receptionist, PASSWORD);
    await expect(page).toHaveURL(/\/en\/queue$/);
  });

  test("doesn't go back to a page that writes an audit entry", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await control(`revoke?email=${ACCOUNTS.receptionist}`);

    await page.goto("/en/patients/5");
    await expect(page).toHaveURL(/\/en\/sign-in\?ended=1$/);

    await fillSignIn(page, "en", ACCOUNTS.receptionist, PASSWORD);
    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });
});
