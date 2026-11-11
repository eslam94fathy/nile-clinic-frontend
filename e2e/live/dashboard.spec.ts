import { expect, type Page, test } from "@playwright/test";
import { messages } from "../support/messages";
import {
  adminToken,
  api,
  apiSignIn,
  liveAccounts,
  signInLive,
} from "./support";

// The dashboards against the real API: every figure must equal the API's own total for the same filter, and opening,
// refreshing, and leaving a dashboard open must write nothing to the audit trail. Synthetic data only: see
// specs/012-role-dashboards/quickstart.md.
const m = messages.en;
const d = m.dashboard;
const INTERVAL = 15_000;

let token = "";

test.beforeAll(async () => {
  token = await adminToken();
});

const admin = () => ({
  email: process.env.LIVE_ADMIN_EMAIL ?? "",
  password: process.env.LIVE_ADMIN_PASSWORD ?? "",
});
const clinicDate = (offset = 0) => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year = 0, month = 1, day = 1] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset))
    .toISOString()
    .slice(0, 10);
};
const plain = (text: string | null) => (text ?? "").replace(/\s/g, " ");
const egp = (value: string) =>
  new Intl.NumberFormat("en-u-nu-latn", { style: "currency", currency: "EGP" })
    .format(value as `${number}`)
    .replace(/\s/g, " ");

/** A list's total for one filter, as the API counts it. */
async function total(path: string, as = token): Promise<number> {
  const response = await api(
    `${path}${path.includes("?") ? "&" : "?"}per_page=1`,
    { token: as },
  );
  expect(response.status, path).toBe(200);
  return ((await response.json()) as { meta: { total: number } }).meta.total;
}

const panel = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });
/** The value beside a label, inside one panel. */
const figure = (page: Page, panelName: string, label: string) =>
  panel(page, panelName)
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd[1]");

async function staffId(as: string): Promise<number> {
  const response = await api("auth/me", { token: as });
  return ((await response.json()) as { data: { id: number } }).data.id;
}

/**
 * Entries for one staff member, newest first, searched with the setup administrator's token. Its searches name that
 * administrator as actor and have no staff subject, so they can't match another account's.
 */
async function entriesFor(staff: number) {
  const response = await api(`audit-entries?staff_id=${staff}&per_page=100`, {
    token,
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: { id: number; action: string }[] })
    .data;
}

/** Refresh on every panel, then two real intervals with the page open. */
async function useTheDashboard(page: Page) {
  for (const button of await page
    .getByRole("button", { name: m.shared.lastRead.refresh })
    .all()) {
    await button.click();
  }
  await page.waitForTimeout(INTERVAL * 2 + 2_000);
}

test("the receptionist's figures are the API's, and the dashboard writes nothing", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const account = liveAccounts().receptionist;
  await signInLive(page, account);
  const staff = await staffId(await apiSignIn(account.email, account.password));
  // Signing in, here and through the page, writes entries of its own: count from after both.
  const newestBefore = (await entriesFor(staff))[0]?.id ?? 0;
  await page.reload();

  const today = clinicDate();
  const day = `from=${today}&to=${today}`;
  for (const [label, status] of [
    [d.appointments.toArrive, "scheduled"],
    [d.appointments.arrived, "checked_in"],
    [d.appointments.completed, "completed"],
    [d.appointments.noShow, "no_show"],
  ] as const) {
    await expect(
      figure(page, d.appointments.heading, label),
      status,
    ).toHaveText(String(await total(`appointments?${day}&status=${status}`)));
  }
  for (const status of ["waiting", "with_doctor", "seen", "left"] as const) {
    await expect(
      figure(page, d.queue.heading, m.shared.status.queue[status]),
      status,
    ).toHaveText(String(await total(`queue?status=${status}`)));
  }
  for (const status of ["none", "unpaid", "partially_paid"] as const) {
    await expect(
      figure(page, d.owed.heading, m.shared.status.charge[status]),
      status,
    ).toHaveText(
      String(await total(`visits?date=${today}&charge_status=${status}`)),
    );
  }
  await expect(figure(page, d.move.heading, d.move.total)).toHaveText(
    String(
      await total(
        `appointments?from=${today}&to=${clinicDate(90)}&outside_availability=1`,
      ),
    ),
  );

  await useTheDashboard(page);
  const added = (await entriesFor(staff)).filter(({ id }) => id > newestBefore);
  expect(added.map(({ action }) => action)).toEqual([]);
});

test("the doctor's figures are the API's, and the dashboard writes nothing", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const account = liveAccounts().doctor;
  await signInLive(page, account);
  const doctorToken = await apiSignIn(account.email, account.password);
  const staff = await staffId(doctorToken);
  const newestBefore = (await entriesFor(staff))[0]?.id ?? 0;
  await page.reload();

  const queue = await api("doctors/me/queue", { token: doctorToken });
  const entries = ((await queue.json()) as { data: { status: string }[] }).data;
  await expect(figure(page, d.waiting.heading, d.waiting.count)).toHaveText(
    String(entries.filter(({ status }) => status === "waiting").length),
  );

  const today = clinicDate();
  const period = `from=${clinicDate(-91)}&to=${today}`;
  for (const [label, status] of [
    [d.records.none, "none"],
    [d.records.draft, "draft"],
  ] as const) {
    await expect(figure(page, d.records.heading, label), status).toHaveText(
      String(
        await total(
          `doctors/me/visits?${period}&record_status=${status}`,
          doctorToken,
        ),
      ),
    );
  }

  await useTheDashboard(page);
  const added = (await entriesFor(staff)).filter(({ id }) => id > newestBefore);
  expect(added.map(({ action }) => action)).toEqual([]);
});

test("the administrator's figures are the reports', and the dashboard writes nothing", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signInLive(page, admin());
  const staff = await staffId(token);
  const newestBefore = (await entriesFor(staff))[0]?.id ?? 0;
  await page.reload();

  const today = clinicDate();
  const money = (await (
    await api(`reports/money-collected?from=${today}&to=${today}`, { token })
  ).json()) as { data: { totals: { received: string } } };
  await expect(
    figure(page, d.money.heading, m.reports.money.received),
  ).toBeVisible();
  expect(
    plain(
      await figure(
        page,
        d.money.heading,
        m.reports.money.received,
      ).textContent(),
    ),
  ).toBe(egp(money.data.totals.received));

  const activity = (await (
    await api(`reports/activity?from=${today}&to=${today}`, { token })
  ).json()) as {
    totals: { visits: { walk_in: number } };
  };
  await expect(
    figure(page, d.activity.heading, m.reports.activity.walkIn),
  ).toHaveText(String(activity.totals.visits.walk_in));

  await useTheDashboard(page);
  // Only the first count's own search is new, as that search is this account's: nothing the dashboard did was recorded.
  const added = (await entriesFor(staff)).filter(({ id }) => id > newestBefore);
  expect(added.map(({ action }) => action)).toEqual(["audit.searched"]);
});
