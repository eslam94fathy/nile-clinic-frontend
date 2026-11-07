import { expect, type Page, test } from "@playwright/test";
import {
  callsTo,
  control,
  mainNavigation,
  resetBackend,
  script,
  signIn,
  signOutButton,
} from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const m = messages.en;
const t = m.queue;
const BETA = "Synthetic Patient Beta";
const GAMMA = "Synthetic Child Gamma";
const INTERVAL = 15_000;

type SeededEntry = { id: number; appointmentId: number | null };

const seedEntry = async (options = ""): Promise<SeededEntry> =>
  (await control(`clinic/queue-entry?${options}`)) as SeededEntry;
const seedAppointment = async (options: string): Promise<{ id: number }> =>
  (await control(`clinic/appointment?${options}`)) as { id: number };
const changeEntry = (id: number, change: string) =>
  control(`clinic/change-entry?id=${id}&${change}`);
const clearCalls = () => control("calls/clear");

async function openings(id: number): Promise<number> {
  const answer = (await control(`clinic/patient-openings?id=${id}`)) as {
    count: number;
  };
  return answer.count;
}

const listHeading = (page: Page) =>
  page.getByRole("heading", { name: t.listHeading });
const ownHeading = (page: Page) =>
  page.getByRole("heading", { name: t.own.listHeading, exact: true });
/** The table keeps a copy for narrow screens, so text can be there twice, with one showing. */
const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).locator("visible=true").first();
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).locator("visible=true");
const dialog = (page: Page) => page.getByRole("alertdialog");
const confirm = (page: Page, name: string) =>
  dialog(page).getByRole("button", { name, exact: true }).click();
const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).locator("visible=true");

/** Opens a list with a clock the test moves, so that nothing here waits 15 real seconds. */
async function openWithClock(page: Page, path: string) {
  await page.clock.install();
  await page.goto(path);
}
const nextRead = (page: Page) => page.clock.fastForward(INTERVAL);

async function applyFilter(page: Page, label: string, value: string) {
  await field(page, label).selectOption(value);
  await page
    .getByRole("button", { name: m.shared.filters.apply, exact: true })
    .click();
}

test.describe("whether a list keeps reading when it isn't on screen", () => {
  // These use the real clock on purpose: this is the measurement ADR 0013 asked for.
  test("stops on another page of the application, and reads at once on returning", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await seedEntry();
    await signIn(page, "receptionist");
    const navigation = mainNavigation(page, "en");
    await navigation.getByRole("link", { name: m.shell.nav.queue }).click();
    await expect(listHeading(page)).toBeVisible();
    await expect(shown(page, BETA)).toBeVisible();

    await clearCalls();
    await page.waitForTimeout(INTERVAL + 2_000);
    expect(await callsTo("queue")).toBeGreaterThanOrEqual(1);

    await navigation.getByRole("link", { name: m.shell.nav.patients }).click();
    await expect(page).toHaveURL(/\/en\/patients$/);
    await expect(listHeading(page)).toBeHidden();
    // Still there, as Next.js keeps it mounted, or this would prove nothing.
    await expect(page.getByText(t.listHeading, { exact: true })).toBeAttached();

    await clearCalls();
    await page.waitForTimeout(INTERVAL * 2 + 2_000);
    expect(await callsTo("queue")).toBe(0);

    await navigation.getByRole("link", { name: m.shell.nav.queue }).click();
    await expect(listHeading(page)).toBeVisible();
    await expect.poll(() => callsTo("queue")).toBeGreaterThanOrEqual(1);
  });

  test("stops while the tab is hidden, and reads at once on showing it", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await seedEntry();
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await expect(shown(page, BETA)).toBeVisible();

    const setVisibility = (state: string) =>
      page.evaluate((value) => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => value,
        });
        document.dispatchEvent(
          new Event("visibilitychange", { bubbles: true }),
        );
      }, state);

    await setVisibility("hidden");
    await clearCalls();
    await page.waitForTimeout(INTERVAL + 2_000);
    expect(await callsTo("queue")).toBe(0);

    await setVisibility("visible");
    await expect.poll(() => callsTo("queue")).toBeGreaterThanOrEqual(1);
  });

  test("makes no reads for 2 minutes on another page", async ({ page }) => {
    await seedEntry();
    await signIn(page, "receptionist");
    await page.clock.install();
    const navigation = mainNavigation(page, "en");
    await navigation.getByRole("link", { name: m.shell.nav.queue }).click();
    await expect(shown(page, BETA)).toBeVisible();

    await navigation.getByRole("link", { name: m.shell.nav.patients }).click();
    await expect(listHeading(page)).toBeHidden();
    await clearCalls();
    for (let tick = 0; tick < 8; tick += 1) await nextRead(page);
    expect(await callsTo("queue")).toBe(0);

    await navigation.getByRole("link", { name: m.shell.nav.queue }).click();
    await expect.poll(() => callsTo("queue")).toBeGreaterThanOrEqual(1);
  });

  test("a doctor's list stops too", async ({ page }) => {
    await seedEntry();
    await signIn(page, "doctor");
    await page.clock.install();
    const navigation = mainNavigation(page, "en");
    await navigation.getByRole("link", { name: m.shell.nav.myQueue }).click();
    await expect(shown(page, BETA)).toBeVisible();

    await navigation
      .getByRole("link", { name: m.shell.nav.myAppointments })
      .click();
    await expect(ownHeading(page)).toBeHidden();
    await clearCalls();
    for (let tick = 0; tick < 4; tick += 1) await nextRead(page);
    expect(await callsTo("doctors/me/queue")).toBe(0);

    await navigation.getByRole("link", { name: m.shell.nav.myQueue }).click();
    await expect
      .poll(() => callsTo("doctors/me/queue"))
      .toBeGreaterThanOrEqual(1);
  });
});

