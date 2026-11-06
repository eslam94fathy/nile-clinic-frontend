import { expect, test } from "@playwright/test";
import { messages } from "./support/messages";

for (const locale of ["ar", "en"] as const) {
  test.describe(`logo in /${locale}`, () => {
    test("links to the home page, from any page", async ({ page }) => {
      await page.goto(`/${locale}/missing`);

      await page
        .getByRole("banner")
        .getByRole("link", { name: messages[locale].brand.name })
        .click();

      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        messages[locale].landing.heading,
      );
    });

    test("keeps its text clear of the mark and inside the image", async ({
      page,
    }) => {
      await page.goto(`/${locale}`);

      const logo = page.getByRole("banner").getByRole("img");
      const box = await logo.boundingBox();
      const mark = await logo.locator("path").first().boundingBox();
      const texts = await logo
        .locator("text")
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().toJSON()),
        );

      expect(box && mark).toBeTruthy();
      expect(texts).toHaveLength(2);
      for (const text of texts) {
        expect(text.left).toBeGreaterThanOrEqual(box!.x - 1);
        expect(text.right).toBeLessThanOrEqual(box!.x + box!.width + 1);
        if (locale === "ar") expect(text.right).toBeLessThan(mark!.x);
        else expect(text.left).toBeGreaterThan(mark!.x + mark!.width);
      }
    });

    test("doesn't make the page scroll sideways on a small screen", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(`/${locale}`);

      const widths = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        view: document.documentElement.clientWidth,
      }));
      expect(widths.content).toBeLessThanOrEqual(widths.view);
    });
  });
}

test.describe("icons", () => {
  test("the page declares each one, and each one is served", async ({
    page,
    request,
  }) => {
    await page.goto("/ar");

    for (const [selector, type] of [
      ['link[rel="icon"][href*="favicon.ico"]', "image/x-icon"],
      ['link[rel="icon"][type="image/svg+xml"]', "image/svg+xml"],
      ['link[rel="apple-touch-icon"]', "image/png"],
    ] as const) {
      const href = await page.locator(selector).getAttribute("href");
      const response = await request.get(href ?? "");

      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain(type);
    }
  });
});

test("the logo asks no other site for anything", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname !== "localhost") {
      outside.push(new URL(request.url()).hostname);
    }
  });

  await page.goto("/ar");
  await expect(page.getByRole("banner").getByRole("img")).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(outside).toEqual([]);
});
