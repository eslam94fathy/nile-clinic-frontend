import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { messages } from "../support/messages";
import {
  adminToken,
  api,
  liveAccounts,
  liveDoctors,
  signInLive,
} from "./support";

// Billing against the real API: what a person sees, and how many permanent entries each action writes. These run on a
// production build, with this run's own billing doctor, who has a fee: see specs/009-billing-payments/quickstart.md.
const m = messages.en;
const b = m.billing;
const c = m.charges;
const CLINIC_ZONE = "Africa/Cairo";
const stamp = () => `${Date.now()}${randomBytes(2).toString("hex")}`;
const admin = () => ({
  email: process.env.LIVE_ADMIN_EMAIL ?? "",
  password: process.env.LIVE_ADMIN_PASSWORD ?? "",
});

let token = "";

test.beforeAll(async () => {
  token = await adminToken();
});

const clinicDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

type Patient = { id: number; full_name: string };

async function newPatient(): Promise<Patient> {
  const response = await api("patients", {
    method: "POST",
    token,
    body: {
      full_name: `Synthetic Live Billing ${stamp()}`,
      date_of_birth: "1990-04-12",
      sex: "female",
      phone: "01000000987",
    },
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: Patient }).data;
}

async function count(patient: number, action?: string): Promise<number> {
  const response = await api(
    `audit-entries?patient_id=${patient}${action ? `&action=${action}` : ""}&per_page=100`,
    { token },
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: unknown[] }).data.length;
}

async function walkIn(patient: number): Promise<number> {
  const response = await api("queue/walk-ins", {
    method: "POST",
    token,
    body: { patient_id: patient, doctor_id: liveDoctors().billing },
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { id: number } }).data.id;
}

async function charge(visit: number): Promise<number> {
  const response = await api(`visits/${visit}/charge`, {
    method: "POST",
    token,
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { id: number } }).data.id;
}

/** Each test starts with nobody waiting for this doctor, so that Billing's list for them is this test's alone. */
async function clearList() {
  const response = await api(`doctors/${liveDoctors().billing}/queue`, {
    token,
  });
  const { data } = (await response.json()) as {
    data: { id: number; status: string }[];
  };
  for (const entry of data) {
    if (entry.status === "waiting") {
      await api(`queue/${entry.id}/leave`, { method: "POST", token });
    }
  }
}

test.beforeEach(clearList);

const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).locator("visible=true").first();
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).locator("visible=true");
const field = (scope: Page | Locator, label: string) =>
  scope.getByLabel(label, { exact: false }).locator("visible=true");
/**
 * One form on a charge's page. The payment and refund forms share field names, as do the refund and discount forms,
 * so each is found within its own section.
 */
const section = (page: Page, heading: string) =>
  page.getByRole("region", { name: heading, exact: true });
const dialog = (page: Page) => page.getByRole("alertdialog");
const confirm = (page: Page, name: string) =>
  dialog(page).getByRole("button", { name, exact: true }).click();
/**
 * Opens a charge's page and waits for it to hydrate, which is when its forms enable their buttons. Typing before then
 * lands in front of the value React then gives the field, such as "350.00" becoming "350.0010".
 */
async function openCharge(page: Page, id: number) {
  await page.goto(`/en/charges/${id}`);
  await expect(page.locator('button[type="submit"]:disabled')).toHaveCount(0);
}
const fact = (page: Page, label: string) =>
  page
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd[1]")
    // Only what's on screen: an earlier page, such as Billing, stays mounted but hidden, with labels of its own.
    .locator("visible=true");
/** By its label, as a person does: the radio itself is visually hidden inside it. */
const chooseMethod = (
  form: Locator,
  method: keyof typeof m.shared.paymentMethod,
) =>
  form
    .getByRole("group")
    .getByText(m.shared.paymentMethod[method], { exact: true })
    .click();
