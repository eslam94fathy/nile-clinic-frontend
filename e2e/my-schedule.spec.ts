import { expect, test } from "@playwright/test";
import { callsTo, control, resetBackend, signIn } from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const inDays = (count: number) => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
  }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + count * 86_400_000)
    .toISOString()
    .slice(0, 10);
};

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale].scheduling;

  test.describe(`my schedule, in ${locale}`, () => {
    test("shows own hours, slots, and time off, with no controls", async ({
      page,
    }) => {
      await control("clinic/setup?doctor=1&schedule=1&fee=350.10");
      await control(
        `clinic/time-off?doctor=1&start=${inDays(40)}&end=${inDays(41)}&reason=Synthetic+away`,
      );
      await signIn(page, "doctor", locale);
      await page.goto(`/${locale}/my/schedule`);

      const main = page.getByRole("main");
      await expect(
        main.getByRole("heading", { level: 1, name: t.myTitle }),
      ).toBeVisible();
      await expect(main).toContainText("09:00");
      await expect(
        main.getByRole("row", { name: /Synthetic away/ }),
      ).toBeVisible();

      await expect(main.getByRole("button")).toHaveCount(0);
      await expect(main.getByRole("textbox")).toHaveCount(0);
      await expect(main).not.toContainText("350.10");
    });

    test("says that an administrator sets the hours", async ({ page }) => {
      await signIn(page, "doctor", locale);
      await page.goto(`/${locale}/my/schedule`);

      await expect(page.getByText(t.ownNoHoursTitle)).toBeVisible();
      await expect(page.getByText(t.ownNoHoursDescription)).toBeVisible();
    });

    test("shows the no-profile state", async ({ page }) => {
      await signIn(page, "newDoctor", locale);
      await page.goto(`/${locale}/my/schedule`);

      await expect(
        page.getByText(messages[locale].auth.noProfile.heading),
      ).toBeVisible();
    });
  });
}

test("never asks for a fee", async ({ page }) => {
  await control("clinic/setup?doctor=1&schedule=1&fee=350.10");
  await signIn(page, "doctor");
  await page.goto("/en/my/schedule");
  await expect(page.getByRole("main")).toContainText("09:00");

  const calls = (await control("calls")) as Record<string, number>;
  expect(Object.keys(calls).filter((name) => name.includes("fee"))).toEqual([]);
  expect(await callsTo("doctors/me/schedule")).toBeGreaterThan(0);
});
