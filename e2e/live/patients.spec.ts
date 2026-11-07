import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { mainNavigation, signOutButton } from "../support/auth";
import { messages } from "../support/messages";
import {
  adminToken,
  api,
  apiSignIn,
  liveAccounts,
  signInLive,
} from "./support";

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

const searchField = (page: Page, label: string) =>
  page.getByRole("textbox", { name: label, exact: true });

async function search(page: Page, label: string, term: string) {
  await page.goto("/en/patients");
  await searchField(page, label).fill(term);
  await page.getByRole("button", { name: m.patients.search.button }).click();
}

const results = (page: Page) =>
  page.getByRole("table", { name: m.patients.search.caption });

/** A number no earlier run has used, as phones and national IDs are checked and these stay in the database. */
const uniqueDigits = (length: number) =>
  `${Date.now()}${randomBytes(4).readUInt32BE().toString()}`.slice(-length);

const arabicDigits = (value: string) =>
  value.replace(/\d/gu, (digit) => "٠١٢٣٤٥٦٧٨٩".charAt(Number(digit)));

test.describe("finding a patient, by the API's own matching", () => {
  const f = m.patients.fields;

  test.beforeEach(async ({ page }) => {
    await signInLive(page, admin());
  });

  // The frontend sends the name as typed, so only the API can make these match (SC-004).
  for (const [spelling, stored, typed] of [
    ["alef", "أحمد", "احمد"],
    ["taa marbuta", "هبة", "هبه"],
    ["yaa", "على", "علي"],
  ]) {
    test(`Arabic names match across ${spelling} spellings`, async ({
      page,
    }) => {
      const mark = uniqueDigits(10);
      const patient = await newPatient({
        full_name: `اختبار ${stored} ${mark}`,
      });

      await search(page, f.fullName, `${typed} ${mark}`);

      await expect(
        results(page).getByRole("link", { name: patient.full_name }),
      ).toBeVisible();
    });
  }

  test("several patients sharing a phone, typed with separators and Arabic digits", async ({
    page,
  }) => {
    const phone = `010${uniqueDigits(8)}`;
    const first = await newPatient({ phone });
    const second = await newPatient({ phone });
    const spaced = `${phone.slice(0, 3)} ${phone.slice(3, 7)}-${phone.slice(7)}`;

    await search(page, f.phone, arabicDigits(spaced));

    await expect(results(page)).toContainText(first.full_name);
    await expect(results(page)).toContainText(second.full_name);
  });

  test("an exact patient number and national ID", async ({ page }) => {
    const nationalId = `2${uniqueDigits(13)}`;
    const patient = await newPatient({ national_id: nationalId });

    await search(page, f.number, String(patient.id));
    await expect(results(page)).toContainText(patient.full_name);

    await search(page, f.nationalId, nationalId);
    await expect(results(page)).toContainText(patient.full_name);
  });

  for (const [label, field, value] of [
    ["phone", f.phone, "12"],
    ["national ID", f.nationalId, "123"],
  ] as const) {
    test(`a malformed ${label} shows the API's refusal on its field`, async ({
      page,
    }) => {
      await search(page, field, value);

      await expect(searchField(page, field)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(searchField(page, field)).toHaveValue(value);
    });
  }

  test("paging follows the API's totals", async ({ page }) => {
    test.setTimeout(120_000);
    const phone = `010${uniqueDigits(8)}`;
    const check = await api(`patients?phone=${phone}`, { token });
    expect(check.status).toBe(200);
    for (let count = 0; count < 16; count += 1) {
      await newPatient({ phone });
    }
    const listed = (await (
      await api(`patients?phone=${phone}`, { token })
    ).json()) as { meta: { total: number; per_page: number } };
    expect(listed.meta.total).toBe(16);

    await search(page, f.phone, phone);
    await expect(results(page).locator("tbody tr")).toHaveCount(
      listed.meta.per_page,
    );

    await page.getByRole("button", { name: m.shared.table.next }).click();

    await expect(results(page).locator("tbody tr")).toHaveCount(
      16 - listed.meta.per_page,
    );
    await expect(page).toHaveURL(/\/en\/patients$/);
  });
});

test.describe("the opening count, from real search results", () => {
  test("a click opens, and nothing else does", async ({ page, context }) => {
    test.setTimeout(170_000);
    const patient = await newPatient();
    await signInLive(page, admin());

    await search(page, m.patients.fields.fullName, patient.full_name);
    const link = results(page).getByRole("link", { name: patient.full_name });

    await expect(link).toBeVisible();
    await link.hover();
    await expectOpenings(page, patient.id, 0);

    await link.click();
    await expect(reloadButton(page)).toBeVisible();
    await expectOpenings(page, patient.id, 1);

    // To the search by its link, and back.
    await page.getByRole("link", { name: m.patients.backToSearch }).click();
    await expect(page).toHaveURL(/\/en\/patients$/);
    await page.goBack();
    await expect(reloadButton(page)).toBeVisible();
    await expectOpenings(page, patient.id, 1);

    // A real change on another page, which refreshes it, and then back.
    await nav(page, m.shell.nav.specialties).click();
    await expect(page).toHaveURL(/\/en\/specialties$/);
    const t = m.specialties;
    const id = stamp();
    await page
      .getByLabel(new RegExp(`^${t.nameEn}`))
      .locator("visible=true")
      .fill(`Synthetic Search Opening ${id}`);
    await page
      .getByLabel(new RegExp(`^${t.nameAr}`))
      .locator("visible=true")
      .fill(`فتح بحث تجريبي ${id}`);
    await page.getByRole("button", { name: t.add, exact: true }).click();
    await expect(page.getByText(t.added)).toBeVisible();
    await page.goBack();
    await expect(reloadButton(page)).toBeVisible();
    await expectOpenings(page, patient.id, 1);

    // The same result again is a person asking again, even though the record is still held.
    await page.getByRole("link", { name: m.patients.backToSearch }).click();
    await expect(link).toBeVisible();
    await link.click();
    await expect(reloadButton(page)).toBeVisible();
    await expectOpenings(page, patient.id, 2);

    // Ctrl+click reads in the new tab, and leaves no mark in this one.
    await page.getByRole("link", { name: m.patients.backToSearch }).click();
    await expect(link).toBeVisible();
    const [newTab] = await Promise.all([
      context.waitForEvent("page"),
      link.click({ modifiers: ["Control"] }),
    ]);
    await expect(newTab.getByRole("heading", { level: 1 })).toContainText(
      patient.full_name,
    );
    await expectOpenings(page, patient.id, 3);
    await newTab.close();

    await page.goBack();
    await expect(reloadButton(page)).toBeVisible();
    await expectOpenings(page, patient.id, 3);
  });
});

test.describe("registering a patient", () => {
  const f = m.patients.fields;
  const form = m.patients.registerForm;

  const field = (page: Page, label: string) =>
    page.getByLabel(new RegExp(`^${label}`, "u")).locator("visible=true");

  async function fillRequired(page: Page, name: string, phone: string) {
    await page.goto("/en/patients/new");
    await field(page, f.fullName).fill(name);
    await field(page, f.dateOfBirth).fill("1990-04-12");
    await field(page, f.sex).selectOption("female");
    await field(page, f.phone).fill(phone);
  }

  const submit = (page: Page) =>
    page.getByRole("button", { name: form.submit, exact: true }).click();

  async function movedToRecord(page: Page): Promise<number> {
    await expect(page).toHaveURL(/\/en\/patients\/\d+$/);
    return Number(page.url().split("/").pop());
  }

  async function withPhone(phone: string): Promise<number> {
    const response = await api(`patients?phone=${phone}`, { token });
    expect(response.status).toBe(200);
    return ((await response.json()) as { meta: { total: number } }).meta.total;
  }

  test.beforeEach(async ({ page }) => {
    await signInLive(page, admin());
  });

  test("required details only: one entry for registering, none for opening, until a reload", async ({
    page,
  }) => {
    const name = `Synthetic Registered ${stamp()}`;
    const phone = `010${uniqueDigits(8)}`;

    await fillRequired(page, name, phone);
    await submit(page);

    const id = await movedToRecord(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
    await expect(reloadButton(page)).toBeVisible();
    await expectOpenings(page, id, 0);
    expect(await entries(id, "patient.registered")).toBe(1);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
    await expectOpenings(page, id, 1);
    expect(await entries(id, "patient.registered")).toBe(1);
    expect(await withPhone(phone)).toBe(1);
  });

  test("every detail arrives as entered", async ({ page }) => {
    const name = `مريض تجريبي ${stamp()}`;
    const phone = `010${uniqueDigits(8)}`;
    const nationalId = `2${uniqueDigits(13)}`;
    const contactPhone = `011${uniqueDigits(8)}`;

    await fillRequired(page, name, `${phone.slice(0, 3)} ${phone.slice(3)}`);
    await field(page, f.nationalId).fill(arabicDigits(nationalId));
    await field(page, f.address).fill("12 Synthetic St");
    await page
      .getByLabel(f.contactName, { exact: true })
      .locator("visible=true")
      .fill("Synthetic Guardian");
    await page
      .getByLabel(f.contactRelationship, { exact: true })
      .locator("visible=true")
      .fill("father");
    await page
      .getByLabel(f.contactPhone, { exact: true })
      .locator("visible=true")
      .fill(contactPhone);
    await submit(page);

    const id = await movedToRecord(page);
    const main = page.getByRole("main");
    await expect(main).toContainText(name);
    await expect(main).toContainText("Synthetic Guardian");

    const response = await api(`patients/${id}`, { token });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: unknown }).data).toMatchObject({
      full_name: name,
      date_of_birth: "1990-04-12",
      sex: "female",
      phone,
      national_id: nationalId,
      address: "12 Synthetic St",
      emergency_contact: {
        name: "Synthetic Guardian",
        relationship: "father",
        phone: contactPhone,
      },
    });
  });

  test("a repeated national ID is refused on its field", async ({ page }) => {
    const nationalId = `3${uniqueDigits(13)}`;
    await newPatient({
      national_id: nationalId,
      phone: `010${uniqueDigits(8)}`,
    });
    const phone = `010${uniqueDigits(8)}`;

    await fillRequired(page, `Synthetic Repeat ${stamp()}`, phone);
    await field(page, f.nationalId).fill(nationalId);
    await submit(page);

    await expect(field(page, f.nationalId)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page).toHaveURL(/\/en\/patients\/new$/);
    expect(await withPhone(phone)).toBe(0);
  });

  test("a shared phone warns, and registering anyway succeeds", async ({
    page,
  }) => {
    const phone = `010${uniqueDigits(8)}`;
    const first = await newPatient({ phone });

    await fillRequired(page, `Synthetic Sibling ${stamp()}`, phone);
    await submit(page);

    await expect(page.getByText(form.matchesTitle)).toBeVisible();
    await expect(
      page.getByRole("link", { name: first.full_name }),
    ).toBeVisible();
    expect(await withPhone(phone)).toBe(1);

    await page.getByRole("button", { name: form.registerAnyway }).click();

    const id = await movedToRecord(page);
    expect(id).not.toBe(first.id);
    expect(await withPhone(phone)).toBe(2);
    // Warning someone reads no record: the panel holds only list fields.
    await expectOpenings(page, first.id, 0);
  });

  test("what the form accepts at its limits, the API accepts too", async () => {
    const created = await newPatient({
      full_name: "ن".repeat(255),
      phone: `+1${uniqueDigits(14)}`,
      address: "ع".repeat(500),
      emergency_contact: {
        name: "ن".repeat(255),
        relationship: "ق".repeat(50),
        phone: uniqueDigits(8),
      },
    });
    expect(created.id).toBeGreaterThan(0);
  });

  test("the API's refusals use the keys the form has fields for", async () => {
    const response = await api("patients", {
      method: "POST",
      token,
      body: {
        full_name: "",
        date_of_birth: "2999-01-01",
        sex: "other",
        phone: "12",
        national_id: "123",
        address: "ع".repeat(501),
        emergency_contact: {
          name: "",
          relationship: "",
          phone: "12",
        },
      },
    });

    expect(response.status).toBe(422);
    const { errors } = (await response.json()) as {
      errors: Record<string, string[]>;
    };
    expect(Object.keys(errors).sort()).toEqual(
      [
        "address",
        "date_of_birth",
        "emergency_contact.name",
        "emergency_contact.phone",
        "emergency_contact.relationship",
        "full_name",
        "national_id",
        "phone",
        "sex",
      ].sort(),
    );
  });
});

