import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  control,
  type Locale,
  mainNavigation,
  resetBackend,
  signIn,
} from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const BLUEPRINT = {
  administrator: [
    "dashboard",
    "patients",
    "appointments",
    "queue",
    "billing",
    "charges",
    "doctors",
    "specialties",
    "fees",
    "staff",
    "reports",
    "audit",
  ],
  receptionist: [
    "dashboard",
    "patients",
    "appointments",
    "queue",
    "billing",
    "charges",
    "doctors",
    "fees",
  ],
  doctor: ["dashboard", "myQueue", "myAppointments", "myVisits", "mySchedule"],
} as const;

const navLabels = (locale: Locale, keys: readonly string[]) =>
  keys.map(
    (key) =>
      messages[locale].shell.nav[key as keyof typeof messages.en.shell.nav],
  );

for (const locale of ["ar", "en"] as const) {
  for (const role of ["administrator", "receptionist", "doctor"] as const) {
    test(`a ${role} sees exactly their navigation, in ${locale}`, async ({
      page,
    }) => {
      await signIn(page, role, locale);

      await expect(mainNavigation(page, locale).getByRole("link")).toHaveText(
        navLabels(locale, BLUEPRINT[role]),
      );
    });
  }
}

const REFUSALS = [
  ["receptionist", "staff", "staff"],
  ["receptionist", "reports", "reports"],
  ["receptionist", "audit", "audit"],
  ["receptionist", "specialties", "specialties"],
  ["receptionist", "my/queue", "myQueue"],
  ["doctor", "patients", "patients"],
  ["doctor", "queue", "queue"],
  ["doctor", "doctors", "doctors"],
  ["doctor", "billing", "billing"],
  ["administrator", "my/queue", "myQueue"],
  ["administrator", "my/schedule", "mySchedule"],
] as const;

for (const [role, path, label] of REFUSALS) {
  test(`a ${role} can't use /${path}`, async ({ page }) => {
    await signIn(page, role);

    await page.goto(`/en/${path}`);

    await expect(
      page.getByText(messages.en.shared.states.forbiddenHeading),
    ).toBeVisible();
    await expect(mainNavigation(page, "en")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
    await expect(
      page.getByRole("main").getByText(messages.en.shell.nav[label]),
    ).toHaveCount(0);
  });
}

test("a refused page's content isn't sent at all", async ({ page }) => {
  await signIn(page, "receptionist");
  const placeholder = messages.en.shell.placeholderHeading;

  const response = await page.request.get("/en/staff");
  const body = await response.text();

  expect(body).toContain(messages.en.shared.states.forbiddenHeading);
  expect(body).not.toContain(placeholder);
});

test("an allowed page from a later phase shows the placeholder", async ({
  page,
}) => {
  await signIn(page, "administrator");

  await page.goto("/en/staff");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    messages.en.shell.nav.staff,
  );
  await expect(
    page.getByText(messages.en.shell.placeholderHeading),
  ).toBeVisible();
});

test.describe("addresses that don't exist", () => {
  test("show a neutral state in the frame when signed in", async ({ page }) => {
    await signIn(page, "doctor");

    await page.goto("/en/nowhere/at/all");

    await expect(
      page.getByText(messages.en.shared.states.notFoundHeading),
    ).toBeVisible();
    await expect(mainNavigation(page, "en")).toBeVisible();
  });

  test("show the ordinary page, with a real 404, when not", async ({
    page,
  }) => {
    const response = await page.goto("/en/nowhere");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.en.notFound.heading,
    );
  });
});

test("a changed role shows on the next navigation", async ({ page }) => {
  await signIn(page, "receptionist");
  const nav = mainNavigation(page, "en");
  await expect(
    nav.getByRole("link", { name: messages.en.shell.nav.patients }),
  ).toBeVisible();

  await control(`account?email=${ACCOUNTS.receptionist}&role=administrator`);
  await nav.getByRole("link", { name: messages.en.shell.nav.queue }).click();

  await expect(
    nav.getByRole("link", { name: messages.en.shell.nav.staff }),
  ).toBeVisible();
});

test("a role that lost access is refused on the next navigation", async ({
  page,
}) => {
  await signIn(page, "administrator");
  const nav = mainNavigation(page, "en");
  await control(`account?email=${ACCOUNTS.administrator}&role=receptionist`);

  await nav.getByRole("link", { name: messages.en.shell.nav.staff }).click();

  await expect(
    page.getByText(messages.en.shared.states.forbiddenHeading),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: messages.en.shell.nav.staff }),
  ).toHaveCount(0);
});

test.describe("using the navigation", () => {
  test("marks the current page, without relying on color", async ({ page }) => {
    await signIn(page, "receptionist");
    const nav = mainNavigation(page, "en");

    await nav.getByRole("link", { name: messages.en.shell.nav.queue }).click();
    await expect(page).toHaveURL(/\/en\/queue$/);

    const current = nav.locator('[aria-current="page"]');
    await expect(current).toHaveText(messages.en.shell.nav.queue);
    await expect(current).toHaveCSS("font-weight", "600");
    await expect(current).toHaveCSS("border-inline-start-width", "4px");
  });

  test("works by keyboard on a wide screen", async ({ page }) => {
    await signIn(page, "doctor");
    const link = mainNavigation(page, "en").getByRole("link", {
      name: messages.en.shell.nav.myQueue,
    });

    await link.focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/en\/my\/queue$/);
  });

  test("works by keyboard from its menu on a narrow screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await signIn(page, "doctor");
    const nav = mainNavigation(page, "en");
    const link = nav.getByRole("link", { name: messages.en.shell.nav.myQueue });

    await expect(link).toBeHidden();
    const menu = nav.getByRole("button", { name: messages.en.shell.menu });
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");

    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/my\/queue$/);
    await expect(link).toBeHidden();
  });

  test("keeps the page and the session when the language changes", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/queue");

    await page.getByRole("link", { name: messages.en.language.switch }).click();

    await expect(page).toHaveURL(/\/ar\/queue$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(mainNavigation(page, "ar")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.ar.shell.nav.queue,
    );
  });
});

test.describe("a name in the top bar", () => {
  test("stays within the bar when very long, and is available in full", async ({
    page,
  }) => {
    const name = `Synthetic ${"Verylongname ".repeat(12).trim()}`;
    await control(
      `account?email=${ACCOUNTS.doctor}&name=${encodeURIComponent(name)}`,
    );
    await signIn(page, "doctor");

    const shown = page.getByRole("banner").getByTitle(name);
    await expect(shown).toBeVisible();
    const box = await shown.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(230);

    const width = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(width).toBeLessThanOrEqual(0);
  });

  test("displays as written, in its own direction", async ({ page }) => {
    const name = "مريم Synthetic";
    await control(
      `account?email=${ACCOUNTS.doctor}&name=${encodeURIComponent(name)}`,
    );
    await signIn(page, "doctor");

    const shown = page.getByRole("banner").locator("bdi");
    await expect(shown).toHaveText(name);
    await expect(shown).toHaveAttribute("dir", "auto");
  });
});
