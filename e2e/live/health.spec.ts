import { expect, test } from "@playwright/test";
import { messages } from "../support/messages";

// Runs against the real backend, using `.env.local`.
for (const locale of ["ar", "en"] as const) {
  test(`reports the real backend as working, in ${locale}`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/sign-in`);

    const region = page.getByRole("status");
    await expect(region).toContainText(messages[locale].status.working);

    const expectedDate = new Intl.DateTimeFormat(locale, {
      timeZone: "Africa/Cairo",
      dateStyle: "medium",
    }).format(new Date());
    await expect(region).toContainText(expectedDate);
  });
}
