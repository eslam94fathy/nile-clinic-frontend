import { expect, test } from "@playwright/test";
import { messages } from "./support/messages";

for (const locale of ["ar", "en"] as const) {
  const text = messages[locale].preview.actions;
  const shared = messages[locale].shared.confirm;

  test.describe(`confirmation in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/${locale}/design-preview`);
    });

    const openWithKeyboard = async (page: import("@playwright/test").Page) => {
      const trigger = page.getByRole("button", {
        name: text.open,
        exact: true,
      });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("alertdialog")).toBeVisible();
      return trigger;
    };

    test("opens with focus on the safe choice", async ({ page }) => {
      await openWithKeyboard(page);
      await expect(
        page.getByRole("button", { name: shared.cancel }),
      ).toBeFocused();
    });

    test("the confirm button looks destructive", async ({ page }) => {
      await openWithKeyboard(page);
      await expect(
        page
          .getByRole("alertdialog")
          .getByRole("button", { name: text.confirm }),
      ).toHaveCSS("background-color", "rgb(163, 35, 31)");
    });

    test("says it can't be undone", async ({ page }) => {
      await openWithKeyboard(page);
      await expect(page.getByRole("alertdialog")).toContainText(
        shared.irreversible,
      );
    });

    test("keeps focus inside, in both Tab directions", async ({ page }) => {
      await openWithKeyboard(page);
      const isInside = () =>
        page.evaluate(
          () => !!document.activeElement?.closest('[role="alertdialog"]'),
        );

      for (const key of ["Tab", "Shift+Tab"]) {
        for (let press = 0; press < 6; press += 1) {
          await page.keyboard.press(key);
          expect(await isInside()).toBe(true);
        }
      }
    });

    test("Escape closes, and returns focus to the trigger", async ({
      page,
    }) => {
      const trigger = await openWithKeyboard(page);
      await page.keyboard.press("Escape");

      await expect(page.getByRole("alertdialog")).toBeHidden();
      await expect(trigger).toBeFocused();
    });

    test("can't be dismissed or repeated while pending", async ({ page }) => {
      await openWithKeyboard(page);
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: text.confirm })
        .click();

      const working = page.getByRole("button", { name: shared.working });
      await expect(working).toHaveAttribute("aria-disabled", "true");
      await page.keyboard.press("Escape");
      // Forced, as Playwright rightly won't click a disabled control by itself.
      await working.click({ force: true });
      await expect(page.getByRole("alertdialog")).toBeVisible();

      // Then it succeeds once, closes, and says so.
      await expect(page.getByRole("alertdialog")).toBeHidden();
      await expect(page.getByText(text.success)).toHaveCount(1);
    });

    test("a failure shows inside, and stays open", async ({ page }) => {
      await page.getByRole("button", { name: text.openFailing }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: text.confirm })
        .click();

      await expect(page.getByRole("alertdialog").getByRole("alert")).toHaveText(
        text.failure,
      );
      await expect(page.getByRole("alertdialog")).toBeVisible();
    });
  });
}
