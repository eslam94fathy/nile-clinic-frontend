import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { messages } from "../support/messages";
import { takeDoctorFromAccountToBookable } from "./journey-steps";
import { adminToken, api, liveAccounts, signInLive } from "./support";

// The clinic's whole day, across the three roles, through the screens only (Phase 13, FR-015). Each hand-off is
// visible to the next role. Kept in the live suite, and run before every release (docs/deployment.md).
// All data is synthetic; nothing can be deleted, so names carry a stamp and the new account ends deactivated.

type Locale = "ar" | "en";

const admin = () => ({
  email: process.env.LIVE_ADMIN_EMAIL ?? "",
  password: process.env.LIVE_ADMIN_PASSWORD ?? "",
});
const stamp = () => `${Date.now()}${randomBytes(2).toString("hex")}`;
const digits = (length: number) =>
  Array.from(randomBytes(length), (byte) => String(byte % 10)).join("");
const clinicDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const visibleLabel = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).locator("visible=true");
const startingWith = (page: Page, label: string) =>
  page.getByLabel(new RegExp(`^${label}`, "u")).locator("visible=true");
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).locator("visible=true");
const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).locator("visible=true").first();
const inDialog = (page: Page, name: string) =>
  page
    .getByRole("alertdialog")
    .getByRole("button", { name, exact: true })
    .click();
const region = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });
const fact = (page: Page, label: string) =>
  page
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd[1]")
    .locator("visible=true");

async function signedInPage(
  browser: Browser,
  account: { email: string; password: string },
  locale: Locale,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInLive(page, account, locale);
  // The page's direction follows its language at each role's first page.
  await expect(page.locator("html")).toHaveAttribute(
    "dir",
    locale === "ar" ? "rtl" : "ltr",
  );
  return page;
}

async function newSpecialty() {
  const id = stamp();
  const response = await api("specialties", {
    method: "POST",
    token: await adminToken(),
    body: { name_en: `Synthetic Day ${id}`, name_ar: `يوم تجريبي ${id}` },
  });
  expect(response.status).toBe(201);
  return (
    (await response.json()) as { data: { name_en: string; name_ar: string } }
  ).data;
}

async function deactivate(email: string) {
  const token = await adminToken();
  const response = await api("staff?role=doctor&per_page=100", { token });
  const { data } = (await response.json()) as {
    data: { id: number; email: string }[];
  };
  const found = data.find((row) => row.email === email);
  if (found)
    await api(`staff/${found.id}/deactivate`, { method: "POST", token });
}

async function auditCount(patient: number, action: string): Promise<number> {
  const response = await api(
    `audit-entries?patient_id=${patient}&action=${action}&per_page=100`,
    { token: await adminToken() },
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: unknown[] }).data.length;
}