test.describe("roles", () => {
  for (const path of ["queue", "queue/walk-in"]) {
    test(`a doctor can't open /${path}, and nothing is read`, async ({
      page,
    }) => {
      await signIn(page, "doctor");
      await clearCalls();
      await page.goto(`/en/${path}`);
      await expect(shown(page, m.shared.states.forbiddenHeading)).toBeVisible();
      expect(await callsTo("queue")).toBe(0);
    });
  }

  for (const role of ["receptionist", "administrator"] as const) {
    test(`a ${role} can't open /my/queue, and nothing is read`, async ({
      page,
    }) => {
      await signIn(page, role);
      await clearCalls();
      await page.goto("/en/my/queue");
      await expect(shown(page, m.shared.states.forbiddenHeading)).toBeVisible();
      expect(await callsTo("doctors/me/queue")).toBe(0);
    });

    test(`a ${role} can open /queue and /queue/walk-in`, async ({ page }) => {
      await signIn(page, role);
      await page.goto("/en/queue");
      await expect(listHeading(page)).toBeVisible();
      await page.goto("/en/queue/walk-in");
      await expect(
        page.getByRole("heading", { name: t.walkInForm.title }),
      ).toBeVisible();
    });
  }

  test("a doctor with no profile sees that, not a list", async ({ page }) => {
    await signIn(page, "newDoctor");
    await clearCalls();
    await page.goto("/en/my/queue");
    await expect(shown(page, m.auth.noProfile.heading)).toBeVisible();
    expect(await callsTo("doctors/me/queue")).toBe(0);
  });

  test("a 403 during a refresh removes the patients, and stops reading", async ({
    page,
  }) => {
    await seedEntry();
    await signIn(page, "receptionist");
    await openWithClock(page, "/en/queue");
    await expect(shown(page, BETA)).toBeVisible();

    await script("queue", 403);
    await nextRead(page);
    await expect(shown(page, m.shared.states.forbiddenHeading)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(BETA);
    await expect(page.locator("body")).not.toContainText("01000000002");

    await clearCalls();
    await nextRead(page);
    await nextRead(page);
    expect(await callsTo("queue")).toBe(0);
  });

  test("a 403 on the doctor's list does the same", async ({ page }) => {
    await seedEntry();
    await signIn(page, "doctor");
    await openWithClock(page, "/en/my/queue");
    await expect(shown(page, BETA)).toBeVisible();

    await script("doctors/me/queue", 403);
    await nextRead(page);
    await expect(shown(page, m.shared.states.forbiddenHeading)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(BETA);
  });

  test("a 401 during a refresh goes to sign-in, with no patient in the address", async ({
    page,
  }) => {
    await seedEntry();
    await signIn(page, "receptionist");
    await openWithClock(page, "/en/queue?doctor_id=1");
    await expect(shown(page, BETA)).toBeVisible();

    await control(
      `revoke?email=${encodeURIComponent("synthetic.reception@example.test")}`,
    );
    await nextRead(page);
    await expect(page).toHaveURL(/\/en\/sign-in/);
    expect(page.url()).not.toContain("doctor_id");
    await expect(page.locator("body")).not.toContainText(BETA);
  });

  test("signing out leaves nothing behind, even going back", async ({
    page,
  }) => {
    await seedEntry();
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await expect(shown(page, BETA)).toBeVisible();

    await signOutButton(page, "en").click();
    await expect(page).toHaveURL(/\/en\/sign-in/);
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/sign-in/);
    await expect(page.locator("body")).not.toContainText(BETA);
    const stored = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(stored).not.toContain(BETA);
  });
});

test.describe("reception's list", () => {
  test("shows every status, grouped by doctor, in the API's order", async ({
    page,
  }) => {
    const second = (await control("clinic/second-doctor")) as { id: number };
    await seedEntry("start=11:00&patient=2");
    await seedEntry("start=09:00&patient=3");
    await seedEntry(`doctor=${second.id}&patient=4&status=seen`);
    await signIn(page, "receptionist");
    await page.goto("/en/queue");

    await expect(
      page.getByRole("heading", { level: 3, name: /Synthetic Doctor/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: /Synthetic Newdoctor/ }),
    ).toBeVisible();

    // Booked at 09:00 goes first, though it arrived second, with number 2.
    const firstTable = page.getByRole("table").first();
    const rows = firstTable.getByRole("row");
    await expect(rows.nth(1)).toContainText(GAMMA);
    await expect(rows.nth(1).getByRole("cell").first()).toHaveText("2");
    await expect(rows.nth(2)).toContainText(BETA);
    await expect(page.getByRole("main")).toContainText(
      m.shared.status.queue.seen,
    );
  });

  test("a row gives what it should, and no more", async ({ page }) => {
    await seedEntry("patient=2");
    const { appointmentId } = await seedEntry("start=09:00&patient=3");
    await signIn(page, "receptionist");
    await page.goto("/en/queue");

    const rows = page.getByRole("table").getByRole("row");
    await expect(rows.nth(1).or(rows.nth(2)).first()).toBeVisible();
    await expect(page.getByRole("table")).toContainText(t.walkIn);
    await expect(page.getByRole("table")).toContainText("01000000002");
    await expect(
      page.getByRole("link", { name: "09:00 – 09:20" }).locator("visible=true"),
    ).toHaveAttribute("href", `/en/appointments/${appointmentId}`);
  });

  test("filters match, and survive a reload and going back", async ({
    page,
  }) => {
    const second = (await control("clinic/second-doctor")) as { id: number };
    await seedEntry("patient=2");
    await seedEntry("patient=3&status=seen");
    await seedEntry(`doctor=${second.id}&patient=4`);
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await expect(shown(page, BETA)).toBeVisible();

    await applyFilter(page, t.fields.status, "seen");
    await expect(page).toHaveURL(/status=seen/);
    await expect(shown(page, GAMMA)).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(BETA);

    await page.reload();
    await expect(shown(page, GAMMA)).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(BETA);

    await page.goBack();
    await expect(shown(page, BETA)).toBeVisible();

    // A doctor and a status together, which the API's doctor list can't filter.
    await page.goto("/en/queue?doctor_id=1&status=seen");
    await expect(shown(page, GAMMA)).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(BETA);
    expect(await callsTo("doctors/1/queue")).toBeGreaterThanOrEqual(1);
  });

  test("an address that can't be valid shows the whole list", async ({
    page,
  }) => {
    await seedEntry();
    await signIn(page, "receptionist");
    await page.goto("/en/queue?doctor_id=abc&status=gone&page=-1");
    await expect(shown(page, BETA)).toBeVisible();
  });

  test("a doctor who doesn't exist is neutrally not found, and reading stops", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await openWithClock(page, "/en/queue?doctor_id=9999");
    await expect(shown(page, m.shared.states.notFoundHeading)).toBeVisible();
    await expect(
      page.getByRole("link", { name: t.allDoctors }),
    ).toHaveAttribute("href", "/en/queue");

    await clearCalls();
    await nextRead(page);
    expect(await callsTo("doctors/9999/queue")).toBe(0);
  });

  test("both empty states offer the way forward", async ({ page }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await expect(shown(page, t.empty.todayTitle)).toBeVisible();

    await page.goto("/en/queue?status=seen");
    await expect(shown(page, t.empty.filteredTitle)).toBeVisible();
    const main = page.getByRole("main");
    await expect(
      main.getByRole("link", { name: t.todaysAppointments }).last(),
    ).toBeVisible();
  });

  test("a page that no longer exists gives way to the last that does", async ({
    page,
  }) => {
    await seedEntry();
    await signIn(page, "receptionist");
    await page.goto("/en/queue?page=5");
    await expect(page).toHaveURL(/\/en\/queue\?page=1$/);
    await expect(shown(page, BETA)).toBeVisible();
  });

  test("showing and refreshing a row never opens the patient; following it does, once", async ({
    page,
  }) => {
    await seedEntry();
    await signIn(page, "receptionist");
    await openWithClock(page, "/en/queue");
    const link = page
      .getByRole("link", { name: BETA })
      .locator("visible=true")
      .first();
    await link.hover();
    await nextRead(page);
    await nextRead(page);
    await expect(link).toBeVisible();
    expect(await openings(2)).toBe(0);

    await link.click();
    await expect(page).toHaveURL(/\/en\/patients\/2$/);
    await expect.poll(() => openings(2)).toBe(1);
  });
});

