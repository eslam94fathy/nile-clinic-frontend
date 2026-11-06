import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  fillSignIn,
  type Locale,
  mainNavigation,
  PASSWORD,
  resetBackend,
  script,
  signIn,
} from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const REFUSED: Record<Locale, string> = {
  en: "These credentials do not match our records.",
  ar: "بيانات الدخول هذه غير صحيحة.",
};

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";

  test.describe(`signing in, in ${locale}`, () => {
    for (const role of ["administrator", "receptionist", "doctor"] as const) {
      test(`reaches the landing page as a ${role}`, async ({ page }) => {
        await signIn(page, role, locale);

        await expect(page.locator("html")).toHaveAttribute("dir", dir);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          "Synthetic",
        );
        await expect(page.getByRole("main")).toContainText(t.roles[role]);
      });
    }

    for (const [label, email, password] of [
      ["a wrong password", ACCOUNTS.doctor, "wrong-password-123"],
      ["an unknown email", "nobody@example.test", PASSWORD],
    ] as const) {
      test(`shows the API's refusal for ${label}`, async ({ page }) => {
        await page.goto(`/${locale}/sign-in`);
        await fillSignIn(page, locale, email, password);

        await expect(page.getByText(REFUSED[locale])).toBeVisible();
        await expect(page.getByLabel(t.auth.signIn.email)).toHaveAttribute(
          "aria-invalid",
          "true",
        );
        await expect(page).toHaveURL(new RegExp(`/${locale}/sign-in`));
      });
    }

    test("asks for both fields", async ({ page }) => {
      await page.goto(`/${locale}/sign-in`);
      await page
        .getByRole("button", { name: t.auth.signIn.submit, exact: true })
        .click();

      await expect(page.getByText(t.auth.signIn.emailRequired)).toBeVisible();
      await expect(
        page.getByText(t.auth.signIn.passwordRequired),
      ).toBeVisible();
    });

    test("points forgotten passwords to an administrator", async ({ page }) => {
      await page.goto(`/${locale}/sign-in`);

      await expect(page.getByText(t.auth.signIn.forgotPassword)).toBeVisible();
    });

    test("doesn't suggest a wrong password when the API fails", async ({
      page,
    }) => {
      await script("auth/sign-in", 500);
      await page.goto(`/${locale}/sign-in`);
      await fillSignIn(page, locale, ACCOUNTS.doctor, PASSWORD);

      await expect(page.getByText(t.auth.errors.general)).toBeVisible();
      await expect(page.getByText(REFUSED[locale])).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`/${locale}/sign-in`));
    });

    test("can be done by keyboard alone", async ({ page }) => {
      await page.goto(`/${locale}/sign-in`);

      await expect(
        page.getByRole("button", { name: t.auth.signIn.submit, exact: true }),
      ).toBeEnabled();
      await page.getByLabel(t.auth.signIn.email).focus();
      await page.keyboard.type(ACCOUNTS.doctor);
      await page.keyboard.press("Tab");
      await expect(page.getByLabel(t.auth.signIn.password)).toBeFocused();
      await page.keyboard.type(PASSWORD);
      await page.keyboard.press("Enter");

      await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
    });

    test("an already signed-in person goes to the landing page", async ({
      page,
    }) => {
      await signIn(page, "doctor", locale);

      await page.goto(`/${locale}/sign-in`);

      await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`));
      await expect(mainNavigation(page, locale)).toBeVisible();
    });
  });
}

test("shows the throttle message as sent, with no countdown", async ({
  page,
}) => {
  await page.goto("/en/sign-in");
  await fillSignIn(page, "en", "throttled@example.test", PASSWORD);

  await expect(
    page.getByText("Too many attempts. Try again in 47 seconds."),
  ).toBeVisible();
});

test("a deactivated-style refusal looks the same as a wrong password", async ({
  page,
}) => {
  // All three reasons reach the browser as one message, so nothing shows which applied.
  await page.goto("/en/sign-in");
  await fillSignIn(page, "en", ACCOUNTS.doctor, "wrong-password-123");
  const first = await page.getByRole("alert").first().textContent();

  await fillSignIn(page, "en", "nobody@example.test", PASSWORD);
  await expect(page.getByRole("alert").first()).toHaveText(first ?? "");
});

test("sends one attempt, and shows progress, while pending", async ({
  page,
}) => {
  const attempts: string[] = [];
  await page.route("**/api/auth/sign-in", async (route) => {
    attempts.push(route.request().url());
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  const t = messages.en.auth.signIn;

  await page.goto("/en/sign-in");
  await page.getByLabel(t.email).fill(ACCOUNTS.doctor);
  await page.getByLabel(t.password).fill(PASSWORD);
  await page.getByLabel(t.password).press("Enter");

  const working = page.getByRole("button", { name: t.working });
  await expect(working).toBeDisabled();
  await page.getByLabel(t.password).press("Enter");

  await expect(page).toHaveURL(/\/en\/dashboard$/);
  expect(attempts).toHaveLength(1);
});

test("language and theme can be changed before signing in", async ({
  page,
}) => {
  await page.goto("/ar/sign-in");

  await page.getByRole("link", { name: messages.ar.language.switch }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    messages.en.auth.signIn.heading,
  );

  await page
    .getByRole("group", { name: messages.en.shared.theme.label })
    .getByRole("button", { name: messages.en.shared.theme.dark })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("a return address leads back, and a foreign one doesn't", async ({
  page,
}) => {
  await page.goto(`/en/sign-in?return=${encodeURIComponent("/queue")}`);
  await fillSignIn(page, "en", ACCOUNTS.receptionist, PASSWORD);
  await expect(page).toHaveURL(/\/en\/queue$/);

  await page.context().clearCookies();
  await page.goto(
    `/en/sign-in?return=${encodeURIComponent("https://evil.test/x")}`,
  );
  await fillSignIn(page, "en", ACCOUNTS.receptionist, PASSWORD);
  await expect(page).toHaveURL(/\/en\/dashboard$/);
});

test("a signed-in address with no session goes to sign-in, in its language", async ({
  page,
}) => {
  await page.goto("/ar/queue");

  await expect(page).toHaveURL(/\/ar\/sign-in\?return=%2Fqueue$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    messages.ar.auth.signIn.heading,
  );
});
