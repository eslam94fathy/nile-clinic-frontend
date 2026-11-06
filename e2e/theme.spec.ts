import { expect, type Page, test } from "@playwright/test";
import { messages } from "./support/messages";

// Records every theme the page shows, from before the first paint, so a flash can't go unnoticed.
async function recordThemes(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.assign(window, { seenThemes: seen });
    new MutationObserver(() => {
      const theme = document.documentElement?.dataset.theme;
      if (theme && seen.at(-1) !== theme) seen.push(theme);
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  });
}

const seenThemes = (page: Page) =>
  page.evaluate(() => {
    const { seenThemes: seen } = window as unknown as { seenThemes: string[] };
    return seen;
  });

function failOnConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

const saveTheme = (page: Page, theme: string) =>
  page.addInitScript((value) => localStorage.setItem("theme", value), theme);

test.describe("with no saved choice", () => {
  test.use({ colorScheme: "dark" });

  test("follows the device, with no flash", async ({ page }) => {
    const errors = failOnConsoleErrors(page);
    await recordThemes(page);

    await page.goto("/ar/sign-in");
    await page.waitForLoadState("networkidle");

    expect(await seenThemes(page)).toEqual(["dark"]);
    expect(errors).toEqual([]);
  });

  test("ignores an unknown saved value", async ({ page }) => {
    await saveTheme(page, "purple");
    await page.goto("/ar/sign-in");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("with a saved choice different from the device", () => {
  test.use({ colorScheme: "dark" });

  test("shows the saved theme from the start, with no flash", async ({
    page,
  }) => {
    const errors = failOnConsoleErrors(page);
    await recordThemes(page);
    await saveTheme(page, "light");

    await page.goto("/ar/sign-in");
    await page.waitForLoadState("networkidle");

    expect(await seenThemes(page)).toEqual(["light"]);
    expect(errors).toEqual([]);
  });

  test("keeps the theme through a language switch and back", async ({
    page,
  }) => {
    const errors = failOnConsoleErrors(page);
    await saveTheme(page, "light");
    await page.goto("/ar/sign-in");

    await page.getByRole("link", { name: messages.ar.language.switch }).click();
    await expect(page).toHaveURL(/\/en\/sign-in$/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.goBack();
    await expect(page).toHaveURL(/\/ar\/sign-in$/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(errors).toEqual([]);
  });
});

test.describe("with blocked storage", () => {
  test.use({ colorScheme: "dark" });

  test("falls back to the device, with no error", async ({ page }) => {
    const errors = failOnConsoleErrors(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      });
    });

    await page.goto("/en/sign-in");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(errors).toEqual([]);
  });
});

test.describe("fonts", () => {
  const loadedFonts = (page: Page) =>
    page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map((font) => font.family);
    });

  test("Arabic pages really load the Arabic font", async ({ page }) => {
    await page.goto("/ar/sign-in");
    await expect
      .poll(async () => (await loadedFonts(page)).join())
      .toMatch(/arabic/i);
  });

  test("English pages load the Latin font", async ({ page }) => {
    await page.goto("/en/sign-in");
    await expect
      .poll(async () => (await loadedFonts(page)).join())
      .toMatch(/latin/i);
  });
});

test.describe("the theme switch", () => {
  test.use({ colorScheme: "dark" });

  for (const locale of ["ar", "en"] as const) {
    const text = messages[locale].shared.theme;

    test(`works by keyboard, and announces the choice, in ${locale}`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/sign-in`);
      await page.waitForLoadState("networkidle");
      const group = page.getByRole("group", { name: text.label });
      const light = group.getByRole("button", { name: text.light });

      await expect(
        group.getByRole("button", { name: text.device }),
      ).toHaveAttribute("aria-pressed", "true");

      await light.focus();
      await page.keyboard.press("Enter");

      await expect(light).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
        "light",
      );

      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    });
  }

  test("still works when storage is blocked, until the page reloads", async ({
    page,
  }) => {
    const text = messages.en.shared.theme;
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      });
    });
    await page.goto("/en/sign-in");
    await page.waitForLoadState("networkidle");
    const light = page.getByRole("button", { name: text.light });

    await light.click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(light).toHaveAttribute("aria-pressed", "true");
  });

  test("choosing the device removes the saved choice and follows it live", async ({
    page,
  }) => {
    const text = messages.en.shared.theme;
    await saveTheme(page, "light");
    await page.goto("/en/sign-in");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: text.device }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();

    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
