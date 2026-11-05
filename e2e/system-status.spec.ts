import { expect, test } from "@playwright/test";
import { backendControlUrl } from "./support/ports";
import { messages } from "./support/messages";

async function setMode(mode: string) {
  const response = await fetch(`${backendControlUrl}/mode/${mode}`);
  expect(response.ok).toBe(true);
}

async function stats(): Promise<{
  count: number;
  acceptLanguage: string | null;
}> {
  const response = await fetch(`${backendControlUrl}/stats`);
  return response.json();
}

const status = messages.en.status;

test.afterEach(async () => {
  await setMode("ok");
});

test.describe("each status", () => {
  for (const locale of ["ar", "en"] as const) {
    test(`working, in ${locale}, with the time in the clinic's zone`, async ({
      browser,
    }) => {
      await setMode("ok");
      // A browser far from Cairo: the time must still be the clinic's.
      const context = await browser.newContext({
        timezoneId: "America/New_York",
      });
      const page = await context.newPage();

      await page.goto(`http://localhost:3110/${locale}`);

      const region = page.getByRole("status");
      await expect(region).toContainText(messages[locale].status.working);
      await expect(region.getByRole("button")).toHaveCount(0);

      const expectedTime = new Intl.DateTimeFormat(locale, {
        timeZone: "Africa/Cairo",
        dateStyle: "medium",
      }).format(new Date());
      await expect(region).toContainText(expectedTime);
      await context.close();
    });
  }

  for (const mode of ["unavailable", "ok-with-unavailable-body"]) {
    test(`system unavailable for ${mode}`, async ({ page }) => {
      await setMode(mode);

      await page.goto("/en");

      const region = page.getByRole("status");
      await expect(region).toContainText(status.unavailable);
      await expect(region).not.toContainText(status.working);
      await expect(
        region.getByRole("button", { name: status.checkAgain }),
      ).toBeVisible();
    });
  }

  for (const mode of ["destroy", "html-404", "bad-shape", "redirect"]) {
    test(`cannot reach for ${mode}`, async ({ page }) => {
      await setMode(mode);

      await page.goto("/en");

      const region = page.getByRole("status");
      await expect(region).toContainText(status.unreachable);
      await expect(region).not.toContainText(status.working);
      await expect(
        region.getByRole("button", { name: status.checkAgain }),
      ).toBeVisible();
    });
  }

  test("cannot reach within about 5 seconds when nothing answers", async ({
    page,
  }) => {
    await setMode("hang");
    const started = Date.now();

    await page.goto("/en", { waitUntil: "commit" });
    await expect(page.getByRole("status")).toContainText(status.unreachable, {
      timeout: 8000,
    });

    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(4500);
    expect(elapsed).toBeLessThan(7000);
  });
});

test("the page shows checking while a slow check runs", async ({ page }) => {
  await setMode("slow");

  await page.goto("/en", { waitUntil: "commit" });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    messages.en.landing.heading,
  );
  await expect(page.getByRole("status")).toContainText(status.checking);
  await expect(page.getByRole("status")).toContainText(status.working);
});

test("the live region stays in place, so its result is announced", async ({
  page,
}) => {
  await setMode("slow");
  await page.goto("/en", { waitUntil: "commit" });

  const region = page.getByRole("status");
  await expect(region).toContainText(status.checking);
  const element = await region.elementHandle();

  await expect(region).toContainText(status.working);

  expect(await element?.evaluate((node) => node.isConnected)).toBe(true);
  expect(await element?.textContent()).toContain(status.working);
});

test("keyboard focus is kept when checking again", async ({ page }) => {
  await setMode("unavailable");
  await page.goto("/en");
  const button = page.getByRole("button", { name: status.checkAgain });
  await button.focus();

  // Still failing: the button stays, and keeps focus.
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText(status.unavailable);
  await expect(
    page.getByRole("button", { name: status.checkAgain }),
  ).toBeFocused();

  // Now working: the button goes, and focus moves to the status.
  await setMode("ok");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText(status.working);
  await expect(page.getByRole("status")).toBeFocused();
});

test("check again runs a new check and updates the status", async ({
  page,
}) => {
  await setMode("unavailable");
  await page.goto("/en");
  await expect(page.getByRole("status")).toContainText(status.unavailable);

  await setMode("ok");
  await page.getByRole("button", { name: status.checkAgain }).click();

  await expect(page.getByRole("status")).toContainText(status.working);
  expect((await stats()).count).toBe(1);
});

test("each page load makes exactly one check, with the page's language", async ({
  page,
}) => {
  await setMode("ok");

  await page.goto("/ar", { waitUntil: "networkidle" });
  await expect(page.getByRole("status")).toContainText(
    messages.ar.status.working,
  );
  let result = await stats();
  expect(result.count).toBe(1);
  expect(result.acceptLanguage).toBe("ar");

  await page.goto("/en", { waitUntil: "networkidle" });
  await expect(page.getByRole("status")).toContainText(status.working);
  result = await stats();
  expect(result.count).toBe(2);
  expect(result.acceptLanguage).toBe("en");

  // Being visible must not cause any further checks, such as link prefetching.
  await page.waitForTimeout(1000);
  expect((await stats()).count).toBe(2);
});

test("the backend is never exposed to the browser", async ({ page }) => {
  await setMode("ok");
  const contacted: string[] = [];
  page.on("request", (request) => contacted.push(request.url()));

  const response = await page.goto("/en", { waitUntil: "networkidle" });
  await expect(page.getByRole("status")).toContainText(status.working);

  expect(contacted.filter((url) => url.includes(":3111"))).toEqual([]);
  const html = (await response?.text()) ?? "";
  expect(html).not.toContain("3111");
  expect(html).not.toContain("BACKEND_API_URL");
  expect(await page.content()).not.toContain("3111");
});
