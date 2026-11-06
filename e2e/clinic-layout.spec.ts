import { expect, test } from "@playwright/test";
import { control, resetBackend, signIn } from "./support/auth";

test.beforeEach(resetBackend);

const PAGES = [
  "staff",
  "staff/new",
  "staff/2",
  "staff/3",
  "specialties",
  "doctors",
  "doctors/new",
  "doctors/1",
  "doctors/1/edit",
  "doctors/1/schedule",
  "fees",
];

// A tablet, then a narrow window. Reception and back office are desktop first, down to tablet.
for (const width of [768, 390]) {
  for (const locale of ["ar", "en"] as const) {
    test(`nothing scrolls sideways at ${width}px, in ${locale}`, async ({
      page,
    }) => {
      await control("clinic/setup?doctor=1&schedule=1&fee=350.10");
      await control(
        "clinic/time-off?doctor=1&start=2030-01-10&end=2030-01-12&reason=Synthetic",
      );
      await control(
        `account?email=${encodeURIComponent("synthetic.doctor@example.test")}&name=${encodeURIComponent(`Synthetic ${"Longname".repeat(12)}`)}`,
      );
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, "administrator", locale);

      for (const path of PAGES) {
        await page.goto(`/${locale}/${path}`);
        await expect(page.getByRole("main")).toBeVisible();
        // Sections stream in. Measuring before they arrive would pass whatever they hold.
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("main").locator("h1")).toBeVisible();

        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          return root.scrollWidth - root.clientWidth;
        });
        expect(overflow, `/${locale}/${path}`).toBeLessThanOrEqual(0);
      }
    });
  }
}
