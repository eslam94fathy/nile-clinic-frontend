import { expect, test } from "@playwright/test";
import { messages } from "./support/messages";

function firstHtmlTag(body: string) {
  return /<html[^>]*>/.exec(body)?.[0] ?? "";
}

test.describe("default language", () => {
  test.use({ locale: "en-US" });

  test("opens in Arabic whatever the browser prefers", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/ar\/sign-in$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.ar.auth.signIn.heading,
    );
  });
});

test.describe("language in the server's first response", () => {
  for (const [locale, dir] of [
    ["ar", "rtl"],
    ["en", "ltr"],
  ] as const) {
    test(`/${locale}/sign-in declares lang and dir`, async ({ request }) => {
      const response = await request.get(`/${locale}/sign-in`);
      const body = await response.text();

      expect(response.status()).toBe(200);
      expect(firstHtmlTag(body)).toContain(`lang="${locale}"`);
      expect(firstHtmlTag(body)).toContain(`dir="${dir}"`);
      expect(body).toContain(messages[locale].auth.signIn.description);
    });
  }

  test("redirects preserve the query string", async ({ request }) => {
    const response = await request.get("/?a=1", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/ar\?a=1$/);
  });
});

test.describe("language switch", () => {
  test("switches, keeps the page, and is remembered", async ({ page }) => {
    await page.goto("/ar/sign-in");

    await page.getByRole("link", { name: messages.ar.language.switch }).click();

    await expect(page).toHaveURL(/\/en\/sign-in$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.en.auth.signIn.heading,
    );

    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/sign-in$/);

    await page.getByRole("link", { name: messages.en.language.switch }).click();
    await expect(page).toHaveURL(/\/ar\/sign-in$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/ar\/sign-in$/);
  });

  test("keeps the query string", async ({ page }) => {
    await page.goto("/ar/sign-in?filter=1&page=2");

    // The static shell can't know the query, so the link gains it once JavaScript has run. A click
    // before that drops the query, which is a known limit: see "Rendering" in docs/architecture.md.
    const link = page.getByRole("link", { name: messages.ar.language.switch });
    await expect(link).toHaveAttribute(
      "href",
      /\/en\/sign-in\?filter=1&page=2$/,
    );
    await link.click();

    await expect(page).toHaveURL(/\/en\/sign-in\?filter=1&page=2$/);
  });

  test("is available on not-found pages, and keeps the path", async ({
    page,
  }) => {
    await page.goto("/ar/missing");

    await page.getByRole("link", { name: messages.ar.language.switch }).click();

    await expect(page).toHaveURL(/\/en\/missing$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.en.notFound.heading,
    );
  });

  test("ignores an unsupported saved choice", async ({ page, context }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "fr", url: "http://localhost:3110" },
    ]);

    await page.goto("/");

    await expect(page).toHaveURL(/\/ar\/sign-in$/);
  });
});

test.describe("not-found pages", () => {
  test("an unknown path shows a localized page", async ({ page }) => {
    const response = await page.goto("/en/missing");

    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.en.notFound.heading,
    );
  });

  // /apiary and /_nextish start with an excluded prefix, but aren't excluded segments.
  for (const path of ["/fr", "/AR", "/apiary", "/_nextish"]) {
    test(`${path} is not treated as a language`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(404);
      await expect(page).toHaveURL(new RegExp(`/ar${path}$`));
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        messages.ar.notFound.heading,
      );
    });
  }

  test("uses the saved language", async ({ page, context }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", url: "http://localhost:3110" },
    ]);

    await page.goto("/fr");

    await expect(page).toHaveURL(/\/en\/fr$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.en.notFound.heading,
    );
  });
});
