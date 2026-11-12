import { expect, type Page, test } from "@playwright/test";
import { control, type Locale, resetBackend, signIn } from "./support/auth";

test.beforeEach(resetBackend);

type Watched = Window & {
  __violations: string[];
  __themeAtLoad: string | undefined;
};

/** Collects every policy violation, and the theme as the document finished parsing, before any script ran. */
async function watch(page: Page, theme: "light" | "dark") {
  await page.addInitScript((stored) => {
    const watched = window as unknown as Watched;
    watched.__violations = [];
    try {
      localStorage.setItem("theme", stored);
    } catch {
      // A blocked storage falls back to the device; this test then fails on the theme, as it should.
    }
    document.addEventListener("securitypolicyviolation", (event) => {
      watched.__violations.push(
        `${event.violatedDirective} ${event.blockedURI || "inline"} at ${location.pathname}`,
      );
    });
    document.addEventListener("DOMContentLoaded", () => {
      watched.__themeAtLoad = document.documentElement.dataset.theme;
    });
  }, theme);
}

async function visit(page: Page, address: string, theme: string) {
  await page.goto(address);
  await page.waitForLoadState("networkidle");
  const { violations, themeAtLoad } = await page.evaluate(() => {
    const watched = window as unknown as Watched;
    return {
      violations: watched.__violations,
      themeAtLoad: watched.__themeAtLoad,
    };
  });
  expect(violations, address).toEqual([]);
  // Right on first paint, so the theme script ran under the policy (no flash).
  expect(themeAtLoad, address).toBe(theme);
}

const seedDraft = async () =>
  ((await control("clinic/encounter?content=%7B%7D")) as { id: number }).id;

for (const locale of ["ar", "en"] as Locale[]) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`no policy violation, in ${locale}, ${theme}`, () => {
      test("signed out", async ({ page }) => {
        await watch(page, theme);
        await visit(page, `/${locale}/sign-in`, theme);
      });

      test("a receptionist's screens", async ({ page }) => {
        await watch(page, theme);
        await signIn(page, "receptionist", locale);
        for (const path of [
          "dashboard",
          "patients",
          "patients/2",
          "appointments",
          "appointments/new",
          "queue",
          "billing",
          "charges",
          "account",
        ]) {
          await visit(page, `/${locale}/${path}`, theme);
        }
      });

      test("a doctor's screens, a record, and a history", async ({ page }) => {
        const record = await seedDraft();
        await watch(page, theme);
        await signIn(page, "doctor", locale);
        for (const path of [
          "dashboard",
          "my/queue",
          "my/visits",
          "my/appointments",
          "my/schedule",
          `my/encounters/${record}`,
          "my/patients/2/history",
        ]) {
          await visit(page, `/${locale}/${path}`, theme);
        }
      });

      test("an administrator's screens", async ({ page }) => {
        await watch(page, theme);
        await signIn(page, "administrator", locale);
        for (const path of [
          "dashboard",
          "staff",
          "doctors",
          "doctors/1",
          "specialties",
          "fees",
          "reports",
          "audit",
        ]) {
          await visit(page, `/${locale}/${path}`, theme);
        }
      });
    });
  }
}