for (const locale of ["ar", "en"] as const) {
  test(`the clinic's day, across every role, in ${locale}`, async ({
    browser,
  }) => {
    test.setTimeout(600_000);
    const m = messages[locale];
    const id = stamp();
    const doctorName = `Synthetic Day Doctor ${id}`;
    const patientName = `Synthetic Day Patient ${id}`;
    const phone = `010${digits(8)}`;
    const specialty = await newSpecialty();

    // 1. The administrator sets up a doctor until bookable, with a fee.
    const adminPage = await signedInPage(browser, admin(), locale);
    const doctor = await takeDoctorFromAccountToBookable(
      adminPage,
      locale,
      locale === "ar" ? specialty.name_ar : specialty.name_en,
      { name: doctorName, from: "00:00" },
    );

    // 2. The receptionist registers a patient, books today with that doctor, and checks them in.
    const desk = await signedInPage(
      browser,
      liveAccounts().receptionist,
      locale,
    );
    await desk.goto(`/${locale}/patients/new`);
    await startingWith(desk, m.patients.fields.fullName).fill(patientName);
    await startingWith(desk, m.patients.fields.dateOfBirth).fill("1990-04-12");
    await startingWith(desk, m.patients.fields.sex).selectOption("female");
    await startingWith(desk, m.patients.fields.phone).fill(phone);
    await button(desk, m.patients.registerForm.submit).click();
    await expect(desk).toHaveURL(new RegExp(`/${locale}/patients/\\d+$`));
    const patientId = Number(/\/patients\/(\d+)$/.exec(desk.url())?.[1]);

    await desk.goto(`/${locale}/appointments/new`);
    await visibleLabel(desk, m.patients.fields.number).fill(String(patientId));
    await button(desk, m.patients.search.button).click();
    await desk
      .getByRole("button", {
        name: m.patients.chooser.chooseNamed.replace("{name}", patientName),
      })
      .locator("visible=true")
      .first()
      .click();
    await visibleLabel(desk, m.doctors.name).fill(doctorName);
    await desk.getByRole("button", { name: m.doctors.chooser.find }).click();
    await desk
      .getByRole("button", {
        name: m.doctors.chooser.chooseNamed.replace("{name}", doctorName),
      })
      .locator("visible=true")
      .first()
      .click();
    const time = desk.getByRole("radio").locator("visible=true").first();
    await desk.locator("label", { has: time }).first().click();
    await expect(time).toBeChecked();
    await button(desk, m.appointments.booking.submit).click();
    await expect(desk).toHaveURL(new RegExp(`/${locale}/appointments/\\d+$`));

    await button(desk, m.appointments.checkIn.action).click();
    await expect(
      desk.locator("dl").getByText(m.shared.status.appointment.checked_in),
    ).toBeVisible();

    // 3. The doctor sees the patient waiting, calls them, writes, finalizes, corrects, and finishes.
    const room = await signedInPage(browser, doctor, locale);
    const recordReads: string[] = [];
    room.on("response", (response) => {
      if (
        response.request().method() === "GET" &&
        /\/api\/backend\/doctors\/me\/encounters\/\d+$/.test(response.url()) &&
        response.status() === 200
      ) {
        recordReads.push(response.url());
      }
    });
    await room.goto(`/${locale}/my/queue`);
    await expect(shown(room, patientName)).toBeVisible();
    await button(room, m.queue.own.callNext.action).click();
    await inDialog(room, m.queue.own.callNext.confirm);
    await expect(region(room, m.queue.own.currentHeading)).toContainText(
      patientName,
    );

    const e = m.encounters;
    await button(room, e.actions.start).click();
    await expect(visibleLabel(room, e.form.diagnosis)).toBeVisible();
    await visibleLabel(room, e.form.chiefComplaint).fill("Synthetic complaint");
    await visibleLabel(room, e.form.diagnosis).fill("Synthetic finding");
    await button(room, e.save.action).click();
    await expect(room.getByText(e.save.done)).toBeVisible();
    await button(room, e.finalize.action).click();
    await inDialog(room, e.finalize.confirm);
    await expect(shown(room, "Synthetic finding")).toBeVisible();
    await visibleLabel(room, e.addenda.label).fill("Synthetic correction");
    await button(room, e.addenda.add).click();
    await inDialog(room, e.addenda.confirm);
    await expect(shown(room, "Synthetic correction")).toBeVisible();

    await room.goto(`/${locale}/my/queue`);
    await button(room, m.queue.own.finish.action).click();
    await inDialog(room, m.queue.own.finish.confirm);
    await expect(shown(room, m.shared.status.queue.seen)).toBeVisible();

    // 4. The receptionist charges the visit and takes the whole fee.
    await desk.goto(`/${locale}/billing?doctor_id=${doctor.doctorId}`);
    await expect(shown(desk, patientName)).toBeVisible();
    await button(desk, m.billing.charge.action).click();
    await expect(desk).toHaveURL(new RegExp(`/${locale}/charges/\\d+$`));
    await expect(desk.locator('button[type="submit"]:disabled')).toHaveCount(0);
    const payment = region(desk, m.charges.payment.heading);
    await expect(
      payment.getByLabel(m.charges.payment.amountLabel, { exact: false }),
    ).toHaveValue("350.10");
    await payment
      .getByRole("group")
      .getByText(m.shared.paymentMethod.cash, { exact: true })
      .click();
    await button(desk, m.charges.payment.submit).click();
    await inDialog(desk, m.charges.payment.confirm);
    await expect(fact(desk, m.charges.details.status)).toHaveText(
      m.shared.status.charge.paid,
    );

    // 5. The administrator finds the money in the report, and the visit in the audit trail.
    const today = clinicDate();
    await adminPage.goto(
      `/${locale}/reports/money-collected?from=${today}&to=${today}&doctor_id=${doctor.doctorId}`,
    );
    await expect(
      adminPage
        .locator("dt", { hasText: new RegExp(`^${m.reports.money.received}$`) })
        .locator("xpath=following-sibling::dd[1]")
        .locator("visible=true")
        .first(),
    ).toContainText("350.10");

    await adminPage.goto(`/${locale}/audit`);
    await visibleLabel(adminPage, m.audit.filters.patient).fill(
      String(patientId),
    );
    await button(adminPage, m.audit.filters.search).click();
    await expect(adminPage.locator("article:visible").first()).toBeVisible();

    // Exactly the openings the doctor's screens made, and no more (ADR 0005). Starting hands the new record to the
    // page, so this journey may read it none at all: starting writes `encounter.started`, never an opening.
    expect(await auditCount(patientId, "encounter.started")).toBe(1);
    expect(await auditCount(patientId, "encounter.opened")).toBe(
      recordReads.length,
    );
    expect(await auditCount(patientId, "encounter.finalized")).toBe(1);
    expect(await auditCount(patientId, "payment.recorded")).toBe(1);

    // What the server printed during the day holds no patient detail, clinical text, or query string (FR-024).
    const log = readFileSync(".next/e2e-live-app-server.log", "utf8");
    for (const secret of [
      patientName,
      phone,
      "Synthetic complaint",
      "Synthetic finding",
      "Synthetic correction",
      `doctor_id=${doctor.doctorId}`,
      `from=${today}`,
      `patient_id=${patientId}`,
    ]) {
      expect(log).not.toContain(secret);
    }

    for (const page of [adminPage, desk, room]) await page.context().close();
    await deactivate(doctor.email);
  });
}

test.describe("each role is refused another's screens, and the API agrees", () => {
  const m = messages.en;
  const forbidden = m.shared.states.forbiddenHeading;

  async function expectRefused(page: Page, path: string) {
    await page.goto(`/en/${path}`);
    await expect(shown(page, forbidden)).toBeVisible();
  }

  test("a receptionist", async ({ page }) => {
    await signInLive(page, liveAccounts().receptionist);
    await expectRefused(page, "audit");
    await expectRefused(page, "my/visits");
    const forced = await page.request.get("/api/backend/audit-entries", {
      headers: { Accept: "application/json" },
    });
    expect(forced.status()).toBe(403);
  });

  test("a doctor", async ({ page }) => {
    await signInLive(page, liveAccounts().doctor);
    await expectRefused(page, "billing");
    await expectRefused(page, "staff");
    const forced = await page.request.get("/api/backend/staff", {
      headers: { Accept: "application/json" },
    });
    expect(forced.status()).toBe(403);
  });

  test("an administrator", async ({ page }) => {
    await signInLive(page, admin());
    await expectRefused(page, "my/queue");
    const forced = await page.request.get("/api/backend/doctors/me/queue", {
      headers: { Accept: "application/json" },
    });
    expect([403, 404]).toContain(forced.status());
  });
});
