import { expect, test } from "@playwright/test";
import { control, resetBackend, script, signIn } from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale].specialties;
  const { shared } = messages[locale];

  test.describe(`specialties, in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "administrator", locale);
    });

    test("lists both names and each status", async ({ page }) => {
      await page.goto(`/${locale}/specialties`);

      const main = page.getByRole("main");
      await expect(
        main.getByRole("heading", { level: 1, name: t.title }),
      ).toBeVisible();
      const row = main.getByRole("row", { name: /Synthetic Cardiology/ });
      await expect(row).toContainText("قلب تجريبي");
      await expect(row).toContainText(shared.status.activity.active);
      await expect(
        main.getByRole("row", { name: /Synthetic Retired/ }),
      ).toContainText(shared.status.activity.deactivated);
    });

    test("adds one, and shows it without a reload", async ({ page }) => {
      await page.goto(`/${locale}/specialties`);

      await page.getByLabel(new RegExp(`^${t.nameEn}`)).fill("Synthetic Added");
      await page.getByLabel(new RegExp(`^${t.nameAr}`)).fill("مضاف تجريبي");
      await page.getByRole("button", { name: t.add, exact: true }).click();

      await expect(page.getByText(t.added)).toBeVisible();
      await expect(
        page.getByRole("row", { name: /Synthetic Added/ }),
      ).toBeVisible();
    });

    test("shows a duplicate name's refusal on that field", async ({ page }) => {
      await page.goto(`/${locale}/specialties`);

      await page
        .getByLabel(new RegExp(`^${t.nameEn}`))
        .fill("Synthetic Cardiology");
      await page.getByLabel(new RegExp(`^${t.nameAr}`)).fill("اسم جديد");
      await page.getByRole("button", { name: t.add, exact: true }).click();

      await expect(page.getByLabel(new RegExp(`^${t.nameEn}`))).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });

    test("renames, returning focus to the row", async ({ page }) => {
      await page.goto(`/${locale}/specialties`);
      const row = page.getByRole("row", { name: /Synthetic Dermatology/ });

      await row.getByRole("button", { name: t.rename }).click();
      const name = page.getByLabel(new RegExp(`^${t.nameEn}`)).first();
      await expect(name).toBeFocused();
      await name.fill("Synthetic Renamed");
      await page.getByRole("button", { name: t.save, exact: true }).click();

      await expect(page.getByText(t.renamed)).toBeVisible();
      const renamed = page.getByRole("row", { name: /Synthetic Renamed/ });
      await expect(renamed).toBeVisible();
      await expect(
        renamed.getByRole("button", { name: t.rename }),
      ).toBeFocused();
    });

    test("deactivates after explaining the effect, then reactivates", async ({
      page,
    }) => {
      await page.goto(`/${locale}/specialties`);
      const row = page.getByRole("row", { name: /Synthetic Dermatology/ });

      await row.getByRole("button", { name: t.deactivate }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText(t.deactivateDescription);
      await dialog.getByRole("button", { name: t.deactivate }).click();

      await expect(page.getByText(t.deactivated, { exact: true })).toBeVisible();
      await expect(row).toContainText(shared.status.activity.deactivated);

      await row.getByRole("button", { name: t.reactivate }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: t.reactivate })
        .click();
      await expect(page.getByText(t.reactivated, { exact: true })).toBeVisible();
      await expect(row).toContainText(shared.status.activity.active);
    });

    test("offers no delete", async ({ page }) => {
      await page.goto(`/${locale}/specialties`);
      await expect(page.getByRole("row", { name: /Cardiology/ })).toBeVisible();
      await expect(
        page.getByRole("main").getByRole("button", { name: /delete|حذف/i }),
      ).toHaveCount(0);
    });

    test("shows an empty state that offers the form", async ({ page }) => {
      await control("clinic/empty?what=specialties");
      await page.goto(`/${locale}/specialties`);

      await expect(page.getByText(t.emptyTitle)).toBeVisible();
      await expect(
        page.getByRole("button", { name: t.add, exact: true }),
      ).toBeVisible();
    });

    test("shows an error with a retry", async ({ page }) => {
      await script("specialties", 500);
      await page.goto(`/${locale}/specialties`);

      await expect(page.getByText("Scripted 500.")).toBeVisible();
      await script("specialties", 0);
      await page.getByRole("button", { name: shared.states.retry }).click();
      await expect(
        page.getByRole("row", { name: /Synthetic Cardiology/ }),
      ).toBeVisible();
    });
  });
}

test("a change the API refuses with 403 is explained in the dialog", async ({
  page,
}) => {
  const t = messages.en.specialties;
  await signIn(page, "administrator");
  await page.goto("/en/specialties");
  const row = page.getByRole("row", { name: /Synthetic Dermatology/ });

  await row.getByRole("button", { name: t.deactivate }).click();
  await script("POST specialties/2/deactivate", 403);
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: t.deactivate })
    .click();

  await expect(page.getByRole("alertdialog")).toContainText("Scripted 403.");
});
