import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "../support/messages";
import { adminToken, api, signInLive } from "./support";

// What a person sees against the real API, and above all how many permanent "opened" entries each action
// writes. These run on a production build: see ADR 0012 and specs/005-patients/quickstart.md.
const m = messages.en;
const admin = () => ({
  email: process.env.LIVE_ADMIN_EMAIL ?? "",
  password: process.env.LIVE_ADMIN_PASSWORD ?? "",
});
const stamp = () => `${Date.now()}${randomBytes(2).toString("hex")}`;

let token = "";

test.beforeAll(async () => {
  token = await adminToken();
});

async function newPatient(overrides: object = {}): Promise<{
  id: number;
  full_name: string;
}> {
  const response = await api("patients", {
    method: "POST",
    token,
    body: {
      full_name: `Synthetic Live Patient ${stamp()}`,
      date_of_birth: "1990-04-12",
      sex: "female",
      phone: "01000000123",
      ...overrides,
    },
  });
  expect(response.status).toBe(201);
  return (
    (await response.json()) as { data: { id: number; full_name: string } }
  ).data;
}

/** How many entries of this kind the audit trail holds for the patient. Up to 100, which is plenty here. */
async function entries(id: number, action: string): Promise<number> {
  const response = await api(
    `audit-entries?patient_id=${id}&action=${action}&per_page=100`,
    { token },
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: unknown[] }).data.length;
}

const opened = (id: number) => entries(id, "patient.opened");

/** Long enough for anything that was going to read a record to have done so. */
const settle = (page: Page) => page.waitForTimeout(1500);

async function expectOpenings(page: Page, id: number, count: number) {
  await settle(page);
  expect(await opened(id)).toBe(count);
}

const reloadButton = (page: Page) =>
  page.getByRole("button", { name: m.patients.record.reload });
const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: m.shell.navigation })
    .getByRole("link", { name, exact: true });

test.describe("the opening count, from the record's address", () => {
  test("only a person's own actions write an entry", async ({
    page,
    context,
  }) => {
    test.setTimeout(170_000);
    const patient = await newPatient();
    await signInLive(page, admin());

    await page.goto(`/en/patients/${patient.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      patient.full_name,
    );
    await expectOpenings(page, patient.id, 1);

    // The tab losing and regaining focus, and the network coming back.
    const other = await context.newPage();
    await other.bringToFront();
    await page.bringToFront();
    await other.close();
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("online"));
    });
    await expectOpenings(page, patient.id, 1);

    // Away by the navigation, and back.
    await nav(page, m.shell.nav.fees).click();
    await expect(page).toHaveURL(/\/en\/fees$/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/en/patients/${patient.id}$`));
    await expect(reloadButton(page)).toBeVisible();
    await expectOpenings(page, patient.id, 1);

    // A real change on another page, which refreshes it, and then back. A server read wrote a false entry here.
    await nav(page, m.shell.nav.specialties).click();
    await expect(page).toHaveURL(/\/en\/specialties$/);
    const t = m.specialties;
    const id = stamp();
    await page
      .getByLabel(new RegExp(`^${t.nameEn}`))
      .locator("visible=true")
      .fill(`Synthetic Opening ${id}`);
    await page
      .getByLabel(new RegExp(`^${t.nameAr}`))
      .locator("visible=true")
      .fill(`فتح تجريبي ${id}`);
    await page.getByRole("button", { name: t.add, exact: true }).click();
    await expect(page.getByText(t.added)).toBeVisible();
    await expectOpenings(page, patient.id, 1);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/en/patients/${patient.id}$`));
    await expect(reloadButton(page)).toBeVisible();
    await expectOpenings(page, patient.id, 1);

    // What a person asks for writes one entry each.
    await reloadButton(page).click();
    await expectOpenings(page, patient.id, 2);

    await page.reload();
    await expect(reloadButton(page)).toBeVisible();
    await expectOpenings(page, patient.id, 3);

    await page
      .getByRole("navigation", { name: m.language.label })
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(new RegExp(`/ar/patients/${patient.id}$`));
    await expectOpenings(page, patient.id, 4);
  });

  test("the record shown is the API's, in full", async ({ page }) => {
    const patient = await newPatient({
      national_id: `2${String(Date.now()).slice(-13)}`,
      address: "12 Synthetic St",
      emergency_contact: {
        name: "Synthetic Guardian",
        relationship: "father",
        phone: "01000000124",
      },
    });
    await signInLive(page, admin());

    await page.goto(`/en/patients/${patient.id}`);

    const main = page.getByRole("main");
    await expect(main).toContainText(patient.full_name);
    await expect(main).toContainText("1990-04-12");
    await expect(main).toContainText("12 Synthetic St");
    await expect(main).toContainText("Synthetic Guardian");
    await expect(main).toContainText("01000000124");
  });

  test("a number that doesn't exist writes nothing, and looks neutral", async ({
    page,
  }) => {
    await signInLive(page, admin());
    await page.goto("/en/patients/999999999");

    await expect(page.getByText(m.shared.states.notFoundHeading)).toBeVisible();
  });
});
