import { expect, test } from "@playwright/test";
import { ACCOUNTS, PASSWORD } from "./support/auth";
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
  test(`/${locale}/sign-in keeps language, direction, and text, with a notice`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/sign-in`);

    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages[locale].auth.signIn.heading,
    );
    // `getByText` skips <noscript> content, so this targets the element directly.
    const notice = page.locator("noscript p");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText(messages[locale].auth.signIn.noscript);
  });
}

// Also how a form behaves in the moment before JavaScript has loaded.
test("the sign-in form can't put a password in the address", async ({
  page,
}) => {
  const t = messages.en.auth.signIn;
  const addresses: string[] = [];
  page.on("request", (request) => addresses.push(request.url()));
  await page.goto("/en/sign-in");

  await page.getByLabel(t.email).fill(ACCOUNTS.doctor);
  await page.getByLabel(t.password).fill(PASSWORD);
  await page.getByLabel(t.password).press("Enter");
  await page.waitForTimeout(500);

  await expect(page).toHaveURL(/\/en\/sign-in$/);
  expect(addresses.join()).not.toContain(PASSWORD);
  await expect(
    page.getByRole("button", { name: t.submit, exact: true }),
  ).toBeDisabled();
  await expect(page.locator("form")).toHaveAttribute("method", "post");
});
