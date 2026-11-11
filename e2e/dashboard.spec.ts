import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  ACCOUNTS,
  callsTo,
  control,
  fillSignIn,
  type Locale,
  resetBackend,
  script,
  PASSWORD,
  signIn,
  signOutButton,
} from "./support/auth";
import { messages } from "./support/messages";

// Phase 12's dashboards against the fake backend. Synthetic data only: see specs/012-role-dashboards/quickstart.md.

test.beforeEach(resetBackend);

const INTERVAL = 15_000;
const BETA = "Synthetic Patient Beta";
const GAMMA = "Synthetic Child Gamma";

const clinicToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const clearCalls = () => control("calls/clear");
/**
 * Waits until no request has arrived for half a second, then clears the counts, so that a read already under way
 * when a step begins isn't counted as that step's.
 */
async function quietThenClear() {
  let before = "";
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await allCalls());
        const same = now === before;
        before = now;
        return same;
      },
      { intervals: [500] },
    )
    .toBe(true);
  await clearCalls();
}
const allCalls = async () => (await control("calls")) as Record<string, number>;
const seedAppointment = (options: string) =>
  control(`clinic/appointment?${options}`) as Promise<{ id: number }>;
const seedEntry = (options: string) =>
  control(`clinic/queue-entry?${options}`) as Promise<{ id: number }>;
const seedReport = (name: string, body: unknown) =>
  control(
    `clinic/report?name=${name}&body=${encodeURIComponent(JSON.stringify(body))}`,
  );

/** Reads that write a permanent audit entry. A dashboard must never make one (FR-004). */
const AUDITED =
  /^(patients\/\d|doctors\/me\/encounters|doctors\/me\/patients|audit-entries)/;
async function expectNoAuditedRead() {
  const audited = Object.keys(await allCalls()).filter((endpoint) =>
    AUDITED.test(endpoint),
  );
  expect(audited).toEqual([]);
}

const panel = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true }).locator("visible=true");
/** A figure that links to its list is named "label: count". */
const linkedFigure = (scope: Locator, label: string, count: number) =>
  scope.getByRole("link", { name: `${label}: ${count}`, exact: true });
/** A figure without a link: the value beside its label. */
const figure = (scope: Locator, label: string) =>
  scope
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd[1]");

async function openWithClock(
  page: Page,
  account: "receptionist" | "doctor" | "administrator",
  locale: Locale = "en",
) {
  await page.clock.install();
  await signIn(page, account, locale);
}

