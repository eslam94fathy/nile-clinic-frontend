import { expect, type Page, test } from "@playwright/test";
import { control, resetBackend, signIn } from "./support/auth";
import { messages } from "./support/messages";

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
  "patients",
  "patients/new",
  "patients/4",
];

const sidewaysScroll = (page: Page) =>
  page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

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

        expect(
          await sidewaysScroll(page),
          `/${locale}/${path}`,
        ).toBeLessThanOrEqual(0);
      }
    });

    test(`patient results, warning, and editing fit at ${width}px, in ${locale}`, async ({
      page,
    }) => {
      const p = messages[locale].patients;
      const field = (label: string) =>
        page.getByLabel(new RegExp(`^${label}`, "u")).locator("visible=true");
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, "receptionist", locale);

      await page.goto(`/${locale}/patients`);
      await page
        .getByRole("textbox", { name: p.fields.fullName, exact: true })
        .fill("Synthetic-Long");
      await page.getByRole("button", { name: p.search.button }).click();
      await expect(
        page.getByRole("link", { name: /Synthetic-Long/u }).first(),
      ).toBeVisible();
      expect(await sidewaysScroll(page), "results").toBeLessThanOrEqual(0);

      await page.goto(`/${locale}/patients/new`);
      const submit = page.getByRole("button", {
        name: p.registerForm.submit,
        exact: true,
      });
      await expect(submit).toBeEnabled();
      await field(p.fields.fullName).fill("Synthetic Narrow");
      await field(p.fields.dateOfBirth).fill("1990-04-12");
      await field(p.fields.sex).selectOption("female");
      await field(p.fields.phone).fill("01000000002");
      await submit.click();
      await expect(page.getByText(p.registerForm.matchesTitle)).toBeVisible();
      expect(await sidewaysScroll(page), "warning").toBeLessThanOrEqual(0);

      await page.goto(`/${locale}/patients/4`);
      await page.getByRole("button", { name: p.record.edit }).click();
      await expect(field(p.fields.fullName)).toBeVisible();
      expect(await sidewaysScroll(page), "editing").toBeLessThanOrEqual(0);
    });
  }
}