test.describe("staying current", () => {
  test("a change appears by itself, with no loading state", async ({
    page,
  }) => {
    const { id } = await seedEntry("patient=2");
    await signIn(page, "receptionist");
    await openWithClock(page, "/en/queue");
    await expect(shown(page, BETA)).toBeVisible();
    await expect(shown(page, m.shared.status.queue.waiting)).toBeVisible();

    await seedEntry("patient=3");
    await changeEntry(id, "status=with_doctor");
    await clearCalls();
    await nextRead(page);

    await expect(shown(page, GAMMA)).toBeVisible();
    await expect(shown(page, m.shared.status.queue.with_doctor)).toBeVisible();
    await expect(shown(page, BETA)).toBeVisible();
    expect(await callsTo("queue")).toBe(1);
  });

  test("a failed refresh keeps the list with a notice, and recovery clears it", async ({
    page,
  }) => {
    await seedEntry();
    await signIn(page, "receptionist");
    await openWithClock(page, "/en/queue");
    await expect(shown(page, BETA)).toBeVisible();

    await script("queue", 500);
    await nextRead(page);
    await expect(shown(page, t.lastRead.outOfDate)).toBeVisible();
    await expect(shown(page, BETA)).toBeVisible();

    await script("queue", 0);
    await nextRead(page);
    await expect(page.getByText(t.lastRead.outOfDate)).toBeHidden();
    await expect(shown(page, BETA)).toBeVisible();
  });

  test("a browser that says it's offline shows the notice, rather than pausing", async ({
    page,
    context,
  }) => {
    await seedEntry();
    await signIn(page, "receptionist");
    await openWithClock(page, "/en/queue");
    await expect(shown(page, BETA)).toBeVisible();

    await context.setOffline(true);
    await nextRead(page);
    await expect(shown(page, t.lastRead.outOfDate)).toBeVisible();
    await context.setOffline(false);
  });

  test("a first read failing shows the error, and trying again works", async ({
    page,
  }) => {
    await seedEntry();
    await signIn(page, "receptionist");
    await script("queue", 500);
    await page.goto("/en/queue");
    await expect(shown(page, m.shared.states.errorHeading)).toBeVisible();

    await script("queue", 0);
    await button(page, m.shared.states.retry).click();
    await expect(shown(page, BETA)).toBeVisible();
  });

  test("refresh now reads straight away", async ({ page }) => {
    await seedEntry();
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await expect(shown(page, BETA)).toBeVisible();

    await clearCalls();
    await button(page, t.lastRead.refresh).click();
    await expect.poll(() => callsTo("queue")).toBe(1);
  });

  test("a row that goes while it has the focus moves the focus to the heading", async ({
    page,
  }) => {
    const { id } = await seedEntry("patient=2");
    await seedEntry("patient=3");
    await signIn(page, "receptionist");
    await openWithClock(page, "/en/queue");
    const row = page
      .getByRole("row")
      .filter({ hasText: BETA })
      .locator("visible=true");
    await row.getByRole("button", { name: t.left.action }).focus();

    await changeEntry(id, "remove=1");
    await nextRead(page);
    await expect(row).toBeHidden();
    await expect(listHeading(page)).toBeFocused();
  });

  test("a refresh leaves the focus on a control that stays", async ({
    page,
  }) => {
    await seedEntry("patient=2");
    await signIn(page, "receptionist");
    await openWithClock(page, "/en/queue");
    const action = button(page, t.left.action);
    await action.focus();

    await nextRead(page);
    await expect(action).toBeFocused();
  });
});