test.describe("the receptionist's dashboard", () => {
  async function seedDesk() {
    await seedAppointment("days=0&status=scheduled&patient=2&start=10:00");
    await seedAppointment("days=0&status=no_show&patient=3&start=08:00");
    await seedEntry("patient=3&start=09:00&status=waiting");
    await seedEntry("patient=1&status=with_doctor");
    await control("clinic/charge?patient=2&payments=100.00");
    await control("clinic/charge?patient=1&payments=350.00");
    return seedAppointment("days=3&outside=1&patient=2&start=11:00");
  }

  for (const locale of ["en", "ar"] as const) {
    test(`shows the desk's day, each figure leading to its list, in ${locale}`, async ({
      page,
    }) => {
      const m = messages[locale];
      const d = m.dashboard;
      const moved = await seedDesk();
      await signIn(page, "receptionist", locale);

      const appointments = panel(page, d.appointments.heading);
      await expect(figure(appointments, d.appointments.toArrive)).toHaveText(
        "1",
      );
      await expect(figure(appointments, d.appointments.arrived)).toHaveText(
        "1",
      );
      await expect(figure(appointments, d.appointments.completed)).toHaveText(
        "0",
      );
      await expect(figure(appointments, d.appointments.noShow)).toHaveText("1");
      await expect(
        appointments.getByRole("list", { name: d.appointments.listLabel }),
      ).toContainText(BETA);

      const queue = panel(page, d.queue.heading);
      await expect(
        linkedFigure(queue, m.shared.status.queue.waiting, 1),
      ).toHaveAttribute("href", `/${locale}/queue?status=waiting`);
      await expect(
        linkedFigure(queue, m.shared.status.queue.with_doctor, 1),
      ).toBeVisible();
      await expect(
        linkedFigure(queue, m.shared.status.queue.seen, 2),
      ).toBeVisible();
      await expect(
        linkedFigure(queue, m.shared.status.queue.left, 0),
      ).toBeVisible();

      // "Not charged" counts every visit today with no charge, whatever its queue status (clarified 2026-11-11).
      const owed = panel(page, d.owed.heading);
      await expect(
        linkedFigure(owed, m.shared.status.charge.none, 2),
      ).toHaveAttribute("href", `/${locale}/billing?charge_status=none`);
      await expect(
        linkedFigure(owed, m.shared.status.charge.unpaid, 0),
      ).toBeVisible();
      await expect(
        linkedFigure(owed, m.shared.status.charge.partially_paid, 1),
      ).toBeVisible();

      const move = panel(page, d.move.heading);
      await expect(figure(move, d.move.total)).toHaveText("1");
      await expect(
        move.getByRole("link", { name: new RegExp(BETA) }),
      ).toHaveAttribute("href", `/${locale}/appointments/${moved.id}`);

      await expectNoAuditedRead();
    });
  }

  test("opens each owning screen with the figure's filter", async ({
    page,
  }) => {
    const d = messages.en.dashboard;
    await seedDesk();
    await signIn(page, "receptionist");

    await panel(page, d.queue.heading)
      .getByRole("link", { name: d.queue.link })
      .click();
    await expect(page).toHaveURL(/\/en\/queue$/);
    await page.goBack();

    await linkedFigure(
      panel(page, d.owed.heading),
      messages.en.shared.status.charge.partially_paid,
      1,
    ).click();
    await expect(page).toHaveURL(
      /\/en\/billing\?charge_status=partially_paid$/,
    );
    await page.goBack();

    await panel(page, d.move.heading)
      .getByRole("link", { name: d.move.link })
      .click();
    await expect(page).toHaveURL(/\/en\/appointments\?outside_availability=1$/);
    await page.goBack();

    await panel(page, d.appointments.heading)
      .getByRole("link", { name: new RegExp(BETA) })
      .click();
    await expect(page).toHaveURL(/\/en\/appointments\/\d+$/);
    await expectNoAuditedRead();
  });

  test("says so in words on an empty day", async ({ page }) => {
    const d = messages.en.dashboard;
    await signIn(page, "receptionist");
    await expect(panel(page, d.appointments.heading)).toContainText(
      d.appointments.empty,
    );
    await expect(panel(page, d.queue.heading)).toContainText(d.queue.empty);
    await expect(panel(page, d.owed.heading)).toContainText(d.owed.empty);
    await expect(panel(page, d.move.heading)).toContainText(d.move.empty);
  });
});

test.describe("the doctor's dashboard", () => {
  for (const locale of ["en", "ar"] as const) {
    test(`shows who is with the doctor and who is next, in ${locale}`, async ({
      page,
    }) => {
      const d = messages[locale].dashboard;
      await seedEntry("patient=2&status=with_doctor");
      await seedEntry("patient=3&status=waiting");
      await seedEntry("patient=1&status=waiting");
      const later = await seedAppointment(
        "days=0&status=scheduled&patient=3&start=15:00",
      );
      await control("clinic/encounter?patient=3&status=draft");
      await signIn(page, "doctor", locale);

      await expect(panel(page, d.now.heading)).toContainText(BETA);
      const waiting = panel(page, d.waiting.heading);
      await expect(figure(waiting, d.waiting.count)).toHaveText("2");
      const order = waiting
        .getByRole("list", { name: d.waiting.listLabel })
        .getByRole("listitem");
      await expect(order).toHaveCount(2);
      await expect(order.first()).toContainText(GAMMA);

      await expect(
        panel(page, d.later.heading).getByRole("link", {
          name: new RegExp(GAMMA),
        }),
      ).toHaveAttribute("href", `/${locale}/my/appointments/${later.id}`);

      // The patient with the doctor has no record yet; the seeded draft is the other.
      const records = panel(page, d.records.heading);
      await expect(linkedFigure(records, d.records.none, 1)).toHaveAttribute(
        "href",
        new RegExp(
          `/${locale}/my/visits\\?from=\\d{4}-\\d{2}-\\d{2}&to=${clinicToday()}&record_status=none$`,
        ),
      );
      await expect(linkedFigure(records, d.records.draft, 1)).toBeVisible();

      // Nothing here changes the queue: the only buttons are Refresh.
      const buttons = page
        .locator("main")
        .getByRole("button")
        .locator("visible=true");
      for (const name of await buttons.allTextContents()) {
        expect(name).toBe(messages[locale].shared.lastRead.refresh);
      }
      expect(await callsTo("doctors/me/queue/call-next")).toBe(0);
      await expectNoAuditedRead();
    });
  }

  test("a doctor without a profile sees that, and nothing is read", async ({
    page,
  }) => {
    await signIn(page, "newDoctor");
    await expect(
      page.getByText(messages.en.auth.noProfile.heading, { exact: true }),
    ).toBeVisible();
    for (const endpoint of [
      "doctors/me/queue",
      "doctors/me/appointments",
      "doctors/me/visits",
    ]) {
      expect(await callsTo(endpoint)).toBe(0);
    }
  });
});

