import { expect, type Page, test } from "@playwright/test";
import {
  callsTo,
  control,
  mainNavigation,
  resetBackend,
  script,
  signIn,
} from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const m = messages.en;
const a = m.audit;
const pager = m.shared.cursorPager;
const ENDPOINT = "audit-entries";

/** Hidden pages stay mounted after a soft navigation, so only what's on screen counts. */
const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).locator("visible=true").first();
const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).locator("visible=true");
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).locator("visible=true");
const entries = (page: Page) => page.locator("article:visible");

async function searches(): Promise<Record<string, string | number>[]> {
  const answer = (await control("clinic/audit-searches")) as {
    searches: Record<string, string | number>[];
  };
  return answer.searches;
}

async function openAudit(page: Page, locale: "en" | "ar" = "en") {
  await signIn(page, "administrator", locale);
  await page.goto(`/${locale}/audit`);
  await expect(
    shown(page, messages[locale].audit.states.beforeSearchTitle),
  ).toBeVisible();
}

async function search(page: Page) {
  await button(page, a.filters.search).click();
  await expect(entries(page).first()).toBeVisible();
}

const noQuery = (page: Page) => expect(new URL(page.url()).search).toBe("");

test.describe("before a search", () => {
  for (const locale of ["en", "ar"] as const) {
    test(`opens with no search, in ${locale}`, async ({ page }) => {
      await openAudit(page, locale);
      const t = messages[locale].audit;

      await expect(shown(page, t.notice)).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        locale === "ar" ? "rtl" : "ltr",
      );
      await page.waitForTimeout(500);
      expect(await callsTo(ENDPOINT)).toBe(0);
      noQuery(page);
    });
  }

  test("is in the administrator's navigation", async ({ page }) => {
    await signIn(page, "administrator");
    await mainNavigation(page, "en")
      .getByRole("link", { name: m.shell.nav.audit })
      .click();
    await expect(shown(page, a.states.beforeSearchTitle)).toBeVisible();
    expect(await callsTo(ENDPOINT)).toBe(0);
  });

  test("groups the actions", async ({ page }) => {
    await openAudit(page);
    await expect(field(page, a.filters.action).locator("optgroup")).toHaveCount(
      10,
    );
  });
});

test.describe("searching", () => {
  test("Search reads once and shows the newest entries", async ({ page }) => {
    await openAudit(page);
    await search(page);

    await expect(entries(page)).toHaveCount(25);
    await expect(shown(page, pager.newest)).toBeVisible();
    expect(await callsTo(ENDPOINT)).toBe(1);
    expect(await searches()).toEqual([{}]);
    noQuery(page);
  });

  test("narrows by patient, and by two filters together", async ({ page }) => {
    await openAudit(page);
    await field(page, a.filters.patient).fill("1");
    await search(page);

    expect(await searches()).toEqual([{ patient_id: 1 }]);
    const patients = page
      .locator("article:visible dt", { hasText: a.entry.patient })
      .locator("xpath=following-sibling::dd[1]");
    for (const text of await patients.allTextContents()) expect(text).toBe("1");

    await field(page, a.filters.action).selectOption("discount.set");
    await button(page, a.filters.search).click();
    await expect(entries(page).first()).toBeVisible();
    await expect
      .poll(searches)
      .toEqual([{ patient_id: 1 }, { patient_id: 1, action: "discount.set" }]);
    for (const heading of await entries(page)
      .getByRole("heading")
      .allTextContents()) {
      expect(heading).toBe(a.actions.discount.set);
    }
    noQuery(page);
  });

  test("narrows by staff member, matching who acted or whose account", async ({
    page,
  }) => {
    await openAudit(page);
    await field(page, a.filters.staff).selectOption("2");
    await search(page);
    expect(await searches()).toEqual([{ staff_id: 2 }]);
  });

  test("changing a filter reads nothing until Search", async ({ page }) => {
    await openAudit(page);
    await search(page);
    await field(page, a.filters.patient).fill("2");

    await expect(shown(page, a.states.outOfDate)).toBeVisible();
    await page.waitForTimeout(500);
    expect(await callsTo(ENDPOINT)).toBe(1);
  });

  test("an unknown number shows the ordinary empty state", async ({ page }) => {
    await openAudit(page);
    await field(page, a.filters.patient).fill("999");
    await button(page, a.filters.search).click();
    await expect(shown(page, a.states.emptyTitle)).toBeVisible();

    await field(page, a.filters.patient).fill("");
    await field(page, a.filters.staff).selectOption("4");
    await button(page, a.filters.search).click();
    await expect.poll(searches).toEqual([{ patient_id: 999 }, { staff_id: 4 }]);
    await expect(shown(page, a.states.emptyTitle)).toBeVisible();
  });

  test("a failure offers Try again, which reads once more", async ({
    page,
  }) => {
    await openAudit(page);
    await script(ENDPOINT, 500);
    await button(page, a.filters.search).click();
    await expect(shown(page, m.shared.states.errorHeading)).toBeVisible();

    await script(ENDPOINT, 0);
    await button(page, m.shared.states.retry).click();
    await expect(entries(page)).toHaveCount(25);
    expect(await callsTo(ENDPOINT)).toBe(2);
  });

  test("Clear empties the filters without reading", async ({ page }) => {
    await openAudit(page);
    await field(page, a.filters.patient).fill("1");
    await search(page);
    await button(page, a.filters.clear).click();

    await expect(field(page, a.filters.patient)).toHaveValue("");
    await expect(shown(page, a.states.beforeSearchTitle)).toBeVisible();
    expect(await callsTo(ENDPOINT)).toBe(1);
  });
});

