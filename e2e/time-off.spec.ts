import { expect, test } from "@playwright/test";
import { control, resetBackend, signIn } from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const inDays = (count: number) => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
  }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + count * 86_400_000)
    .toISOString()
    .slice(0, 10);
};

const escaped = (text: string) => text.replace(/[()]/g, "\\$&");

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale].scheduling;
  const { shared } = messages[locale];

  test.describe(`time off, in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "administrator", locale);
    });

    test("records whole days, showing the hint about the reason", async ({
      page,
    }) => {
      await page.goto(`/${locale}/doctors/1`);
      await expect(page.getByText(t.timeOffEmptyTitle)).toBeVisible();
      await expect(page.getByText(shared.form.noMedicalDetails)).toBeVisible();
      await expect(page.getByText(t.reasonHint)).toBeVisible();
      await expect(page.getByRole("button", { name: t.add })).toBeEnabled();

      await page.getByLabel(new RegExp(`^${t.startDate}`)).fill(inDays(3));
      await page.getByLabel(new RegExp(`^${t.endDate}`)).fill(inDays(5));
      await page
        .getByLabel(new RegExp(`^${escaped(t.reasonLabel)}`))
        .fill("Synthetic conference");
      await page.getByRole("button", { name: t.add }).click();

      await expect(page.getByText(t.added)).toBeVisible();
      const row = page.getByRole("row", { name: /Synthetic conference/ });
      await expect(row).toContainText(inDays(3));
      await expect(row).toContainText(inDays(5));
      await expect(row).toContainText(t.wholeDays);
    });

    test("records part of one day", async ({ page }) => {
      await page.goto(`/${locale}/doctors/1`);
      await expect(page.getByRole("button", { name: t.add })).toBeEnabled();

      await page.getByLabel(t.kind).selectOption("part");
      await page.getByLabel(new RegExp(`^${t.startDate}`)).fill(inDays(3));
      await page.getByLabel(new RegExp(`^${t.startTime}`)).fill("10:00");
      await page.getByLabel(new RegExp(`^${t.endTime}`)).fill("12:00");
      await page.getByRole("button", { name: t.add }).click();

      await expect(page.getByText(t.added)).toBeVisible();
      const row = page.getByRole("row", { name: /10:00/ });
      await expect(row).toContainText("12:00");
    });

    test("removing returns the slots", async ({ page }) => {
      await control("clinic/setup?doctor=1&schedule=1");
      await control(
        `clinic/time-off?doctor=1&start=${inDays(0)}&end=${inDays(40)}&reason=Synthetic+away`,
      );
      await page.goto(`/${locale}/doctors/1`);
      await expect(page.getByText(t.slotsEmptyTitle)).toBeVisible();

      await page
        .getByRole("row", { name: /Synthetic away/ })
        .getByRole("button", { name: t.remove })
        .click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText(t.removeDescription);
      await dialog.getByRole("button", { name: t.remove }).click();

      await expect(page.getByText(t.removed)).toBeVisible();
      await expect(page.getByText(t.slotsEmptyTitle)).toHaveCount(0);
      await expect(page.getByText(t.timeOffEmptyTitle)).toBeVisible();
    });
  });
}

test.describe("ranges and refusals", () => {
  const t = messages.en.scheduling;

  test.beforeEach(async ({ page }) => {
    await signIn(page, "administrator");
  });

  test("a date in the past shows the API's refusal on its field", async ({
    page,
  }) => {
    await page.goto("/en/doctors/1");
    await expect(page.getByRole("button", { name: t.add })).toBeEnabled();

    await page.getByLabel(new RegExp(`^${t.startDate}`)).fill(inDays(-3));
    await page.getByLabel(new RegExp(`^${t.endDate}`)).fill(inDays(-1));
    await page.getByRole("button", { name: t.add }).click();

    await expect(
      page.getByLabel(new RegExp(`^${t.startDate}`)),
    ).toHaveAttribute("aria-invalid", "true");
  });

  test("another range goes in the address, and survives a reload", async ({
    page,
  }) => {
    await control(
      `clinic/time-off?doctor=1&start=${inDays(-30)}&end=${inDays(-29)}&reason=Synthetic+past`,
    );
    await page.goto("/en/doctors/1");
    await expect(page.getByRole("row", { name: /Synthetic past/ })).toHaveCount(
      0,
    );

    await page.getByLabel(t.rangeFrom).fill(inDays(-40));
    await page.getByLabel(t.rangeTo).fill(inDays(-1));
    await page
      .getByRole("button", { name: messages.en.shared.filters.apply })
      .click();

    await expect(page).toHaveURL(/from=/);
    const row = page.getByRole("row", { name: /Synthetic past/ });
    await expect(row).toBeVisible();
    await page.reload();
    await expect(row).toBeVisible();
  });

  test("a range with only an end looks back from it", async ({ page }) => {
    await control(
      `clinic/time-off?doctor=1&start=${inDays(-30)}&end=${inDays(-29)}&reason=Synthetic+past`,
    );
    await page.goto(`/en/doctors/1?to=${inDays(-1)}`);

    await expect(
      page.getByRole("row", { name: /Synthetic past/ }),
    ).toBeVisible();
  });

  test("offers no removal once the end date has passed", async ({ page }) => {
    await control(
      `clinic/time-off?doctor=1&start=${inDays(-30)}&end=${inDays(-29)}&reason=Synthetic+past`,
    );
    await page.goto(`/en/doctors/1?from=${inDays(-40)}&to=${inDays(-1)}`);

    await expect(
      page
        .getByRole("row", { name: /Synthetic past/ })
        .getByRole("button", { name: t.remove }),
    ).toHaveCount(0);
  });

  test("a range too long shows the API's refusal, and the rest of the page", async ({
    page,
  }) => {
    await page.goto(`/en/doctors/1?from=${inDays(0)}&to=${inDays(400)}`);

    await expect(
      page.getByText("The range can be at most 366 days."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: t.hoursHeading }),
    ).toBeVisible();
  });

  test("an entry that has already ended shows the refusal in the dialog", async ({
    page,
  }) => {
    await control(
      `clinic/time-off?doctor=1&start=${inDays(0)}&end=${inDays(0)}&start_time=00:00&end_time=00:05&reason=Synthetic+earlier`,
    );
    await page.goto("/en/doctors/1");

    await page
      .getByRole("row", { name: /Synthetic earlier/ })
      .getByRole("button", { name: t.remove })
      .click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: t.remove }).click();

    await expect(dialog).toContainText("This time off has already ended.");
  });
});