test.describe("checking in", () => {
  test("is offered today and not on another date, and gives the number", async ({
    page,
  }) => {
    const other = await seedAppointment("days=1&start=09:00");
    const today = await seedAppointment("days=0&start=23:40&patient=3");
    const a = m.appointments;
    await signIn(page, "receptionist");

    await page.goto(`/en/appointments/${other.id}`);
    await expect(button(page, a.actions.cancel)).toBeVisible();
    await expect(button(page, a.checkIn.action)).toHaveCount(0);

    await page.goto(`/en/appointments/${today.id}`);
    await button(page, a.checkIn.action).click();
    await expect(
      page.getByText(a.checkIn.done.replace("{number}", "1")),
    ).toBeVisible();
    await expect(
      shown(page, m.shared.status.appointment.checked_in),
    ).toBeVisible();
    await expect(button(page, a.actions.cancel)).toHaveCount(0);

    await page.getByRole("link", { name: a.checkIn.seeList }).click();
    await expect(page).toHaveURL(/\/en\/queue\?doctor_id=1$/);
    await expect(shown(page, GAMMA)).toBeVisible();
    await expect(shown(page, listHeadingText)).toBeVisible();
  });

  test("a refusal shows on the page, with the current state", async ({
    page,
  }) => {
    const { id } = await seedAppointment("days=0&start=23:40");
    const a = m.appointments;
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);
    await expect(button(page, a.checkIn.action)).toBeVisible();

    await control(`clinic/change-appointment?id=${id}&status=cancelled`);
    await button(page, a.checkIn.action).click();
    await expect(
      page.getByText("This appointment can't be checked in."),
    ).toBeVisible();
    await expect(
      shown(page, m.shared.status.appointment.cancelled),
    ).toBeVisible();
  });

  test("an unknown outcome says so", async ({ page }) => {
    const { id } = await seedAppointment("days=0&start=23:40");
    const a = m.appointments;
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);
    await script(`POST appointments/${id}/check-in`, -1);
    await button(page, a.checkIn.action).click();
    await expect(page.getByText(a.actions.unknownOutcome)).toBeVisible();
  });

  test("undoing from the queue makes the appointment scheduled again", async ({
    page,
  }) => {
    const { id } = await seedAppointment("days=0&start=23:40");
    const a = m.appointments;
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);
    await button(page, a.checkIn.action).click();
    await page.getByRole("link", { name: a.checkIn.seeList }).click();

    await button(page, t.undo.action).click();
    await confirm(page, t.undo.confirm);
    await expect(page.getByText(t.undo.done)).toBeVisible();

    await page.goto(`/en/appointments/${id}`);
    await expect(
      shown(page, m.shared.status.appointment.scheduled),
    ).toBeVisible();
    await expect(button(page, a.checkIn.action)).toBeVisible();
  });
});