test.describe("problems with the filters", () => {
  test("are shown before anything is sent", async ({ page }) => {
    await openAudit(page);
    await field(page, a.filters.from).fill("2026-11-05");
    await field(page, a.filters.to).fill("2026-11-01");
    await button(page, a.filters.search).click();
    await expect(shown(page, a.problems.reversed)).toBeVisible();

    await field(page, a.filters.from).fill("");
    await field(page, a.filters.to).fill("");
    await field(page, a.filters.subjectNumber).fill("57");
    await button(page, a.filters.search).click();
    await expect(shown(page, a.problems.needsType)).toBeVisible();

    expect(await callsTo(ENDPOINT)).toBe(0);
  });

  test("the API's refusal appears on its field", async ({ page }) => {
    await openAudit(page);
    await script(ENDPOINT, 422, "to");
    await button(page, a.filters.search).click();

    await expect(field(page, a.filters.to)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(shown(page, "Scripted 422.")).toBeVisible();
  });
});

test.describe("paging", () => {
  test("moves older and newer, a request each, with no repeats or gaps", async ({
    page,
  }) => {
    await openAudit(page);
    await search(page);
    const headings = () =>
      entries(page).locator("header time").allTextContents();
    const first = await headings();

    await button(page, pager.older).click();
    await expect(shown(page, pager.newest)).toBeHidden();
    const second = await headings();
    expect(second).toHaveLength(25);
    expect(second.some((time) => first.includes(time))).toBe(false);

    await button(page, pager.older).click();
    await expect(entries(page)).toHaveCount(14);
    await expect(button(page, pager.older)).toBeDisabled();

    await button(page, pager.newer).click();
    await expect(entries(page)).toHaveCount(25);
    expect(await headings()).toEqual(second);

    expect(await callsTo(ENDPOINT)).toBe(4);
    noQuery(page);
  });

  test("Newer is unavailable on the newest page", async ({ page }) => {
    await openAudit(page);
    await search(page);
    await expect(button(page, pager.newer)).toBeDisabled();
  });

  test("a refused position offers to start again", async ({ page }) => {
    await openAudit(page);
    await search(page);
    await script(ENDPOINT, 422, "cursor");
    await button(page, pager.older).click();

    await expect(shown(page, a.states.positionRefused)).toBeVisible();
    await expect(entries(page)).toHaveCount(25);
    await expect(button(page, a.states.startAgain)).toBeVisible();
  });
});

test.describe("links", () => {
  test("a staff link opens their account, and back shows the same results without reading", async ({
    page,
  }) => {
    await openAudit(page);
    await search(page);
    await button(page, pager.older).click();
    await expect(shown(page, pager.newest)).toBeHidden();
    const before = await entries(page).locator("header time").allTextContents();

    await entries(page)
      .getByRole("link", { name: "Synthetic Reception" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/staff\/2$/);
    await page.goBack();

    await expect(entries(page)).toHaveCount(25);
    expect(
      await entries(page).locator("header time").allTextContents(),
    ).toEqual(before);
    expect(await callsTo(ENDPOINT)).toBe(2);
  });

  test("a patient link reads nothing until clicked", async ({ page }) => {
    await openAudit(page);
    await field(page, a.filters.patient).fill("1");
    await search(page);

    const patientLink = entries(page)
      .getByRole("link", { name: "1", exact: true })
      .first();
    await patientLink.hover();
    await page.waitForTimeout(500);
    expect(await callsTo("patients/1")).toBe(0);

    await patientLink.click();
    await expect(page).toHaveURL(/\/en\/patients\/1$/);
    await expect.poll(() => callsTo("patients/1")).toBe(1);
  });
});

test.describe("other roles", () => {
  for (const account of ["receptionist", "doctor"] as const) {
    test(`the ${account} is refused, and nothing is read`, async ({ page }) => {
      await signIn(page, account);
      await expect(
        mainNavigation(page, "en").getByRole("link", {
          name: m.shell.nav.audit,
        }),
      ).toHaveCount(0);

      await page.goto("/en/audit");
      await expect(shown(page, m.shared.states.forbiddenHeading)).toBeVisible();
      expect(await callsTo(ENDPOINT)).toBe(0);
    });
  }
});
