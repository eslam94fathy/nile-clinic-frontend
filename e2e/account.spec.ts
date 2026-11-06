import { expect, type Page, test } from "@playwright/test";
import {
  ACCOUNTS,
  fillSignIn,
  type Locale,
  PASSWORD,
  resetBackend,
  script,
  signIn,
  signOutButton,
} from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const NEW_PASSWORD = "synthetic-password-2";

async function fillPassword(
  page: Page,
  locale: Locale,
  current: string,
  next: string,
  again = next,
) {
  const t = messages[locale].auth.account;
  await page.getByLabel(new RegExp(`^${t.currentPassword}`)).fill(current);
  await page.getByLabel(new RegExp(`^${t.newPassword}`)).fill(next);
  await page.getByLabel(new RegExp(`^${t.confirmPassword}`)).fill(again);
  await page.getByRole("button", { name: t.submit }).click();
}

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale];

  test.describe(`the account page, in ${locale}`, () => {
    test("shows the person's own details", async ({ page }) => {
      await signIn(page, "receptionist", locale);
      await page
        .getByRole("banner")
        .getByRole("link", { name: t.shell.account })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/account$`));

      const main = page.getByRole("main");
      await expect(main).toContainText("Synthetic Reception");
      await expect(main).toContainText(ACCOUNTS.receptionist);
      await expect(main).toContainText(t.roles.receptionist);
    });

    test("changes the password, and stays signed in", async ({ page }) => {
      await signIn(page, "doctor", locale);
      await page.goto(`/${locale}/account`);

      await fillPassword(page, locale, PASSWORD, NEW_PASSWORD);

      await expect(page.getByRole("status")).toContainText(
        t.auth.account.success,
      );
      await expect(
        page.getByLabel(new RegExp(`^${t.auth.account.newPassword}`)),
      ).toHaveValue("");

      await page.reload();
      await expect(
        page.getByRole("heading", { name: t.auth.account.title }),
      ).toBeVisible();
    });

    test("shows a wrong current password on its field", async ({ page }) => {
      await signIn(page, "doctor", locale);
      await page.goto(`/${locale}/account`);

      await fillPassword(page, locale, "wrong-password-12", NEW_PASSWORD);

      const field = page.getByLabel(
        new RegExp(`^${t.auth.account.currentPassword}`),
      );
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByRole("status")).toHaveCount(0);
    });

    test("gives quick feedback, with no request", async ({ page }) => {
      await signIn(page, "doctor", locale);
      await page.goto(`/${locale}/account`);
      let sent = 0;
      page.on("request", (request) => {
        if (request.url().includes("/api/backend/")) sent += 1;
      });

      await fillPassword(page, locale, PASSWORD, "short");
      await expect(page.getByText(t.auth.account.lengthRule)).toBeVisible();

      await fillPassword(page, locale, PASSWORD, NEW_PASSWORD, "different");
      await expect(page.getByText(t.auth.account.mismatch)).toBeVisible();

      expect(sent).toBe(0);
    });

    test("can be used by keyboard alone", async ({ page }) => {
      await signIn(page, "doctor", locale);
      await page.goto(`/${locale}/account`);

      await expect(
        page.getByRole("button", { name: t.auth.account.submit }),
      ).toBeEnabled();
      await page
        .getByLabel(new RegExp(`^${t.auth.account.currentPassword}`))
        .focus();
      await page.keyboard.type(PASSWORD);
      await page.keyboard.press("Tab");
      await page.keyboard.type(NEW_PASSWORD);
      await page.keyboard.press("Tab");
      await page.keyboard.type(NEW_PASSWORD);
      await page.keyboard.press("Enter");

      await expect(page.getByRole("status")).toContainText(
        t.auth.account.success,
      );
    });
  });
}

test("the new password works, the old one doesn't, and other sessions end", async ({
  browser,
  page,
}) => {
  await signIn(page, "doctor");
  const other = await (await browser.newContext()).newPage();
  await signIn(other, "doctor");

  await page.goto("/en/account");
  await fillPassword(page, "en", PASSWORD, NEW_PASSWORD);
  await expect(page.getByRole("status")).toBeVisible();

  await other.goto("/en/dashboard");
  await expect(other).toHaveURL(/\/en\/sign-in\?ended=1/);

  await fillSignIn(other, "en", ACCOUNTS.doctor, PASSWORD);
  await expect(other.getByRole("alert").first()).toBeVisible();
  await expect(other).toHaveURL(/sign-in/);

  await fillSignIn(other, "en", ACCOUNTS.doctor, NEW_PASSWORD);
  await expect(other).toHaveURL(/\/en\/dashboard$/);

  await signOutButton(other, "en").click();
  await expect(other).toHaveURL(/\/en\/sign-in$/);
});

test("an API error with no field shows at form level", async ({ page }) => {
  await signIn(page, "doctor");
  await page.goto("/en/account");
  await script("auth/password", 500);

  await fillPassword(page, "en", PASSWORD, NEW_PASSWORD);

  await expect(page.getByText("Scripted 500.")).toBeVisible();
});

test("every role has the page", async ({ page }) => {
  await signIn(page, "administrator");
  await page.goto("/en/account");
  await expect(
    page.getByRole("heading", { name: messages.en.auth.account.title }),
  ).toBeVisible();
});

test("a doctor with no profile can still use it", async ({ page }) => {
  await signIn(page, "newDoctor");
  await page.goto("/en/account");

  await expect(
    page.getByRole("heading", { name: messages.en.auth.account.title }),
  ).toBeVisible();
});