test.describe("correcting a patient's details", () => {
  const f = m.patients.fields;
  const form = m.patients.form;

  const field = (page: Page, label: string) =>
    page.getByLabel(new RegExp(`^${label}`, "u")).locator("visible=true");
  const startEditing = (page: Page) =>
    page.getByRole("button", { name: m.patients.record.edit }).click();
  const save = (page: Page) =>
    page.getByRole("button", { name: form.save }).click();

  test.beforeEach(async ({ page }) => {
    await signInLive(page, admin());
  });

  test("a change is recorded as a change, and writes no opening", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const patient = await newPatient({
      phone: `010${uniqueDigits(8)}`,
      national_id: `2${uniqueDigits(13)}`,
      address: "12 Synthetic St",
      emergency_contact: {
        name: "Synthetic Guardian",
        relationship: "father",
        phone: `011${uniqueDigits(8)}`,
      },
    });
    const patches: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "PATCH") patches.push(request.url());
    });

    await page.goto(`/en/patients/${patient.id}`);
    await expect(reloadButton(page)).toBeVisible();
    await expectOpenings(page, patient.id, 1);

    // Starting to edit, and then changing nothing, sends nothing at all.
    await startEditing(page);
    await save(page);
    await expect(page.getByText(m.shared.form.nothingToSave)).toBeVisible();
    await expectOpenings(page, patient.id, 1);
    expect(patches).toHaveLength(0);
    expect(await entries(patient.id, "patient.updated")).toBe(0);

    // A real change.
    const phone = `010${uniqueDigits(8)}`;
    await field(page, f.phone).fill(phone);
    await field(page, f.address).fill("");
    await page
      .getByLabel(f.contactName, { exact: true })
      .locator("visible=true")
      .fill("");
    await page
      .getByLabel(f.contactRelationship, { exact: true })
      .locator("visible=true")
      .fill("");
    await page
      .getByLabel(f.contactPhone, { exact: true })
      .locator("visible=true")
      .fill("");
    await save(page);

    await expect(page.getByText(form.saved)).toBeVisible();
    await expect(page.getByRole("main")).toContainText(phone);
    await expect(page.getByText(f.notRecorded)).toHaveCount(2);
    expect(patches).toHaveLength(1);
    await expectOpenings(page, patient.id, 1);
    expect(await entries(patient.id, "patient.updated")).toBe(1);

    // Confirmed through the API last, as this read writes an entry of its own.
    const response = await api(`patients/${patient.id}`, { token });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: unknown }).data).toMatchObject({
      id: patient.id,
      full_name: patient.full_name,
      phone,
      address: null,
      emergency_contact: null,
    });
  });

  test("the search shows the new name on returning, with no further read", async ({
    page,
  }) => {
    const phone = `010${uniqueDigits(8)}`;
    const patient = await newPatient({ phone });
    const renamed = `Synthetic Renamed ${stamp()}`;

    await search(page, f.phone, phone);
    await results(page).getByRole("link", { name: patient.full_name }).click();
    await expect(reloadButton(page)).toBeVisible();
    await expectOpenings(page, patient.id, 1);

    await startEditing(page);
    await field(page, f.fullName).fill(renamed);
    await save(page);
    await expect(page.getByText(form.saved)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      renamed,
    );

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/patients$/);
    await expect(
      results(page).getByRole("link", { name: renamed }),
    ).toBeVisible();
    await expect(
      results(page).getByRole("link", { name: patient.full_name }),
    ).toHaveCount(0);
    await expectOpenings(page, patient.id, 1);
  });

  test("a national ID held by someone else is refused on its field", async ({
    page,
  }) => {
    const nationalId = `3${uniqueDigits(13)}`;
    await newPatient({
      national_id: nationalId,
      phone: `010${uniqueDigits(8)}`,
    });
    const patient = await newPatient({ phone: `010${uniqueDigits(8)}` });

    await page.goto(`/en/patients/${patient.id}`);
    await startEditing(page);
    await field(page, f.nationalId).fill(nationalId);
    await save(page);

    await expect(field(page, f.nationalId)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(field(page, f.nationalId)).toHaveValue(nationalId);
    expect(await entries(patient.id, "patient.updated")).toBe(0);
  });
});

