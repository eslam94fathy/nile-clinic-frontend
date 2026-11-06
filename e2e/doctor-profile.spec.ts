import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  callsTo,
  control,
  mainNavigation,
  resetBackend,
  script,
  signIn,
  signOutButton,
} from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale];

  test.describe(`a doctor with no profile, in ${locale}`, () => {
    test("sees the state on the landing page and doctor screens", async ({
      page,
    }) => {
      await signIn(page, "newDoctor", locale);
      await expect(page.getByText(t.auth.noProfile.heading)).toBeVisible();

      await mainNavigation(page, locale)
        .getByRole("link", { name: t.shell.nav.myQueue })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/my/queue$`));
      // The landing page stays mounted but hidden, so only what's visible counts (ADR 0006).
      await expect(
        page.getByText(t.auth.noProfile.heading).filter({ visible: true }),
      ).toHaveCount(1);
      await expect(page.getByText(t.shell.placeholderHeading)).toHaveCount(0);
    });

    test("can still use the account page, language, and sign-out", async ({
      page,
    }) => {
      await signIn(page, "newDoctor", locale);

      await page
        .getByRole("banner")
        .getByRole("link", { name: t.shell.account })
        .click();
      await expect(
        page.getByRole("heading", { name: t.auth.account.title }),
      ).toBeVisible();

      await page.getByRole("link", { name: t.language.switch }).click();
      const otherLocale = locale === "ar" ? "en" : "ar";
      await expect(page).toHaveURL(new RegExp(`/${otherLocale}/account$`));

      await signOutButton(page, otherLocale).click();
      await expect(page).toHaveURL(new RegExp(`/${otherLocale}/sign-in$`));
    });
  });
}

test("the state goes once the profile exists", async ({ page }) => {
  await signIn(page, "newDoctor");
  await expect(
    page.getByText(messages.en.auth.noProfile.heading),
  ).toBeVisible();

  await control(`account?email=${ACCOUNTS.newDoctor}&profile=true`);
  await page.reload();

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(messages.en.auth.noProfile.heading)).toHaveCount(
    0,
  );
});

test("a failing check shows a retry, not the state", async ({ page }) => {
  await signIn(page, "doctor");
  await script("doctors/me", 500);

  await page.reload();

  await expect(
    page.getByText(messages.en.auth.errors.unavailable),
  ).toBeVisible();
  await expect(page.getByText(messages.en.auth.noProfile.heading)).toHaveCount(
    0,
  );

  await script("doctors/me", 0);
  await page
    .getByRole("button", { name: messages.en.shared.states.retry })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("the API's 403 wins over the role map", async ({ page }) => {
  await signIn(page, "doctor");
  await script("doctors/me", 403);

  await page.reload();

  await expect(
    page.getByText(messages.en.shared.states.forbiddenHeading),
  ).toBeVisible();
});

test("a doctor with a profile doesn't see the state", async ({ page }) => {
  await signIn(page, "doctor");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Synthetic Doctor",
  );
  await expect(page.getByText(messages.en.auth.noProfile.heading)).toHaveCount(
    0,
  );
});

for (const role of ["administrator", "receptionist"] as const) {
  test(`a ${role} never makes the call`, async ({ page }) => {
    await signIn(page, role);
    await page.goto("/en/account");
    await page.goto("/en/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(await callsTo("doctors/me")).toBe(0);
  });
}