test.describe("corrections", () => {
  test("waiting rows offer actions, and others don't", async ({ page }) => {
    await seedEntry("patient=2");
    await seedEntry("patient=3&start=09:00");
    await seedEntry("patient=4&status=seen");
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await expect(shown(page, BETA)).toBeVisible();

    await expect(button(page, t.left.action)).toHaveCount(2);
    await expect(button(page, t.undo.action)).toHaveCount(1);
    const walkIn = page
      .getByRole("row")
      .filter({ hasText: BETA })
      .locator("visible=true");
    await expect(
      walkIn.getByRole("button", { name: t.undo.action }),
    ).toHaveCount(0);
  });

  test("marking as left asks first, then stays on the list", async ({
    page,
  }) => {
    await seedEntry("patient=2");
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await button(page, t.left.action).click();

    await expect(dialog(page)).toContainText(BETA);
    await expect(dialog(page)).toContainText(m.shared.confirm.irreversible);
    await confirm(page, t.left.confirm);

    await expect(page.getByText(t.left.done)).toBeVisible();
    await expect(shown(page, m.shared.status.queue.left)).toBeVisible();
    await expect(shown(page, BETA)).toBeVisible();
    await expect(button(page, t.left.action)).toHaveCount(0);
  });

  test("undoing asks first, says what happens, and removes the row", async ({
    page,
  }) => {
    await seedEntry("patient=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await button(page, t.undo.action).click();

    await expect(dialog(page)).toContainText(BETA);
    await expect(dialog(page)).toContainText(t.undo.description);
    await confirm(page, t.undo.confirm);

    await expect(page.getByText(t.undo.done)).toBeVisible();
    await expect(shown(page, t.empty.todayTitle)).toBeVisible();
  });

  test("dismissing changes nothing, and returns the focus", async ({
    page,
  }) => {
    await seedEntry("patient=2");
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await button(page, t.left.action).click();
    await dialog(page)
      .getByRole("button", { name: m.shared.confirm.cancel })
      .click();

    await expect(dialog(page)).toBeHidden();
    await expect(button(page, t.left.action)).toBeFocused();
    expect(await callsTo(`queue/100/leave`)).toBe(0);
    await expect(shown(page, m.shared.status.queue.waiting)).toBeVisible();
  });

  test("a row changing under its dialog leaves the dialog, and the API decides", async ({
    page,
  }) => {
    const { id } = await seedEntry("patient=2");
    await signIn(page, "receptionist");
    await openWithClock(page, "/en/queue");
    await button(page, t.left.action).click();
    const before = await dialog(page).textContent();

    await changeEntry(id, "status=with_doctor");
    await nextRead(page);
    await expect(shown(page, m.shared.status.queue.with_doctor)).toBeVisible();
    await expect(dialog(page)).toHaveText(before ?? "");

    await confirm(page, t.left.confirm);
    await expect(dialog(page)).toContainText(
      "This queue entry can no longer be changed.",
    );
  });

  test("a row going under its dialog leaves the dialog, and the focus lands safely", async ({
    page,
  }) => {
    const { id } = await seedEntry("patient=2");
    await signIn(page, "receptionist");
    await openWithClock(page, "/en/queue");
    await button(page, t.left.action).click();

    await changeEntry(id, "remove=1");
    await nextRead(page);
    await expect(dialog(page)).toBeVisible();

    await confirm(page, t.left.confirm);
    await expect(dialog(page)).toContainText("No queue entry was found.");
    await dialog(page)
      .getByRole("button", { name: m.shared.confirm.cancel })
      .click();
    await expect(listHeading(page)).toBeFocused();
  });

  test("an active charge refuses undoing, with the API's message", async ({
    page,
  }) => {
    const { id } = await seedEntry("patient=2&start=09:00");
    await changeEntry(id, "charge=1");
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await button(page, t.undo.action).click();
    await confirm(page, t.undo.confirm);
    await expect(dialog(page)).toContainText(
      "This visit has an active charge.",
    );
  });

  test("an unknown outcome says so, in the dialog", async ({ page }) => {
    const { id } = await seedEntry("patient=2");
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await script(`POST queue/${id}/leave`, -1);
    await button(page, t.left.action).click();
    await confirm(page, t.left.confirm);
    await expect(dialog(page)).toContainText(t.unknownOutcome);
  });
});

test.describe("a doctor's list", () => {
  const callNext = async (page: Page) => {
    await button(page, t.own.callNext.action).click();
    await confirm(page, t.own.callNext.confirm);
  };
  const finish = async (page: Page) => {
    await button(page, t.own.finish.action).click();
    await confirm(page, t.own.finish.confirm);
  };
  const current = (page: Page) =>
    page.getByRole("region", { name: t.own.currentHeading });

  test("call next, finish, and call next again", async ({ page }) => {
    const first = await seedEntry("patient=2&start=09:00");
    await seedEntry("patient=3&start=10:00");
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");
    await expect(button(page, t.own.finish.action)).toHaveCount(0);

    await button(page, t.own.callNext.action).click();
    await expect(dialog(page)).toContainText(t.own.callNext.description);
    await expect(dialog(page)).not.toContainText(BETA);
    await confirm(page, t.own.callNext.confirm);

    await expect(
      page.getByText(t.own.callNext.done.replace("{name}", BETA)),
    ).toBeVisible();
    await expect(current(page)).toContainText(BETA);
    await expect(button(page, t.own.callNext.action)).toHaveCount(0);

    await button(page, t.own.finish.action).click();
    await expect(dialog(page)).toContainText(BETA);
    await expect(dialog(page)).toContainText(m.shared.confirm.irreversible);
    await confirm(page, t.own.finish.confirm);
    await expect(
      page.getByText(t.own.finish.done.replace("{name}", BETA)),
    ).toBeVisible();
    await expect(current(page)).toHaveCount(0);

    await callNext(page);
    await expect(current(page)).toContainText(GAMMA);
    expect(first.appointmentId).not.toBeNull();
  });

  test("shows the patient the API returned, who may not be the first waiting", async ({
    page,
  }) => {
    const second = (await control("clinic/second-doctor")) as { id: number };
    await seedEntry("patient=2&start=09:00");
    await seedEntry("patient=3&start=10:00");
    await seedEntry(`doctor=${second.id}&patient=2&status=with_doctor`);
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");

    await callNext(page);
    await expect(current(page)).toContainText(GAMMA);
  });

  test("shows the patient the API returned even if the read after it fails", async ({
    page,
  }) => {
    await seedEntry("patient=2&start=09:00");
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");
    await expect(shown(page, BETA)).toBeVisible();

    await script("GET doctors/me/queue", 500);
    await callNext(page);
    await expect(current(page)).toContainText(BETA);
    await expect(shown(page, t.lastRead.outOfDate)).toBeVisible();
  });

  test("a refusal stays in the dialog, and the list is read again", async ({
    page,
  }) => {
    const second = (await control("clinic/second-doctor")) as { id: number };
    await seedEntry("patient=2");
    await seedEntry(`doctor=${second.id}&patient=2&status=with_doctor`);
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");
    await clearCalls();

    await callNext(page);
    await expect(dialog(page)).toContainText("Nobody is waiting.");
    await expect
      .poll(() => callsTo("doctors/me/queue"))
      .toBeGreaterThanOrEqual(1);
  });

  test("a list that was out of date is corrected by the refusal", async ({
    page,
  }) => {
    const { id } = await seedEntry("patient=2");
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");
    await expect(button(page, t.own.callNext.action)).toBeVisible();

    await changeEntry(id, "status=with_doctor");
    await callNext(page);
    await expect(dialog(page)).toContainText("Finish the current visit first.");
    await dialog(page)
      .getByRole("button", { name: m.shared.confirm.cancel })
      .click();
    await expect(button(page, t.own.finish.action)).toBeVisible();
  });

  test("finishing when nobody is current shows the refusal", async ({
    page,
  }) => {
    const { id } = await seedEntry("patient=2&status=with_doctor");
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");
    await expect(current(page)).toBeVisible();

    await changeEntry(id, "status=seen");
    await finish(page);
    await expect(dialog(page)).toContainText("Nobody is with you.");
  });

  test("an unknown outcome says so, and reads again", async ({ page }) => {
    await seedEntry("patient=2");
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");
    await script("POST doctors/me/queue/call-next", -1);
    await callNext(page);
    await expect(dialog(page)).toContainText(t.unknownOutcome);
  });

  test("an empty list says so, and a new arrival appears by itself", async ({
    page,
  }) => {
    await signIn(page, "doctor");
    await openWithClock(page, "/en/my/queue");
    await expect(shown(page, t.own.emptyTitle)).toBeVisible();

    await seedEntry("patient=2");
    await nextRead(page);
    await expect(shown(page, BETA)).toBeVisible();
    await expect(button(page, t.own.callNext.action)).toBeVisible();
  });

  test("says nobody is waiting once everyone is seen, and keeps their rows", async ({
    page,
  }) => {
    await seedEntry("patient=2&status=seen");
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");
    await expect(shown(page, t.own.nobodyWaiting)).toBeVisible();
    await expect(shown(page, BETA)).toBeVisible();
    await expect(button(page, t.own.callNext.action)).toHaveCount(0);
  });

  test("shows no contact details, and no links to a record", async ({
    page,
  }) => {
    await seedEntry("patient=2&start=09:00");
    await seedEntry("patient=3&status=with_doctor");
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");
    await expect(current(page)).toContainText(GAMMA);

    const main = page.getByRole("main");
    await expect(main).not.toContainText("01000000002");
    await expect(main).toContainText("1985-07-30");
    await expect(main).toContainText(t.sex.female);
    await expect(main.locator('a[href*="/patients/"]')).toHaveCount(0);
    await expect(main.locator('a[href*="/appointments/"]')).toHaveCount(0);
  });

  test("dismissing either dialog changes nothing", async ({ page }) => {
    await seedEntry("patient=2");
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");
    await button(page, t.own.callNext.action).click();
    await dialog(page)
      .getByRole("button", { name: m.shared.confirm.cancel })
      .click();

    await expect(dialog(page)).toBeHidden();
    await expect(button(page, t.own.callNext.action)).toBeFocused();
    expect(await callsTo("doctors/me/queue/call-next")).toBe(0);
  });
});

test.describe("adding a walk-in", () => {
  const chooseDoctor = (page: Page) =>
    page
      .getByRole("button", {
        name: m.doctors.chooser.chooseNamed.replace(
          "{name}",
          "Synthetic Doctor",
        ),
      })
      .locator("visible=true")
      .first()
      .click();
  const submit = (page: Page) => button(page, t.walkInForm.submit).click();

  test("from a search, giving the number, with no bookable time taken", async ({
    page,
  }) => {
    await control("clinic/setup?schedule=1");
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await page.getByRole("link", { name: t.addWalkIn }).first().click();
    await expect(page).toHaveURL(/\/en\/queue\/walk-in$/);

    await field(page, m.patients.fields.fullName).fill("Beta");
    await button(page, m.patients.search.button).click();
    await page
      .getByRole("button", {
        name: m.patients.chooser.chooseNamed.replace("{name}", BETA),
      })
      .locator("visible=true")
      .first()
      .click();
    await chooseDoctor(page);
    await expect(page.getByText(t.walkInForm.permanent)).toBeVisible();
    await submit(page);

    await expect(page).toHaveURL(/\/en\/queue$/);
    await expect(
      page.getByText(t.walkInForm.added.replace("{number}", "1")),
    ).toBeVisible();
    await expect(shown(page, t.walkIn)).toBeVisible();
    expect(await openings(2)).toBe(0);
    await expect(page).not.toHaveURL(/Beta/);
    await expect(page).not.toHaveTitle(/Beta/);
  });

  test("carried from a patient's page, opening nothing", async ({ page }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/patients/2");
    await expect.poll(() => openings(2)).toBe(1);

    await page
      .getByRole("link", { name: m.patients.recordLinks.addToQueue })
      .click();
    await expect(page).toHaveURL(/\/en\/queue\/walk-in\?patient_id=2$/);
    await expect(shown(page, BETA)).toBeVisible();
    await chooseDoctor(page);
    await submit(page);
    await expect(page).toHaveURL(/\/en\/queue$/);
    expect(await openings(2)).toBe(1);
  });

  test("a patient already on the list is refused, on the patient, keeping the choice", async ({
    page,
  }) => {
    await seedEntry("patient=2");
    await signIn(page, "receptionist");
    await page.goto("/en/queue/walk-in?patient_id=2");
    await chooseDoctor(page);
    await submit(page);

    await expect(
      page.getByText("This patient is already in this doctor's queue."),
    ).toBeVisible();
    await expect(page).toHaveURL(/walk-in/);
    await expect(button(page, t.walkInForm.submit)).toBeVisible();
    await expect(shown(page, BETA)).toBeVisible();
  });

  test("a doctor refused is shown on the doctor", async ({ page }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/queue/walk-in?patient_id=2");
    await expect(shown(page, BETA)).toBeVisible();
    await chooseDoctor(page);
    await control(
      `account?email=${encodeURIComponent("synthetic.doctor@example.test")}&active=false`,
    );
    await submit(page);
    await expect(page.getByText("This doctor is not active.")).toBeVisible();
  });

  test("an unknown outcome says so, with a link to the queue", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/queue/walk-in?patient_id=2");
    await chooseDoctor(page);
    await script("POST queue/walk-ins", -1);
    await submit(page);

    await expect(page.getByText(t.walkInForm.unknownOutcome)).toBeVisible();
    await expect(
      page.getByRole("link", { name: t.walkInForm.seeQueue }),
    ).toBeVisible();
  });

  test("a value that can't be a patient, or that isn't one, offers the search", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    for (const value of ["abc", "9999"]) {
      await page.goto(`/en/queue/walk-in?patient_id=${value}`);
      await expect(page.getByText(t.walkInForm.patientMissing)).toBeVisible();
      await expect(field(page, m.patients.fields.fullName)).toBeVisible();
    }
  });

  test("nobody found offers registering", async ({ page }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/queue/walk-in");
    await field(page, m.patients.fields.fullName).fill("Nobody Synthetic");
    await button(page, m.patients.search.button).click();
    await expect(
      page.locator('a[href*="/patients/new"]').first(),
    ).toBeVisible();
  });

  test("the form is empty when next opened, including by going back", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await page.getByRole("link", { name: t.addWalkIn }).first().click();
    await field(page, m.patients.fields.number).fill("2");
    await button(page, m.patients.search.button).click();
    await page
      .getByRole("button", {
        name: m.patients.chooser.chooseNamed.replace("{name}", BETA),
      })
      .locator("visible=true")
      .first()
      .click();
    await chooseDoctor(page);
    await submit(page);
    await expect(page).toHaveURL(/\/en\/queue$/);

    await page.goBack();
    await expect(page).toHaveURL(/walk-in$/);
    await expect(button(page, t.walkInForm.submit)).toHaveCount(0);
    await expect(page.getByText(t.walkInForm.choosePatientFirst)).toBeVisible();
  });

  test("search fields aren't remembered, and Arabic digits are sent as Western ones", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/queue/walk-in");
    const number = field(page, m.patients.fields.number);
    await expect(number).toHaveAttribute("autocomplete", "off");

    await number.fill("٢");
    await button(page, m.patients.search.button).click();
    await expect(shown(page, BETA)).toBeVisible();
    await expect(page).not.toHaveURL(/٢/);
    const stored = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(stored).not.toContain("٢");
  });
});

const listHeadingText = t.listHeading;
