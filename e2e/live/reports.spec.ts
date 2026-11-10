import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "../support/messages";
import {
  adminToken,
  api,
  liveAccounts,
  liveDoctors,
  signInLive,
} from "./support";

// Reports against the real API: every figure shown must be the API's own, and opening them must write nothing to the
// audit trail. Synthetic data, with this run's billing doctor: see specs/010-reports/quickstart.md.
const m = messages.en;
const r = m.reports;
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
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const egp = (value: string) =>
  new Intl.NumberFormat("en-u-nu-latn", {
    style: "currency",
    currency: "EGP",
  })
    .format(value as `${number}`)
    .replace(/\s/g, " ");
const plain = (text: string | null) => (text ?? "").replace(/\s/g, " ");

async function post(path: string, body?: unknown): Promise<unknown> {
  const response = await api(path, { method: "POST", token, body });
  expect(response.status, path).toBeLessThan(300);
  return ((await response.json()) as { data: unknown }).data;
}

/** A visit charged, paid in two methods, and partly refunded, today, for the billing doctor. */
async function moneyToday() {
  const patient = (await post("patients", {
    full_name: `Synthetic Live Reports ${stamp()}`,
    date_of_birth: "1990-04-12",
    sex: "female",
    phone: "01000000986",
  })) as { id: number };
  const visit = (await post("queue/walk-ins", {
    patient_id: patient.id,
    doctor_id: liveDoctors().billing,
  })) as { id: number };
  const charge = (await post(`visits/${visit.id}/charge`)) as {
    id: number;
    balance: string;
  };
  await post(`charges/${charge.id}/payments`, {
    amount: "0.50",
    method: "cash",
  });
  const rest = (await (
    await api(`charges/${charge.id}`, { token })
  ).json()) as { data: { balance: string } };
  await post(`charges/${charge.id}/payments`, {
    amount: rest.data.balance,
    method: "card",
  });
  await post(`charges/${charge.id}/refunds`, {
    amount: "0.25",
    method: "cash",
    reason: "Synthetic live refund",
  });
  // Left at the end of the visit, so that the doctor's waiting list stays clear for other specs.
  await api(`queue/${visit.id}/leave`, { method: "POST", token });
}

async function report<T>(name: string, query: string): Promise<T> {
  const response = await api(`reports/${name}?${query}`, { token });
  expect(response.status).toBe(200);
  return (await response.json()) as T;
}

/** The value beside a label, in the first list of figures that has it. */
const figure = (page: Page, label: string) =>
  page
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd[1]")
    .locator("visible=true")
    .first();

async function myId(): Promise<number> {
  const response = await api("auth/me", { token });
  return ((await response.json()) as { data: { id: number } }).data.id;
}

/** This account's entries, newest first. The search writes one entry of its own, after it reads. */
async function myEntries(staff: number) {
  const response = await api(`audit-entries?staff_id=${staff}&per_page=100`, {
    token,
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: { id: number; action: string }[] })
    .data;
}

test("every figure is the API's, for the clinic and one doctor, and opening reports writes nothing", async ({
  page,
}) => {
  await moneyToday();
  const today = clinicDate();
  const doctor = liveDoctors().billing;
  const period = `from=${today}&to=${today}`;
  const withDoctor = `${period}&doctor_id=${doctor}`;

  await signInLive(page, admin());
  const staff = await myId();
  const before = await myEntries(staff);
  const newestBefore = before[0]?.id ?? 0;

  // Money collected, for the doctor.
  const money = await report<{
    data: { totals: { received: string; refunded: string; net: string } };
  }>("money-collected", withDoctor);
  await page.goto(`/en/reports/money-collected?${withDoctor}`);
  await expect(
    page.getByRole("img", { name: /Net money by day/ }),
  ).toBeVisible();
  expect(plain(await figure(page, r.money.received).textContent())).toBe(
    egp(money.data.totals.received),
  );
  expect(plain(await figure(page, r.money.refunded).textContent())).toContain(
    egp(money.data.totals.refunded),
  );
  expect(plain(await figure(page, r.money.net).textContent())).toContain(
    egp(money.data.totals.net),
  );
  await expect(page.getByText(r.money.doctorNote)).toBeVisible();

  // Charges by doctor, for the clinic.
  const billing = await report<{
    totals: Record<
      "fees" | "discounts" | "amount_due" | "amount_paid" | "balance",
      string
    > &
      Record<
        "active_charges" | "cancelled_charges" | "uncharged_seen_visits",
        number
      >;
  }>("billing", period);
  await page.goto(`/en/reports/billing?${period}`);
  for (const [label, key] of [
    [r.billing.fees, "fees"],
    [r.billing.discounts, "discounts"],
    [r.billing.amountDue, "amount_due"],
    [r.billing.amountPaid, "amount_paid"],
    [r.billing.balance, "balance"],
  ] as const) {
    expect(plain(await figure(page, label).textContent()), key).toBe(
      egp(billing.totals[key]),
    );
  }
  for (const [label, key] of [
    [r.billing.activeCharges, "active_charges"],
    [r.billing.cancelledCharges, "cancelled_charges"],
    [r.billing.unchargedSeenVisits, "uncharged_seen_visits"],
  ] as const) {
    // A count above zero needing attention also carries its badge, so the number leads.
    expect(plain(await figure(page, label).textContent()), key).toMatch(
      new RegExp(`^${String(billing.totals[key])}(\\D|$)`),
    );
  }

  // Activity: new patients for the clinic, and a note instead for one doctor.
  const activity = await report<{
    totals: {
      new_patients?: number;
      no_show_rate: number | null;
      visits: { walk_in: number; booked: number };
    };
  }>("activity", period);
  await page.goto(`/en/reports/activity?${period}`);
  await expect(figure(page, r.activity.newPatients)).toHaveText(
    String(activity.totals.new_patients),
  );
  await expect(
    figure(page, `${r.activity.visits}: ${r.activity.walkIn}`),
  ).toHaveText(String(activity.totals.visits.walk_in));
  await expect(
    figure(page, `${r.activity.visits}: ${r.activity.booked}`),
  ).toHaveText(String(activity.totals.visits.booked));
  await expect(figure(page, r.activity.noShowRate)).toHaveText(
    activity.totals.no_show_rate === null
      ? r.notAvailable
      : `${activity.totals.no_show_rate.toFixed(1)}%`,
  );
  await page.goto(`/en/reports/activity?${withDoctor}`);
  await expect(page.getByText(r.activity.newPatientsForClinic)).toBeVisible();

  // Times, for the doctor.
  const times = await report<{
    totals: { wait: { average_minutes: number | null; visits: number } };
  }>("times", withDoctor);
  await page.goto(`/en/reports/times?${withDoctor}`);
  const wait = await figure(page, r.times.wait).textContent();
  if (times.totals.wait.average_minutes === null) {
    expect(wait).toContain(r.notAvailable);
  } else {
    expect(wait).toContain(String(times.totals.wait.average_minutes));
  }

  // Only the first search's own entry is new: nothing the reports did was recorded.
  const after = await myEntries(staff);
  const added = after.filter(({ id }) => id > newestBefore);
  expect(added.map(({ action }) => action)).toEqual(["audit.searched"]);
});

for (const role of ["receptionist", "doctor"] as const) {
  test(`a ${role} is refused reports`, async ({ page }) => {
    await signInLive(page, liveAccounts()[role]);
    await page.goto("/en/reports/billing");
    await expect(
      page.getByText(m.shared.states.forbiddenHeading),
    ).toBeVisible();
  });
}
