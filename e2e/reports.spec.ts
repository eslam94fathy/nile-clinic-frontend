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
const r = m.reports;

const clinicToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const monthStart = (date: string) => `${date.slice(0, 8)}01`;

const REPORT_ENDPOINTS = [
  "reports/money-collected",
  "reports/billing",
  "reports/activity",
  "reports/times",
] as const;

async function reportReads(): Promise<{ name: string; query: string }[]> {
  const answer = (await control("clinic/report-reads")) as {
    reads: { name: string; query: string }[];
  };
  return answer.reads;
}
async function allReportCalls(): Promise<number> {
  let total = 0;
  for (const endpoint of REPORT_ENDPOINTS) total += await callsTo(endpoint);
  return total;
}
const seedReport = (name: string, body: unknown, doctor?: number) =>
  control(
    `clinic/report?name=${name}${doctor ? `&doctor=${doctor}` : ""}&body=${encodeURIComponent(JSON.stringify(body))}`,
  );

/** Hidden pages stay mounted after a soft navigation, so only what's on screen counts. */
const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).locator("visible=true").first();
const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).locator("visible=true");
/** A figure: the value beside its label, in the first list that has it. */
const figure = (page: Page, label: string) =>
  page
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd[1]")
    .locator("visible=true")
    .first();
const tab = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: r.tabs.label })
    .getByRole("link", { name, exact: true });
const plain = (text: string | null) => (text ?? "").replace(/\s/g, " ");

const money = (received: string, refunded: string, net: string) => ({
  received,
  refunded,
  net,
});
const MONEY = {
  totals: money("1234567.89", "400.00", "1234167.89"),
  by_method: [
    {
      method: "cash",
      ...money("350.00", "400.00", "-50.00"),
      staff: [
        {
          id: 2,
          name: "Synthetic Reception",
          ...money("350.00", "400.00", "-50.00"),
        },
      ],
    },
    {
      method: "card",
      ...money("1234217.89", "0.00", "1234217.89"),
      staff: [
        {
          id: 1,
          name: "Synthetic Admin",
          ...money("1234217.89", "0.00", "1234217.89"),
        },
      ],
    },
  ],
  by_day: [] as {
    date: string;
    received: string;
    refunded: string;
    net: string;
  }[],
};
function moneyFor(from: string) {
  const second = `${from.slice(0, 8)}02`;
  return {
    ...MONEY,
    by_day: [
      { date: from, ...money("1234567.89", "0.00", "1234567.89") },
      { date: second, ...money("0.00", "400.00", "-400.00") },
    ],
  };
}

const billingFigures = (changes = {}) => ({
  active_charges: 2,
  fees: "700.00",
  discounts: "50.00",
  amount_due: "650.00",
  amount_paid: "300.00",
  balance: "350.00",
  cancelled_charges: 1,
  uncharged_seen_visits: 1,
  ...changes,
});
const doctorRow = (id: number, name: string, figures: object) => ({
  doctor: { id, name, title: "Consultant" },
  ...figures,
});

test.describe("who can reach reports", () => {
  for (const role of ["receptionist", "doctor"] as const) {
    test(`a ${role} has no Reports navigation, and is refused with no report read`, async ({
      page,
    }) => {
      await signIn(page, role);
      await expect(
        mainNavigation(page, "en").getByRole("link", {
          name: m.shell.nav.reports,
        }),
      ).toHaveCount(0);

      for (const path of ["/en/reports", "/en/reports/billing"]) {
        await page.goto(path);
        await expect(
          page.getByText(m.shared.states.forbiddenHeading),
        ).toBeVisible();
      }
      expect(await allReportCalls()).toBe(0);
    });
  }

  test("an administrator opens all four, and an unknown report is not found", async ({
    page,
  }) => {
    await signIn(page, "administrator");
    await mainNavigation(page, "en")
      .getByRole("link", { name: m.shell.nav.reports })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(r.title);
    await expect(tab(page, r.tabs["money-collected"])).toHaveAttribute(
      "aria-current",
      "page",
    );

    for (const name of [r.tabs.billing, r.tabs.activity, r.tabs.times]) {
      await tab(page, name).click();
      await expect(tab(page, name)).toHaveAttribute("aria-current", "page");
      await expect(shown(page, r.allDoctors)).toBeVisible();
    }

    await page.goto("/en/reports/unknown");
    await expect(page.getByText(m.shared.states.notFoundHeading)).toBeVisible();
  });
});