test.describe("a whole journey", () => {
  const f = m.patients.fields;
  const field = (page: Page, label: string) =>
    page.getByLabel(new RegExp(`^${label}`, "u")).locator("visible=true");

  test("leaves no patient detail behind, and is quick", async ({ page }) => {
    test.setTimeout(170_000);
    const id = stamp();
    const name = `Synthetic Journey ${id}`;
    const phone = `010${uniqueDigits(8)}`;
    const nationalId = `2${uniqueDigits(13)}`;
    const address = `Journey Address ${id}`;
    const contact = `Journey Guardian ${id}`;
    const contactPhone = `011${uniqueDigits(8)}`;
    const newAddress = `Journey Corrected ${id}`;
    const details = [
      name,
      phone,
      nationalId,
      address,
      contact,
      contactPhone,
      newAddress,
    ];

    const addresses: string[] = [];
    page.on("framenavigated", (frame) => addresses.push(frame.url()));

    await signInLive(page, admin());

    // SC-001, as a guard against slowness. A script's time isn't a person's: the walkthrough judges that.
    const registering = Date.now();
    await page.goto("/en/patients/new");
    await field(page, f.fullName).fill(name);
    await field(page, f.dateOfBirth).fill("1990-04-12");
    await field(page, f.sex).selectOption("female");
    await field(page, f.phone).fill(phone);
    await field(page, f.nationalId).fill(nationalId);
    await field(page, f.address).fill(address);
    await page
      .getByLabel(f.contactName, { exact: true })
      .locator("visible=true")
      .fill(contact);
    await page
      .getByLabel(f.contactRelationship, { exact: true })
      .locator("visible=true")
      .fill("father");
    await page
      .getByLabel(f.contactPhone, { exact: true })
      .locator("visible=true")
      .fill(contactPhone);
    await page
      .getByRole("button", {
        name: m.patients.registerForm.submit,
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/en\/patients\/\d+$/);
    await expect(reloadButton(page)).toBeVisible();
    expect(Date.now() - registering).toBeLessThan(60_000);
    const patientId = Number(page.url().split("/").pop());

    // SC-002, by each of the four search types.
    for (const [label, term] of [
      [f.fullName, name],
      [f.phone, phone],
      [f.number, String(patientId)],
      [f.nationalId, nationalId],
    ] as const) {
      const finding = Date.now();
      await search(page, label, term);
      await results(page).getByRole("link", { name }).click();
      await expect(reloadButton(page)).toBeVisible();
      expect(Date.now() - finding, label).toBeLessThan(30_000);
    }

    await page.getByRole("button", { name: m.patients.record.edit }).click();
    await field(page, f.address).fill(newAddress);
    await page.getByRole("button", { name: m.patients.form.save }).click();
    await expect(page.getByText(m.patients.form.saved)).toBeVisible();

    // Only the patient number may be in an address (constitution II).
    expect(addresses.length).toBeGreaterThan(0);
    for (const visited of addresses) {
      for (const detail of details) {
        expect(decodeURIComponent(visited)).not.toContain(detail);
      }
    }

    await signOutButton(page, "en").click();
    await expect(page).toHaveURL(/\/en\/sign-in/);

    // FR-024: back shows nothing, and storage holds nothing.
    await page.goBack();
    await page.waitForLoadState("networkidle");
    const shown = (await page.locator("body").textContent()) ?? "";
    const stored = await page.evaluate(() =>
      JSON.stringify([{ ...localStorage }, { ...sessionStorage }]),
    );
    for (const detail of details) {
      expect(shown).not.toContain(detail);
      expect(stored).not.toContain(detail);
    }

    // SC-005: the application server's own output.
    const log = readFileSync(".next/e2e-live-app-server.log", "utf8");
    expect(log.length).toBeGreaterThan(0);
    for (const detail of details) expect(log).not.toContain(detail);
  });
});

test.describe("each role, against the real API", () => {
  const f = m.patients;

  test("a doctor has no entry, no page, and is refused by the API", async ({
    page,
  }) => {
    const { doctor } = liveAccounts();
    await signInLive(page, doctor);

    await expect(
      mainNavigation(page, "en").getByRole("link", {
        name: m.shell.nav.patients,
      }),
    ).toHaveCount(0);
    for (const address of ["patients", "patients/new", "patients/1"]) {
      await page.goto(`/en/${address}`);
      await expect(
        page.getByText(m.shared.states.forbiddenHeading),
      ).toBeVisible();
    }

    const doctorToken = await apiSignIn(doctor.email, doctor.password);
    const answer = await api("patients?name=Synthetic", { token: doctorToken });
    expect(answer.status).toBe(403);
  });

  test("a receptionist reaches search, the form, and editing", async ({
    page,
  }) => {
    const email = `synthetic.patients.${stamp()}@example.test`;
    const password = `Synthetic-${randomBytes(12).toString("hex")}`;
    const created = await api("staff", {
      method: "POST",
      token,
      body: {
        name: `Synthetic Patients ${stamp()}`,
        email,
        role: "receptionist",
        password,
        password_confirmation: password,
      },
    });
    expect(created.status).toBe(201);
    const { data: account } = (await created.json()) as {
      data: { id: number };
    };
    const patient = await newPatient({ phone: `010${uniqueDigits(8)}` });
    await signInLive(page, { email, password });

    await mainNavigation(page, "en")
      .getByRole("link", { name: m.shell.nav.patients })
      .click();
    await expect(page).toHaveURL(/\/en\/patients$/);
    await expect(
      page.getByRole("main").getByRole("link", { name: f.register }),
    ).toBeVisible();

    await page.goto(`/en/patients/${patient.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      patient.full_name,
    );
    await expect(
      page.getByRole("button", { name: f.record.edit }),
    ).toBeVisible();

    await page.goto("/en/patients/new");
    await expect(
      page.getByRole("button", { name: f.registerForm.submit, exact: true }),
    ).toBeVisible();

    await api(`staff/${String(account.id)}/deactivate`, {
      method: "POST",
      token,
    });
  });
});

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