test.describe("the administrator's dashboard", () => {
  const totals = {
    appointments: {
      scheduled: 4,
      cancelled: 1,
      no_show: 1,
      checked_in: 2,
      completed: 3,
    },
    no_show_rate: 16.7,
    visits: {
      waiting: 1,
      with_doctor: 1,
      seen: 3,
      left: 0,
      booked: 4,
      walk_in: 1,
    },
    new_patients: 2,
  };

  for (const locale of ["en", "ar"] as const) {
    test(`shows today's money and activity as the API sends them, in ${locale}`, async ({
      page,
    }) => {
      const m = messages[locale];
      const d = m.dashboard;
      await seedReport("money-collected", {
        totals: { received: "1250.50", refunded: "100.00", net: "1150.50" },
        by_method: [
          {
            method: "cash",
            received: "1000.50",
            refunded: "100.00",
            net: "900.50",
            staff: [],
          },
          {
            method: "card",
            received: "250.00",
            refunded: "0.00",
            net: "250.00",
            staff: [],
          },
        ],
        by_day: [],
      });
      await seedReport("activity", { rows: [], totals });
      await signIn(page, "administrator", locale);

      const money = panel(page, d.money.heading);
      await expect(figure(money, m.reports.money.received)).toContainText(
        "1,250.50",
      );
      await expect(figure(money, m.shared.paymentMethod.card)).toContainText(
        "250.00",
      );
      const activity = panel(page, d.activity.heading);
      await expect(
        figure(activity, m.reports.activity.noShowRate),
      ).toContainText("16.7");
      await expect(figure(activity, m.reports.activity.newPatients)).toHaveText(
        "2",
      );
      await expect(panel(page, d.move.heading)).toBeVisible();
      await expect(panel(page, d.queue.heading)).toHaveCount(0);

      // Both reports were read for today, and the links open them for today.
      const reads = (
        (await control("clinic/report-reads")) as {
          reads: { name: string; query: string }[];
        }
      ).reads;
      const today = clinicToday();
      expect(reads.map(({ name }) => name).sort()).toEqual([
        "activity",
        "money-collected",
      ]);
      for (const { query } of reads)
        expect(query).toContain(`from=${today}&to=${today}`);
      await expect(
        money.getByRole("link", { name: d.money.link }),
      ).toHaveAttribute(
        "href",
        `/${locale}/reports/money-collected?from=${today}&to=${today}`,
      );
      await expectNoAuditedRead();
    });
  }

  test("reads nothing by itself, and Refresh reads only its own panel", async ({
    page,
  }) => {
    const d = messages.en.dashboard;
    await openWithClock(page, "administrator");
    await expect(
      panel(page, d.money.heading).getByText(messages.en.shared.lastRead.label),
    ).toBeVisible();

    await quietThenClear();
    await page.clock.fastForward(INTERVAL * 3);
    await page.waitForTimeout(300);
    expect(await allCalls()).toEqual({});

    await panel(page, d.activity.heading)
      .getByRole("button", { name: messages.en.shared.lastRead.refresh })
      .click();
    await expect.poll(() => callsTo("reports/activity")).toBe(1);
    expect(await callsTo("reports/money-collected")).toBe(0);
    expect(await callsTo("appointments")).toBe(0);
  });
});

