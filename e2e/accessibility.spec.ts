import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { resetBackend, script, signIn } from "./support/auth";
import { messages } from "./support/messages";
import { backendControlUrl } from "./support/ports";

async function seriousIssues(page: Page) {
  // A form's submit fades in once hydrated. Measured mid-fade, its contrast reads lower than it is.
  for (const submit of await page.locator('button[type="submit"]').all()) {
    await expect(submit).toHaveCSS("opacity", "1");
  }

  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.html).join(", ")}`);
}

async function setMode(mode: string) {
  await fetch(`${backendControlUrl}/mode/${mode}`);
}

test.afterEach(async () => {
  await setMode("ok");
});

for (const locale of ["ar", "en"] as const) {
  const status = messages[locale].status;

  for (const [mode, text] of [
    ["ok", status.working],
    ["unavailable", status.unavailable],
    ["destroy", status.unreachable],
  ] as const) {
    test(`sign-in page in ${locale}, ${mode}`, async ({ page }) => {
      await setMode(mode);
      await page.goto(`/${locale}/sign-in`);
      await expect(page.getByRole("status")).toContainText(text);

      expect(await seriousIssues(page)).toEqual([]);
    });
  }

  test(`checking state in ${locale}`, async ({ page }) => {
    await setMode("slow");
    await page.goto(`/${locale}/sign-in`, { waitUntil: "commit" });
    await expect(page.getByRole("status")).toContainText(status.checking);

    expect(await seriousIssues(page)).toEqual([]);
  });

  test(`not-found page in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/missing`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages[locale].notFound.heading,
    );

    expect(await seriousIssues(page)).toEqual([]);
  });
}

for (const locale of ["ar", "en"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`signed-in screens in ${locale}, ${theme}`, () => {
      test.use({ colorScheme: theme });
      test.beforeEach(resetBackend);

      const t = messages[locale];

      test("landing page", async ({ page }) => {
        await signIn(page, "receptionist", locale);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("account page, with errors showing", async ({ page }) => {
        await signIn(page, "doctor", locale);
        await page.goto(`/${locale}/account`);
        await page.getByRole("button", { name: t.auth.account.submit }).click();
        await expect(
          page.getByText(t.auth.account.currentRequired),
        ).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("not allowed", async ({ page }) => {
        await signIn(page, "doctor", locale);
        await page.goto(`/${locale}/staff`);
        await expect(
          page.getByText(t.shared.states.forbiddenHeading),
        ).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("not found, in the frame", async ({ page }) => {
        await signIn(page, "doctor", locale);
        await page.goto(`/${locale}/nowhere`);
        await expect(
          page.getByText(t.shared.states.notFoundHeading),
        ).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("placeholder", async ({ page }) => {
        await signIn(page, "administrator", locale);
        await page.goto(`/${locale}/reports`);
        await expect(page.getByText(t.shell.placeholderHeading)).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("no doctor profile", async ({ page }) => {
        await signIn(page, "newDoctor", locale);
        await expect(page.getByText(t.auth.noProfile.heading)).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("API failing", async ({ page }) => {
        await signIn(page, "doctor", locale);
        await script("auth/me", 500);
        await page.reload();
        await expect(page.getByText(t.auth.errors.unavailable)).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("sign-in, with a refusal and the session-ended message", async ({
        page,
      }) => {
        await page.goto(`/${locale}/sign-in?ended=1`);
        await expect(page.getByText(t.auth.signIn.sessionEnded)).toBeVisible();
        await page
          .getByRole("button", { name: t.auth.signIn.submit, exact: true })
          .click();
        await expect(page.getByText(t.auth.signIn.emailRequired)).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });
    });
  }
}
