import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "../support/messages";
import { adminToken, api, liveAccounts, signInLive } from "./support";

// The audit log against the real API. Every search, and every page of one, writes a permanent `audit.searched` entry,
// so this counts them after each step. The browser signs in as `auditAdmin`; the counts are the setup
// administrator's own searches, which never match `auditAdmin`'s (specs/011-audit-log/research.md, R10).
const m = messages.en;
const a = m.audit;
const pager = m.shared.cursorPager;
const stamp = () => `${Date.now()}${randomBytes(2).toString("hex")}`;

let token = "";

test.beforeAll(async () => {
  token = await adminToken();
});

type Searched = { filters: Record<string, string | number> | null };

/** `auditAdmin`'s searches, newest first. */
async function searchesBy(id: number): Promise<Searched[]> {
  const response = await api(
    `audit-entries?staff_id=${String(id)}&action=audit.searched&per_page=100`,
    { token },
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: Searched[] }).data;
}

/** Long enough for anything that was going to read to have done so. */
const settle = (page: Page) => page.waitForTimeout(1500);

const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).locator("visible=true").first();
const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).locator("visible=true");
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).locator("visible=true");
const entries = (page: Page) => page.locator("article:visible");
const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: m.shell.navigation })
    .getByRole("link", { name, exact: true });

async function newPatient(): Promise<{ id: number; full_name: string }> {
  const response = await api("patients", {
    method: "POST",
    token,
    body: {
      full_name: `Synthetic Live Audit ${stamp()}`,
      date_of_birth: "1990-04-12",
      sex: "male",
      phone: "01000000555",
    },
  });
  expect(response.status).toBe(201);
  return (
    (await response.json()) as { data: { id: number; full_name: string } }
  ).data;
}

test.describe("the audit log", () => {
  test("writes one entry per press, and none by itself", async ({ page }) => {
    test.setTimeout(240_000);
    const auditor = liveAccounts().auditAdmin;
    const patient = await newPatient();
    const expectSearches = async (count: number) => {
      await settle(page);
      expect(await searchesBy(auditor.id)).toHaveLength(count);
    };

    await signInLive(page, auditor);
    await page.goto("/en/audit");
    await expect(shown(page, a.states.beforeSearchTitle)).toBeVisible();
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("online"));
    });
    await expectSearches(0);

    // Search, Older, Newer: one each.
    await button(page, a.filters.search).click();
    await expect(entries(page).first()).toBeVisible();
    await expectSearches(1);
    await button(page, pager.older).click();
    await expect(shown(page, pager.newest)).toBeHidden();
    await expectSearches(2);
    // Back to the same entries. Newer ones written since, these searches among them, are still above them, as the
    // cursor keeps its place; a new search starts from the newest.
    await button(page, pager.newer).click();
    await expect(button(page, pager.older)).toBeEnabled();
    await expectSearches(3);
    const page1 = await entries(page).locator("header time").allTextContents();

    // A filter changed but not searched.
    await field(page, a.filters.patient).fill(String(patient.id));
    await expect(shown(page, a.states.outOfDate)).toBeVisible();
    await expectSearches(3);
    await field(page, a.filters.patient).fill("");

    // To another page by its link, and back.
    await nav(page, m.shell.nav.staff).click();
    await expect(page).toHaveURL(/\/en\/staff$/);
    await page.goBack();
    await expect(entries(page).first()).toBeVisible();
    expect(
      await entries(page).locator("header time").allTextContents(),
    ).toEqual(page1);
    await expectSearches(3);

    // A real change on another page, which refreshes it, and then back.
    await nav(page, m.shell.nav.specialties).click();
    await expect(page).toHaveURL(/\/en\/specialties$/);
    const t = m.specialties;
    const id = stamp();
    await page
      .getByLabel(new RegExp(`^${t.nameEn}`))
      .locator("visible=true")
      .fill(`Synthetic Audit ${id}`);
    await page
      .getByLabel(new RegExp(`^${t.nameAr}`))
      .locator("visible=true")
      .fill(`تدقيق تجريبي ${id}`);
    await page.getByRole("button", { name: t.add, exact: true }).click();
    await expect(page.getByText(t.added)).toBeVisible();
    await page.goBack();
    await expect(entries(page).first()).toBeVisible();
    await expectSearches(3);

    // Refused before anything is sent.
    await field(page, a.filters.from).fill("2026-11-05");
    await field(page, a.filters.to).fill("2026-11-01");
    await button(page, a.filters.search).click();
    await expect(shown(page, a.problems.reversed)).toBeVisible();
    await expectSearches(3);
    await field(page, a.filters.from).fill("");
    await field(page, a.filters.to).fill("");

    // By one patient: their registration is there, and nothing about anyone else.
    await field(page, a.filters.patient).fill(String(patient.id));
    await button(page, a.filters.search).click();
    await expect(
      entries(page).getByRole("heading", {
        name: a.actions.patient.registered,
      }),
    ).toBeVisible();
    const patients = await page
      .locator("article:visible dt", { hasText: a.entry.patient })
      .locator("xpath=following-sibling::dd[1]")
      .allTextContents();
    expect(patients.every((text) => text === String(patient.id))).toBe(true);
    await expectSearches(4);
    expect((await searchesBy(auditor.id))[0]?.filters).toEqual({
      patient_id: patient.id,
    });

    // Nothing of the search is in the address, in storage, or in the application server's output.
    expect(new URL(page.url()).search).toBe("");
    const stored = await page.evaluate(() =>
      JSON.stringify([{ ...localStorage }, { ...sessionStorage }]),
    );
    expect(stored).not.toContain(`patient_id`);
    const log = readFileSync(".next/e2e-live-app-server.log", "utf8");
    expect(log.length).toBeGreaterThan(0);
    expect(log).not.toContain(`patient_id=${String(patient.id)}`);
    expect(log).not.toContain("audit-entries?");

    // A reload starts empty, and so does another language.
    await page.reload();
    await expect(shown(page, a.states.beforeSearchTitle)).toBeVisible();
    await expectSearches(4);
    await page
      .getByRole("navigation", { name: m.language.label })
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(/\/ar\/audit$/);
    await expect(
      shown(page, messages.ar.audit.states.beforeSearchTitle),
    ).toBeVisible();
    await expectSearches(4);

    // Signing out and back in leaves nothing behind (FR-004).
    await page
      .getByRole("button", { name: messages.ar.auth.signOut.label })
      .click();
    await expect(page).toHaveURL(/\/ar\/sign-in/);
    await signInLive(page, auditor);
    await page.goto("/en/audit");
    await expect(shown(page, a.states.beforeSearchTitle)).toBeVisible();
    await expectSearches(4);
  });

  for (const role of ["receptionist", "doctor"] as const) {
    test(`a ${role} is refused`, async ({ page }) => {
      await signInLive(page, liveAccounts()[role]);
      await page.goto("/en/audit");
      await expect(shown(page, m.shared.states.forbiddenHeading)).toBeVisible();

      const response = await page.request.get("/api/backend/audit-entries", {
        headers: { Accept: "application/json" },
      });
      expect(response.status()).toBe(403);
    });
  }
});