test.describe("a panel's failure stays in that panel", () => {
  test("a failed read, Try again, and figures kept when a later read fails", async ({
    page,
  }) => {
    const m = messages.en;
    const d = m.dashboard;
    await seedEntry("patient=2&status=waiting");
    await script("queue", 500);
    await openWithClock(page, "receptionist");

    const queue = panel(page, d.queue.heading);
    await expect(queue.getByRole("alert")).toContainText(
      m.shared.states.errorHeading,
    );
    // The others are unaffected.
    await expect(
      linkedFigure(panel(page, d.owed.heading), m.shared.status.charge.none, 1),
    ).toBeVisible();

    await script("queue", 0);
    await quietThenClear();
    await queue.getByRole("button", { name: m.shared.states.retry }).click();
    await expect(
      linkedFigure(queue, m.shared.status.queue.waiting, 1),
    ).toBeVisible();
    expect(await callsTo("queue")).toBe(4);
    expect(await callsTo("visits")).toBe(0);
    expect(await callsTo("appointments")).toBe(0);

    await script("visits", 500);
    await page.clock.fastForward(INTERVAL);
    const owed = panel(page, d.owed.heading);
    await expect(owed.getByText(m.shared.lastRead.outOfDate)).toBeVisible();
    await expect(
      linkedFigure(owed, m.shared.status.charge.none, 1),
    ).toBeVisible();
  });

  test("a refusal shows the forbidden state, clears the figures, and stops reading", async ({
    page,
  }) => {
    const m = messages.en;
    const d = m.dashboard;
    await seedEntry("patient=2&status=waiting");
    await openWithClock(page, "receptionist");
    const queue = panel(page, d.queue.heading);
    await expect(
      linkedFigure(queue, m.shared.status.queue.waiting, 1),
    ).toBeVisible();

    await script("queue", 403);
    await page.clock.fastForward(INTERVAL);
    await expect(
      queue.getByText(m.shared.states.forbiddenHeading),
    ).toBeVisible();
    await expect(
      linkedFigure(queue, m.shared.status.queue.waiting, 1),
    ).toHaveCount(0);
    await expect(
      panel(page, d.appointments.heading).getByText(
        m.shared.states.forbiddenHeading,
      ),
    ).toHaveCount(0);

    await quietThenClear();
    await page.clock.fastForward(INTERVAL);
    await page.clock.fastForward(INTERVAL);
    await page.waitForTimeout(300);
    expect(await callsTo("queue")).toBe(0);
    expect(await callsTo("visits")).toBeGreaterThanOrEqual(1);
  });

  test("a doctor's 404 says the profile can't be found, in the panels that read it", async ({
    page,
  }) => {
    const d = messages.en.dashboard;
    await script("doctors/me/queue", 404);
    await signIn(page, "doctor");
    await expect(panel(page, d.now.heading)).toContainText(
      d.panel.profileNotFound,
    );
    await expect(panel(page, d.records.heading)).not.toContainText(
      d.panel.profileNotFound,
    );
  });

  test("a lapsed session follows the sign-in flow, and returns to the dashboard", async ({
    page,
  }) => {
    await openWithClock(page, "receptionist");
    await expect(
      panel(page, messages.en.dashboard.queue.heading),
    ).toBeVisible();
    // Ended elsewhere: the API now refuses this session's token, and the next read finds out.
    await control(`revoke?email=${ACCOUNTS.receptionist}`);
    await page.clock.fastForward(INTERVAL);
    await expect(page).toHaveURL(/\/en\/sign-in\?ended=1&return=%2Fdashboard$/);
    await expect(
      page.getByText(messages.en.auth.signIn.sessionEnded),
    ).toBeVisible();

    await fillSignIn(page, "en", ACCOUNTS.receptionist, PASSWORD);
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(
      panel(page, messages.en.dashboard.queue.heading),
    ).toBeVisible();
  });
});

test.describe("when panels read", () => {
  test("the desk's panels read each interval while visible, and not while hidden", async ({
    page,
  }) => {
    await openWithClock(page, "receptionist");
    await expect(
      panel(page, messages.en.dashboard.queue.heading),
    ).toBeVisible();

    await quietThenClear();
    await page.clock.fastForward(INTERVAL);
    await expect.poll(() => callsTo("queue")).toBe(4);

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    });
    await quietThenClear();
    await page.clock.fastForward(INTERVAL * 2);
    await page.waitForTimeout(300);
    expect(await allCalls()).toEqual({});
  });

  test("the doctor's panels read each interval too", async ({ page }) => {
    await openWithClock(page, "doctor");
    await expect(
      panel(page, messages.en.dashboard.waiting.heading),
    ).toBeVisible();
    await quietThenClear();
    await page.clock.fastForward(INTERVAL);
    await expect.poll(() => callsTo("doctors/me/queue")).toBe(1);
    await expect.poll(() => callsTo("doctors/me/visits")).toBe(2);
  });

  test("after signing out and in as another role, only that role's panels appear", async ({
    page,
  }) => {
    const d = messages.en.dashboard;
    await seedEntry("patient=2&status=waiting");
    await signIn(page, "receptionist");
    await expect(
      linkedFigure(
        panel(page, d.queue.heading),
        messages.en.shared.status.queue.waiting,
        1,
      ),
    ).toBeVisible();

    await signOutButton(page, "en").click();
    await expect(page).toHaveURL(/\/en\/sign-in/);
    await signIn(page, "administrator");
    await expect(panel(page, d.money.heading)).toBeVisible();
    await expect(
      page.getByRole("region", { name: d.queue.heading }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: d.owed.heading }),
    ).toHaveCount(0);
  });
});