test.describe("choosing the period and doctor", () => {
  test("opens on this month, reading once", async ({ page }) => {
    await signIn(page, "administrator");
    await page.goto("/en/reports");
    await expect(shown(page, r.money.totals)).toBeVisible();

    const today = clinicToday();
    expect(await reportReads()).toEqual([
      {
        name: "money-collected",
        query: `from=${monthStart(today)}&to=${today}`,
      },
    ]);
    await expect(field(page, r.choices.from)).toHaveValue(monthStart(today));
    await expect(
      page.getByRole("link", { name: r.choices.shortcuts.thisMonth }),
    ).toHaveAttribute("aria-current", "true");
  });

  test("shortcuts set both dates, and each choice reads once", async ({
    page,
  }) => {
    await signIn(page, "administrator");
    await page.goto("/en/reports/billing");
    await expect(shown(page, r.allDoctors)).toBeVisible();
    await control("calls/clear");

    await page
      .getByRole("link", { name: r.choices.shortcuts.today, exact: true })
      .click();
    const today = clinicToday();
    await expect(page).toHaveURL(
      new RegExp(`/en/reports/billing\\?from=${today}&to=${today}$`),
    );
    await expect.poll(() => callsTo("reports/billing")).toBe(1);

    await field(page, r.choices.doctor).selectOption({
      label: "Synthetic Doctor",
    });
    await page.getByRole("button", { name: r.choices.apply }).click();
    await expect(page).toHaveURL(/doctor_id=1/);
    await expect.poll(() => callsTo("reports/billing")).toBe(2);
  });

  test("tabs carry the period and doctor, drop the page, and survive reload and back", async ({
    page,
  }) => {
    await signIn(page, "administrator");
    await page.goto(
      "/en/reports/billing?from=2026-10-01&to=2026-10-31&doctor_id=1&page=2",
    );
    await tab(page, r.tabs.activity).click();
    await expect(page).toHaveURL(
      /\/en\/reports\/activity\?from=2026-10-01&to=2026-10-31&doctor_id=1$/,
    );

    await page.reload();
    await expect(field(page, r.choices.from)).toHaveValue("2026-10-01");
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/reports\/billing\?.*page=2/);
    await expect(field(page, r.choices.to)).toHaveValue("2026-10-31");
  });

  for (const [label, query, fieldLabel, message] of [
    [
      "367 days",
      "from=2025-01-01&to=2026-01-02",
      r.choices.to,
      r.range.tooLong,
    ],
    [
      "a reversed period",
      "from=2026-10-05&to=2026-10-04",
      r.choices.to,
      r.range.reversed,
    ],
    ["one date alone", "from=2026-10-05", r.choices.to, r.range.missingTo],
  ] as const) {
    test(`${label} is told on the date, with no request sent`, async ({
      page,
    }) => {
      await signIn(page, "administrator");
      await page.goto(`/en/reports/times?${query}`);

      await expect(shown(page, message)).toBeVisible();
      await expect(field(page, fieldLabel)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(await allReportCalls()).toBe(0);
    });
  }

  test("a refusal from the API is shown on its date, and the choices stay usable", async ({
    page,
  }) => {
    await script("reports/times", 422, "to");
    await signIn(page, "administrator");
    await page.goto("/en/reports/times?from=2026-10-01&to=2026-10-31");

    await expect(shown(page, "Scripted 422.")).toBeVisible();
    await expect(field(page, r.choices.to)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(field(page, r.choices.to)).toHaveAccessibleDescription(
      /Scripted 422\./,
    );
    await expect(field(page, r.choices.from)).toBeEditable();
  });

  test("a refusal with no field is shown for the form", async ({ page }) => {
    await script("reports/times", 422);
    await signIn(page, "administrator");
    await page.goto("/en/reports/times?from=2026-10-01&to=2026-10-31");

    await expect(shown(page, "Scripted 422.")).toBeVisible();
    await expect(field(page, r.choices.to)).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("an unknown doctor gets a neutral notice, and all doctors keeps the period", async ({
    page,
  }) => {
    await signIn(page, "administrator");
    await page.goto(
      "/en/reports/money-collected?from=2026-10-01&to=2026-10-31&doctor_id=999",
    );
    await expect(shown(page, r.doctorNotFound)).toBeVisible();

    await page.getByRole("link", { name: r.showAllDoctors }).click();
    await expect(page).toHaveURL(
      /\/en\/reports\/money-collected\?from=2026-10-01&to=2026-10-31$/,
    );
    await expect(shown(page, r.money.totals)).toBeVisible();
  });

  test("reads on Refresh only: never on the clock, on focus, or on reconnect", async ({
    page,
  }) => {
    await signIn(page, "administrator");
    await page.clock.install();
    await page.goto("/en/reports/activity");
    await expect(shown(page, r.allDoctors)).toBeVisible();
    await control("calls/clear");

    await page.clock.fastForward(10 * 60_000);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(300);
    expect(await allReportCalls()).toBe(0);

    await page.getByRole("button", { name: m.shared.lastRead.refresh }).click();
    await expect.poll(() => callsTo("reports/activity")).toBe(1);
  });

  test("a failed Refresh keeps the figures, with a notice", async ({
    page,
  }) => {
    await seedReport("billing", {
      rows: [doctorRow(1, "Synthetic Doctor", billingFigures())],
      totals: billingFigures({ fees: "9999.00" }),
    });
    await signIn(page, "administrator");
    await page.goto("/en/reports/billing");
    await expect(figure(page, r.billing.fees)).toContainText("9,999.00");

    await script("reports/billing", 422);
    await page.getByRole("button", { name: m.shared.lastRead.refresh }).click();
    await expect(
      page.getByText(m.shared.lastRead.outOfDateOnDemand),
    ).toBeVisible();
    await expect(figure(page, r.billing.fees)).toContainText("9,999.00");
  });
});

test.describe("money collected", () => {
  test("shows the totals, by day with a chart, and by method with staff, exactly", async ({
    page,
  }) => {
    const from = monthStart(clinicToday());
    await seedReport("money-collected", moneyFor(from));
    await signIn(page, "administrator");
    await page.goto("/en/reports");

    expect(plain(await figure(page, r.money.received).textContent())).toBe(
      "EGP 1,234,567.89",
    );
    const chart = page.getByRole("img", { name: /Net money by day/ });
    await expect(chart).toBeVisible();
    await expect(
      page
        .getByRole("table", { name: r.money.byDayCaption })
        .locator("tbody tr"),
    ).toHaveCount(2);
    // A column per day of the period, and only the two days with movement have a net.
    const titled = chart.locator("[title]");
    const titles = await titled.evaluateAll((columns) =>
      columns.map((column) => column.getAttribute("title") ?? ""),
    );
    expect(titles.filter((title) => /\d\.\d{2}/.test(title))).toHaveLength(2);
    await expect(
      page.getByRole("heading", { name: m.shared.paymentMethod.card }),
    ).toBeVisible();
    await expect(shown(page, "Synthetic Admin")).toBeVisible();
    await expect(
      page.locator(".sr-only", { hasText: r.negative }).first(),
    ).toBeAttached();

    await page.goto("/ar/reports");
    await expect(
      page
        .locator(".sr-only", { hasText: messages.ar.reports.negative })
        .first(),
    ).toBeAttached();
  });

  test("starts the chart at the inline start, in both directions", async ({
    page,
  }) => {
    const from = monthStart(clinicToday());
    await seedReport("money-collected", moneyFor(from));
    await signIn(page, "administrator");

    for (const locale of ["en", "ar"] as const) {
      await page.goto(`/${locale}/reports`);
      const columns = page
        .getByRole("img", { name: /Net money by day|صافي الأموال/ })
        .locator("[title]");
      const first = await columns.first().boundingBox();
      const last = await columns.last().boundingBox();
      expect(first && last).toBeTruthy();
      if (!first || !last) continue;
      if (locale === "en") expect(first.x).toBeLessThan(last.x);
      else expect(first.x).toBeGreaterThan(last.x);
    }
  });

  test("with a doctor, says only that doctor's charges count", async ({
    page,
  }) => {
    await signIn(page, "administrator");
    await page.goto("/en/reports?doctor_id=1");
    await expect(shown(page, r.money.doctorNote)).toBeVisible();
    expect((await reportReads())[0]?.query).toContain("doctor_id=1");
  });

  test("an empty period says so", async ({ page }) => {
    await signIn(page, "administrator");
    await page.goto("/en/reports");
    await expect(shown(page, r.money.emptyTitle)).toBeVisible();
    // The shell's logo is an image too, so the chart is found by its name.
    await expect(
      page.getByRole("img", { name: /Net money by day/ }),
    ).toHaveCount(0);
  });
});

test.describe("charges by doctor", () => {
  test("rows and totals match, the totals stay across pages, and need attention is marked", async ({
    page,
  }) => {
    const rows = Array.from({ length: 16 }, (_, index) =>
      doctorRow(
        index + 1,
        `Synthetic Doctor ${String(index + 1).padStart(2, "0")}`,
        billingFigures(),
      ),
    );
    await seedReport("billing", {
      rows,
      totals: billingFigures({ fees: "11200.00", uncharged_seen_visits: 16 }),
    });
    await signIn(page, "administrator");
    await page.goto("/en/reports/billing");

    await expect(figure(page, r.billing.fees)).toContainText("11,200.00");
    await expect(figure(page, r.billing.unchargedSeenVisits)).toContainText(
      r.needsAttention,
    );
    await expect(shown(page, "Synthetic Doctor 01")).toBeVisible();

    await page
      .getByRole("link", { name: m.shared.table.next })
      .locator("visible=true")
      .click();
    await expect(page).toHaveURL(/page=2/);
    await expect(shown(page, "Synthetic Doctor 16")).toBeVisible();
    await expect(figure(page, r.billing.fees)).toContainText("11,200.00");

    await page.reload();
    await expect(shown(page, "Synthetic Doctor 16")).toBeVisible();
    await page.goBack();
    await expect(shown(page, "Synthetic Doctor 01")).toBeVisible();
  });

  test("an empty period says so", async ({ page }) => {
    await signIn(page, "administrator");
    await page.goto("/en/reports/billing");
    await expect(shown(page, r.billing.emptyTitle)).toBeVisible();
  });
});

test.describe("activity", () => {
  const activity = (changes = {}) => ({
    appointments: {
      scheduled: 1,
      cancelled: 2,
      no_show: 3,
      checked_in: 4,
      completed: 5,
    },
    no_show_rate: 25,
    visits: {
      waiting: 6,
      with_doctor: 7,
      seen: 8,
      left: 9,
      booked: 10,
      walk_in: 11,
    },
    ...changes,
  });

  test("figures match, and a missing rate is not available", async ({
    page,
  }) => {
    await seedReport("activity", {
      rows: [doctorRow(1, "Synthetic Doctor", activity())],
      totals: { ...activity({ no_show_rate: null }), new_patients: 4 },
    });
    await signIn(page, "administrator");
    await page.goto("/en/reports/activity");

    await expect(figure(page, r.activity.noShowRate)).toHaveText(
      r.notAvailable,
    );
    await expect(figure(page, r.activity.newPatients)).toHaveText("4");
    await expect(shown(page, "25.0%")).toBeVisible();
  });

  test("an empty period says so", async ({ page }) => {
    await signIn(page, "administrator");
    await page.goto("/en/reports/activity");
    await expect(shown(page, r.activity.emptyTitle)).toBeVisible();
  });

  test("with a doctor, new patients is a note, not a number", async ({
    page,
  }) => {
    await seedReport("activity", {
      rows: [],
      totals: { ...activity(), new_patients: 4 },
    });
    await signIn(page, "administrator");
    await page.goto("/en/reports/activity?doctor_id=1");

    await expect(shown(page, r.activity.newPatientsForClinic)).toBeVisible();
    await expect(
      page.locator("dt", {
        hasText: new RegExp(`^${r.activity.newPatients}$`),
      }),
    ).toHaveCount(0);
  });
});

test.describe("times", () => {
  test("an empty period says so", async ({ page }) => {
    await signIn(page, "administrator");
    await page.goto("/en/reports/times");
    await expect(shown(page, r.times.emptyTitle)).toBeVisible();
  });

  test("figures match, missing averages are not available, and records needing attention are marked", async ({
    page,
  }) => {
    const times = {
      wait: { average_minutes: 12, visits: 40 },
      consultation: { average_minutes: null, visits: 0 },
      records: { finalized: 5, draft: 1, none: 2 },
    };
    await seedReport("times", {
      rows: [doctorRow(1, "Synthetic Doctor", times)],
      totals: times,
    });
    await signIn(page, "administrator");
    await page.goto("/en/reports/times");

    await expect(figure(page, r.times.wait)).toHaveText(
      "12 minutes, over 40 visits",
    );
    await expect(figure(page, r.times.consultation)).toHaveText(
      `${r.notAvailable}, over 0 visits`,
    );
    await expect(figure(page, "Seen visits: Draft")).toContainText(
      r.needsAttention,
    );
    await expect(figure(page, "Seen visits: No record")).toContainText(
      r.needsAttention,
    );
  });
});
