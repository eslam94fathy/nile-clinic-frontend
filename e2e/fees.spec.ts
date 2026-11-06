import { expect, test } from "@playwright/test";
import { control, resetBackend, script, signIn } from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale].fees;
  const { shared } = messages[locale];

  test.describe(`fees, in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "administrator", locale);
    });

    test("says 'not set' rather than zero", async ({ page }) => {
      await page.goto(`/${locale}/fees`);

      const row = page.getByRole("row", { name: /Synthetic Doctor/ });
      await expect(row).toContainText(t.notSet);
      await expect(row).not.toContainText("0.00");

      await page.goto(`/${locale}/doctors/1`);
      await expect(page.getByText(t.noFeeTitle)).toBeVisible();
    });

    test("sets a fee, showing the note, amount, setter, and time", async ({
      page,
    }) => {
      await page.goto(`/${locale}/doctors/1`);
      await expect(page.getByText(t.chargesNote)).toBeVisible();
      await expect(
        page.getByRole("button", { name: t.set, exact: true }),
      ).toBeEnabled();

      await page.getByLabel(new RegExp(`^${t.amountLabel}`)).fill("350.10");
      await page.getByRole("button", { name: t.set, exact: true }).click();

      await expect(page.getByText(t.saved)).toBeVisible();
      const section = page.locator('[id^="doctor-fee-"]');
      await expect(section).toContainText("350.10");
      await expect(section).toContainText("Synthetic Admin");
      await expect(section.locator("time")).toBeVisible();
      await expect(
        page.getByRole("button", { name: t.change, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel(new RegExp(`^${t.amountLabel}`)),
      ).toHaveValue("");

      await page.goto(`/${locale}/fees`);
      const row = page.getByRole("row", { name: /Synthetic Doctor/ });
      await expect(row).toContainText("350.10");
      await expect(row).toContainText("Synthetic Admin");
    });

    test("accepts Arabic digits, and sends Western ones", async ({ page }) => {
      await page.goto(`/${locale}/doctors/1`);
      await expect(
        page.getByRole("button", { name: t.set, exact: true }),
      ).toBeEnabled();
      const sent = page.waitForRequest("**/api/backend/doctors/1/fee");

      await page.getByLabel(new RegExp(`^${t.amountLabel}`)).fill("٣٥٠.٧٥");
      await page.getByRole("button", { name: t.set, exact: true }).click();

      expect((await sent).postDataJSON()).toEqual({ amount: "350.75" });
      await expect(page.locator('[id^="doctor-fee-"]')).toContainText("350.75");
    });

    test("gives quick feedback, with no request", async ({ page }) => {
      await page.goto(`/${locale}/doctors/1`);
      await expect(
        page.getByRole("button", { name: t.set, exact: true }),
      ).toBeEnabled();
      let sent = 0;
      page.on("request", (request) => {
        if (request.url().includes("/api/backend/")) sent += 1;
      });

      await page.getByLabel(new RegExp(`^${t.amountLabel}`)).fill("0");
      await page.getByRole("button", { name: t.set, exact: true }).click();

      await expect(page.getByText(t.amountRule)).toBeVisible();
      expect(sent).toBe(0);
    });

    test("a row leads to the doctor", async ({ page }) => {
      await page.goto(`/${locale}/fees`);

      await page
        .getByRole("row", { name: /Synthetic Doctor/ })
        .getByRole("link")
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/doctors/1$`));
    });

    test("shows an error with a retry", async ({ page }) => {
      await script("fees", 500);
      await page.goto(`/${locale}/fees`);

      await expect(page.getByText("Scripted 500.")).toBeVisible();
      await expect(
        page.getByRole("button", { name: shared.states.retry }),
      ).toBeVisible();
    });

    test("shows an empty state", async ({ page }) => {
      await control("clinic/empty?what=doctors");
      await page.goto(`/${locale}/fees`);

      await expect(page.getByText(t.emptyTitle)).toBeVisible();
    });
  });
}

test("an amount the API refuses shows on the field", async ({ page }) => {
  const t = messages.en.fees;
  await signIn(page, "administrator");
  await page.goto("/en/doctors/1");
  await expect(
    page.getByRole("button", { name: t.set, exact: true }),
  ).toBeEnabled();
  await script("PUT doctors/1/fee", 500);

  await page.getByLabel(new RegExp(`^${t.amountLabel}`)).fill("350");
  await page.getByRole("button", { name: t.set, exact: true }).click();

  await expect(page.getByText("Scripted 500.")).toBeVisible();
  await expect(page.getByLabel(new RegExp(`^${t.amountLabel}`))).toHaveValue(
    "350",
  );
});

test("an amount is displayed exactly as the API returned it", async ({
  page,
}) => {
  await control("clinic/setup?doctor=1&fee=99999.99");
  await signIn(page, "administrator");
  await page.goto("/en/fees");

  await expect(
    page.getByRole("row", { name: /Synthetic Doctor/ }),
  ).toContainText("99,999.99");
});
