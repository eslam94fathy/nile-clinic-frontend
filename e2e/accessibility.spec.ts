import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "./support/messages";
import { backendControlUrl } from "./support/ports";

async function seriousIssues(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.html).join(", ")}`);
}

async function setMode(mode: string) {
  await fetch(`${backendControlUrl}/mode/${mode}`);
}

test.afterEach(async () => {
  await setMode("ok");
});

for (const locale of ["ar", "en"] as const) {
  const status = messages[locale].status;

  for (const [mode, text] of [
    ["ok", status.working],
    ["unavailable", status.unavailable],
    ["destroy", status.unreachable],
  ] as const) {
    test(`landing page in ${locale}, ${mode}`, async ({ page }) => {
      await setMode(mode);
      await page.goto(`/${locale}`);
      await expect(page.getByRole("status")).toContainText(text);

      expect(await seriousIssues(page)).toEqual([]);
    });
  }

  test(`checking state in ${locale}`, async ({ page }) => {
    await setMode("slow");
    await page.goto(`/${locale}`, { waitUntil: "commit" });
    await expect(page.getByRole("status")).toContainText(status.checking);

    expect(await seriousIssues(page)).toEqual([]);
  });

  test(`not-found page in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/missing`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages[locale].notFound.heading,
    );

    expect(await seriousIssues(page)).toEqual([]);
  });
}
