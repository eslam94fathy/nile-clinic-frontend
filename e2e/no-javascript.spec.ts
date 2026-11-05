import { expect, test } from "@playwright/test";
import { messages } from "./support/messages";

// `javaScriptEnabled: false` alone leaves the HTML parser treating <noscript> content as raw text,
// so scripting is also turned off at browser level, as it would be for a real visitor.
test.use({
  javaScriptEnabled: false,
  launchOptions: { args: ["--blink-settings=scriptEnabled=false"] },
});

for (const [locale, dir] of [
  ["ar", "rtl"],
  ["en", "ltr"],
] as const) {
  test(`/${locale} keeps language, direction, and text, with a notice`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);

    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages[locale].landing.heading,
    );
    // `getByText` skips <noscript> content, so this targets the element directly.
    const notice = page.locator("noscript p");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText(messages[locale].landing.noscript);
  });
}