async function pay(
  page: Page,
  amount: string,
  method: keyof typeof m.shared.paymentMethod,
) {
  await field(section(page, c.payment.heading), c.payment.amountLabel).fill(
    amount,
  );
  await chooseMethod(section(page, c.payment.heading), method);
  await button(page, c.payment.submit).click();
  await confirm(page, c.payment.confirm);
}

test.describe("billing, against the real API", () => {
  test("reading Billing, Charges, and a charge writes nothing", async ({
    page,
  }) => {
    const patient = await newPatient();
    const id = await charge(await walkIn(patient.id));
    const before = await count(patient.id);

    await signInLive(page, liveAccounts().receptionist);
    for (const address of [
      `/en/billing?doctor_id=${liveDoctors().billing}`,
      `/en/charges?patient_id=${patient.id}`,
      `/en/charges/${id}`,
    ]) {
      await page.goto(address);
      await expect(shown(page, patient.full_name)).toBeVisible();
      await page.reload();
      await expect(shown(page, patient.full_name)).toBeVisible();
    }

    expect(await count(patient.id)).toBe(before);
    expect(await count(patient.id, "patient.opened")).toBe(0);
  });

  test("charging and paying in two parts writes one entry each, and opens nobody", async ({
    page,
  }) => {
    const patient = await newPatient();
    await walkIn(patient.id);
    const visited: string[] = [];
    page.on("framenavigated", (frame) => visited.push(frame.url()));

    await signInLive(page, liveAccounts().receptionist);
    await page.goto(`/en/billing?doctor_id=${liveDoctors().billing}`);
    await expect(shown(page, patient.full_name)).toBeVisible();
    await button(page, b.charge.action).click();

    await expect(page).toHaveURL(/\/en\/charges\/\d+$/);
    await expect(fact(page, c.details.fee)).toContainText(
      liveDoctors().billingFee,
    );
    await expect(
      field(section(page, c.payment.heading), c.payment.amountLabel),
    ).toHaveValue(liveDoctors().billingFee);
    expect(await count(patient.id, "charge.created")).toBe(1);

    await pay(page, "150", "cash");
    await expect(fact(page, c.details.status)).toHaveText(
      m.shared.status.charge.partially_paid,
    );
    await pay(page, "200", "card");
    await expect(fact(page, c.details.status)).toHaveText(
      m.shared.status.charge.paid,
    );
    await expect(fact(page, c.details.balance)).toContainText("0.00");

    expect(await count(patient.id, "payment.recorded")).toBe(2);
    expect(await count(patient.id, "patient.opened")).toBe(0);

    for (const url of visited) {
      const address = decodeURIComponent(url);
      expect(address).not.toContain(patient.full_name);
      expect(address).not.toContain("01000000987");
      expect(address).not.toMatch(/150|200\.00|amount/);
    }
  });

  test("an administrator's discount and refund write one entry each, leaving the fee and payment", async ({
    page,
  }) => {
    const patient = await newPatient();
    const id = await charge(await walkIn(patient.id));
    await api(`charges/${id}/payments`, {
      method: "POST",
      token,
      body: { amount: "100", method: "cash" },
    });
    const reason = `Synthetic live overpayment ${stamp()}`;

    await signInLive(page, admin());
    await openCharge(page, id);
    await field(section(page, c.discount.heading), c.discount.amountLabel).fill(
      "50",
    );
    await field(section(page, c.discount.heading), c.discount.reasonLabel).fill(
      "Synthetic live hardship",
    );
    await button(page, c.discount.submit).click();
    await expect(fact(page, c.details.amountDue)).toContainText("300.00");
    await expect(fact(page, c.details.fee)).toContainText(
      liveDoctors().billingFee,
    );

    await field(section(page, c.refund.heading), c.refund.amountLabel).fill(
      "20",
    );
    await chooseMethod(section(page, c.refund.heading), "card");
    await field(section(page, c.refund.heading), c.refund.reasonLabel).fill(
      reason,
    );
    await button(page, c.refund.submit).click();
    await confirm(page, c.refund.confirm);
    await expect(fact(page, c.details.amountPaid)).toContainText("80.00");
    await expect(
      page.getByRole("table", { name: c.details.paymentsCaption }),
    ).toContainText("100.00");

    expect(await count(patient.id, "discount.set")).toBe(1);
    expect(await count(patient.id, "refund.recorded")).toBe(1);

    expect(page.url()).not.toContain("Synthetic");
    const stored = await page.evaluate(() =>
      JSON.stringify([{ ...localStorage }, { ...sessionStorage }]),
    );
    expect(stored).not.toContain(reason);
    expect(stored).not.toContain(patient.full_name);

    // The application server's own output.
    const log = readFileSync(".next/e2e-live-app-server.log", "utf8");
    expect(log.length).toBeGreaterThan(0);
    expect(log).not.toContain(reason);
    expect(log).not.toContain(patient.full_name);
  });

  test("cancelling a charge with no money held writes one entry, and the visit can be charged again", async ({
    page,
  }) => {
    const patient = await newPatient();
    const visit = await walkIn(patient.id);
    const id = await charge(visit);

    await signInLive(page, liveAccounts().receptionist);
    await openCharge(page, id);
    await button(page, c.cancel.action).click();
    await dialog(page)
      .getByLabel(c.cancel.reasonLabel, { exact: false })
      .fill("Synthetic live mistaken charge");
    await confirm(page, c.cancel.confirm);
    await expect(page.getByRole("note")).toContainText(
      c.details.cancelledTitle,
    );
    expect(await count(patient.id, "charge.cancelled")).toBe(1);

    await page.goto(`/en/billing?doctor_id=${liveDoctors().billing}`);
    await expect(button(page, b.charge.action)).toBeVisible();
  });

  test("undoing a charged check-in is refused, with the API's message", async ({
    page,
  }) => {
    const patient = await newPatient();
    const date = clinicDate();
    const slots = await api(
      `doctors/${liveDoctors().billing}/slots?from=${date}&to=${date}`,
      { token },
    );
    const [slot] = ((await slots.json()) as { data: { start: string }[] }).data;
    test.skip(!slot, "No free time is left today, at the very end of the day.");
    const booked = await api("appointments", {
      method: "POST",
      token,
      body: {
        patient_id: patient.id,
        doctor_id: liveDoctors().billing,
        date,
        start: slot?.start,
      },
    });
    const appointment = ((await booked.json()) as { data: { id: number } }).data
      .id;
    const checkedIn = await api(`appointments/${appointment}/check-in`, {
      method: "POST",
      token,
    });
    const entry = ((await checkedIn.json()) as { data: { id: number } }).data
      .id;
    await charge(entry);

    await signInLive(page, liveAccounts().receptionist);
    await page.goto(`/en/queue?doctor_id=${liveDoctors().billing}`);
    await button(page, m.queue.undo.action).click();
    await confirm(page, m.queue.undo.confirm);
    await expect(dialog(page).getByRole("alert")).toBeVisible();
    await expect(dialog(page)).toBeVisible();

    const direct = await api(`queue/${entry}`, { method: "DELETE", token });
    expect(direct.status).toBe(422);
  });

  test("a receptionist's refund forced through is refused", async ({
    page,
  }) => {
    const patient = await newPatient();
    const id = await charge(await walkIn(patient.id));
    await api(`charges/${id}/payments`, {
      method: "POST",
      token,
      body: { amount: "10", method: "cash" },
    });

    await signInLive(page, liveAccounts().receptionist);
    await openCharge(page, id);
    await expect(
      page.getByRole("heading", { name: c.refund.heading }),
    ).toHaveCount(0);
    const status = await page.evaluate(async (chargeId) => {
      const response = await fetch(`/api/backend/charges/${chargeId}/refunds`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: "1",
          method: "cash",
          reason: "Synthetic",
        }),
      });
      return response.status;
    }, id);
    expect(status).toBe(403);
    expect(await count(patient.id, "refund.recorded")).toBe(0);
  });
});
