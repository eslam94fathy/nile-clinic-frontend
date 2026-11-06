import { expect, type Page, test } from "@playwright/test";
import { messages } from "./support/messages";

// 22:30 UTC on Nov 5 is 00:30 on Nov 6 in Cairo, so the wrong zone shows a different day and hour.
const instant = {
  en: /Nov 6, 2026.*12:30/,
  ar: /(06|6).*11.*2026.*12:30/,
};

function failOnConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

for (const timezoneId of ["America/Los_Angeles", "UTC", "Asia/Tokyo"]) {
  test.describe(`with the browser in ${timezoneId}`, () => {
    test.use({ timezoneId });

    for (const locale of ["ar", "en"] as const) {
      test(`values in ${locale} ignore the browser's zone`, async ({
        page,
      }) => {
        const errors = failOnConsoleErrors(page);
        await page.goto(`/${locale}/design-preview`);

        const inBrowser = page.getByRole("region", {
          name: messages[locale].preview.values.browserHeading,
        });
        await expect(inBrowser).toContainText("150.00");
        await expect(inBrowser).toContainText("2026-11-08");
        await expect(inBrowser).toContainText("09:20");
        await expect(inBrowser.locator("time").last()).toHaveText(
          instant[locale],
        );
        await page.waitForLoadState("networkidle");
        expect(errors).toEqual([]);
      });
    }
  });
}

test("a very large amount keeps every digit", async ({ page }) => {
  await page.goto("/en/design-preview");
  await expect(page.getByText("12,345,678,901,234,567.89")).toBeVisible();
});

test("the end of the day is shown as sent", async ({ page }) => {
  await page.goto("/en/design-preview");
  await expect(page.getByText("24:00", { exact: true })).toBeVisible();
});

test("both spellings of a moment look the same", async ({ page }) => {
  await page.goto("/en/design-preview");
  const labels = messages.en.preview.values;
  const value = (label: string) =>
    page.locator(`dt:text-is("${label}") + dd`).textContent();

  expect(await value(labels.instantLong)).toBe(
    await value(labels.instantOffset),
  );
});

test.describe("inside an Arabic sentence", () => {
  test("values keep their order", async ({ page }) => {
    await page.goto("/ar/design-preview");
    const sentence = page.getByTestId("value-sentence");

    await expect(sentence).toContainText("2026-11-08");
    await expect(sentence).toContainText("09:20");
    await expect(sentence).toContainText("+201000000017");
    await expect(sentence).toContainText("150.00");
    // Isolated, so these can't reorder the words around them.
    expect(await sentence.locator("bdi").count()).toBe(4);
    await expect(sentence.locator('bdi[dir="ltr"]')).toHaveCount(3);
    // Western digits, as ADR 0008 decides.
    expect(await sentence.textContent()).not.toMatch(/[٠-٩]/);
  });
});
