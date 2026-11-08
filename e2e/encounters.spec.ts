import { expect, type Page, test } from "@playwright/test";
import {
  ACCOUNTS,
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
const t = m.encounters;
const unsaved = m.shared.unsaved;
const status = m.shared.status.record;
const NOTE = "Synthetic note for the record";
const BETA = "Synthetic Patient Beta";
const GAMMA = "Synthetic Child Gamma";
const PATIENT = 2;

type Reads = {
  opened: number;
  history: number;
  saves: number;
  finalized: number;
  addenda: number;
};

const reads = async () => (await control("clinic/encounter-reads")) as Reads;

const seedEncounter = async (
  options: {
    status?: "draft" | "finalized";
    patient?: number;
    doctor?: number;
    date?: string;
    visit?: number;
    content?: Record<string, unknown>;
  } = {},
): Promise<{ id: number; visitId: number }> => {
  const query = new URLSearchParams({
    ...(options.status ? { status: options.status } : {}),
    ...(options.patient ? { patient: String(options.patient) } : {}),
    ...(options.doctor ? { doctor: String(options.doctor) } : {}),
    ...(options.date ? { date: options.date } : {}),
    ...(options.visit ? { visit: String(options.visit) } : {}),
    content: JSON.stringify(options.content ?? {}),
  });
  return (await control(`clinic/encounter?${query.toString()}`)) as {
    id: number;
    visitId: number;
  };
};
const COMPLETE = {
  chief_complaint: "Synthetic",
  diagnosis: "Synthetic finding",
};
const seedEntry = async (options = ""): Promise<{ id: number }> =>
  (await control(`clinic/queue-entry?${options}`)) as { id: number };
const changeEncounter = (id: number, change: Record<string, unknown>) =>
  control(
    `clinic/change-encounter?id=${id}&${
      change.status ? `status=${String(change.status)}&` : ""
    }content=${encodeURIComponent(JSON.stringify(change.content ?? {}))}`,
  );
const anotherDoctor = async () =>
  (
    (await control(
      `clinic/own-doctor?email=${encodeURIComponent(ACCOUNTS.newDoctor)}`,
    )) as { id: number }
  ).id;

const record = (id: number) => `/en/my/encounters/${id}`;
const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).locator("visible=true");
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).locator("visible=true");
const link = (page: Page, name: string) =>
  page.getByRole("link", { name, exact: true }).locator("visible=true").first();
const dialog = (page: Page) => page.getByRole("alertdialog");
const inDialog = (page: Page, name: string) =>
  dialog(page).getByRole("button", { name, exact: true }).click();
const stay = (page: Page) => inDialog(page, unsaved.stay);
const leave = (page: Page) => inDialog(page, unsaved.leave);
const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).locator("visible=true").first();
const scheduleHeading = (page: Page) =>
  page.getByRole("heading", { name: m.scheduling.myTitle, exact: true });
const nav = (page: Page, name: string) =>
  mainNavigation(page, "en").getByRole("link", { name });

/** Goes by the application's own router, as a link would, so that the browser's history stays one document. */
async function softlyGoTo(page: Page, address: string) {
  await page.evaluate((target) => {
    (
      window as unknown as { next: { router: { push: (to: string) => void } } }
    ).next.router.push(target);
  }, address);
}

/** A cancelled move commits nothing, so Playwright would otherwise wait for it until it timed out. */
const pressBack = (page: Page) =>
  page.goBack({ waitUntil: "commit", timeout: 1_000 }).catch(() => null);
const pressForward = (page: Page) =>
  page.goForward({ waitUntil: "commit", timeout: 1_000 }).catch(() => null);

async function openDraft(page: Page, options = {}) {
  const { id } = await seedEncounter(options);
  await signIn(page, "doctor");
  await page.goto(record(id));
  await expect(field(page, t.form.diagnosis)).toBeVisible();
  return id;
}

test.describe("whether the back button can be stopped (research R2)", () => {
  async function writeAfterASoftMove(page: Page) {
    const { id } = await seedEncounter();
    await signIn(page, "doctor");
    await nav(page, m.shell.nav.mySchedule).click();
    await expect(page).toHaveURL(/\/en\/my\/schedule$/);
    await softlyGoTo(page, record(id));
    await expect(page).toHaveURL(new RegExp(`${record(id)}$`));
    await field(page, t.form.diagnosis).fill(NOTE);
    return id;
  }

  test("back warns, and staying keeps the address and every character", async ({
    page,
  }) => {
    const id = await writeAfterASoftMove(page);

    await pressBack(page);
    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${record(id)}$`));

    await stay(page);
    await expect(dialog(page)).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${record(id)}$`));
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);
  });

  test("back can be pressed again after staying, and leaving reaches the page before", async ({
    page,
  }) => {
    await writeAfterASoftMove(page);

    await pressBack(page);
    await stay(page);
    await pressBack(page);
    await expect(dialog(page)).toBeVisible();

    await leave(page);
    await expect(page).toHaveURL(/\/en\/my\/schedule$/);
    await expect(scheduleHeading(page)).toBeVisible();
  });

  test("history works normally afterwards, and what was discarded is gone", async ({
    page,
  }) => {
    const id = await writeAfterASoftMove(page);

    await pressBack(page);
    await leave(page);
    await expect(page).toHaveURL(/\/en\/my\/schedule$/);

    await pressForward(page);
    await expect(page).toHaveURL(new RegExp(`${record(id)}$`));
    await expect(field(page, t.form.diagnosis)).toHaveValue("");

    await pressBack(page);
    await expect(page).toHaveURL(/\/en\/my\/schedule$/);
    await expect(dialog(page)).toBeHidden();
    await expect(scheduleHeading(page)).toBeVisible();
  });

  test("forward warns too, and stays where it was", async ({ page }) => {
    const { id } = await seedEncounter();
    await signIn(page, "doctor");
    await nav(page, m.shell.nav.mySchedule).click();
    await expect(page).toHaveURL(/\/en\/my\/schedule$/);
    await softlyGoTo(page, record(id));
    await expect(page).toHaveURL(new RegExp(`${record(id)}$`));
    await softlyGoTo(page, "/en/my/appointments");
    await expect(page).toHaveURL(/\/en\/my\/appointments$/);
    await pressBack(page);
    await expect(page).toHaveURL(new RegExp(`${record(id)}$`));
    await field(page, t.form.diagnosis).fill(NOTE);

    await pressForward(page);
    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${record(id)}$`));
    await stay(page);
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);
  });
});

test.describe("who can reach clinical screens", () => {
  for (const account of ["administrator", "receptionist"] as const) {
    test(`${account} gets not allowed everywhere, with no read`, async ({
      page,
    }) => {
      const { id } = await seedEncounter({ status: "finalized" });
      await signIn(page, account);

      for (const address of [
        "/en/my/visits",
        record(id),
        `/en/my/patients/${PATIENT}/history`,
      ]) {
        await page.goto(address);
        await expect(
          shown(page, m.shared.states.forbiddenHeading),
        ).toBeVisible();
      }
      expect(await reads()).toMatchObject({ opened: 0, history: 0 });
      await expect(nav(page, m.shell.nav.myVisits)).toHaveCount(0);
    });
  }

  test("a doctor with no profile is told so, with no read", async ({
    page,
  }) => {
    const { id } = await seedEncounter({ status: "finalized" });
    await signIn(page, "newDoctor");

    for (const address of [
      "/en/my/visits",
      record(id),
      `/en/my/patients/${PATIENT}/history`,
    ]) {
      await page.goto(address);
      await expect(shown(page, m.auth.noProfile.heading)).toBeVisible();
    }
    expect(await reads()).toMatchObject({ opened: 0, history: 0 });
  });

  test("reception's own screens show nothing about a record", async ({
    page,
  }) => {
    await seedEncounter({ status: "finalized", content: COMPLETE });
    await signIn(page, "receptionist");

    await page.goto("/en/queue");
    await expect(shown(page, BETA)).toBeVisible();
    await expect(page.getByText(status.finalized)).toHaveCount(0);
    await expect(page.getByText(t.actions.open)).toHaveCount(0);

    await page.goto(`/en/patients/${PATIENT}`);
    await expect(
      page.getByRole("heading", { name: BETA, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(status.finalized)).toHaveCount(0);
  });
});

test.describe("writing a record", () => {
  test("from a patient with the doctor to a saved draft", async ({ page }) => {
    await seedEntry(`status=with_doctor&patient=${PATIENT}`);
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");

    await expect(shown(page, status.none)).toBeVisible();
    await button(page, t.actions.start).click();
    await expect(page).toHaveURL(/\/en\/my\/encounters\/\d+$/);
    await expect(field(page, t.form.diagnosis)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(BETA);
    expect((await reads()).opened).toBe(0);

    await field(page, t.form.diagnosis).fill(NOTE);
    await expect(page.getByText(t.status.unsaved)).toBeVisible();
    await button(page, t.save.action).click();
    await expect(page.getByText(t.save.done)).toBeVisible();
    expect(await reads()).toMatchObject({ saves: 1, opened: 0 });

    await page.reload();
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);
    expect((await reads()).opened).toBe(1);
  });

  test("calling a patient starts nothing", async ({ page }) => {
    await seedEntry(`patient=${PATIENT}`);
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");

    await button(page, m.queue.own.callNext.action).click();
    await inDialog(page, m.queue.own.callNext.confirm);
    await expect(button(page, m.queue.own.finish.action)).toBeVisible();
    await expect(button(page, t.actions.start)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/my\/queue$/);
  });

  test("a visit that gained a record elsewhere offers it, once the list is read again", async ({
    page,
  }) => {
    const { id } = await seedEntry(`status=with_doctor&patient=${PATIENT}`);
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");
    await expect(button(page, t.actions.start)).toBeVisible();

    await seedEncounter({ visit: id, patient: PATIENT });
    await button(page, t.actions.start).click();

    await expect(link(page, t.actions.continue)).toBeVisible();
    expect((await reads()).opened).toBe(0);
  });

  test("errors land on their fields, past an empty line", async ({ page }) => {
    await openDraft(page);
    await button(page, t.form.lines.add).click();
    await button(page, t.form.lines.add).click();
    await page
      .getByRole("group", { name: "Line 2", exact: true })
      .getByLabel(t.form.lines.dosage)
      .fill("One");

    await button(page, t.save.action).click();

    await expect(
      page
        .getByRole("group", { name: "Line 2", exact: true })
        .getByText("The medication is required."),
    ).toBeVisible();
    await expect(
      page
        .getByRole("group", { name: "Line 1", exact: true })
        .getByText("The medication is required."),
    ).toHaveCount(0);
  });

  test("marked-up, unbroken, and over-long text is kept exactly, and shown as text", async ({
    page,
  }) => {
    await openDraft(page);
    const planted = `<img src=x onerror="document.title='ran'"> ${"unbroken".repeat(40)}`;
    await field(page, t.form.chiefComplaint).fill(planted);
    await field(page, t.form.diagnosis).fill(COMPLETE.diagnosis);

    await button(page, t.finalize.action).click();
    await inDialog(page, t.finalize.confirm);

    await expect(shown(page, planted)).toBeVisible();
    await expect(page.locator("main img[src='x']")).toHaveCount(0);
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);

    await page.reload();
    await expect(shown(page, planted)).toBeVisible();
    expect(await page.title()).not.toBe("ran");
  });

  test("more than the limit isn't cut, and the API's refusal keeps it", async ({
    page,
  }) => {
    await openDraft(page);
    const tooLong = "x".repeat(10_001);
    await field(page, t.form.diagnosis).fill(tooLong);
    await button(page, t.save.action).click();

    await expect(page.getByText("The diagnosis is too long.")).toBeVisible();
    await expect(field(page, t.form.diagnosis)).toHaveValue(tooLong);
  });
});

test.describe("failures keep what was written", () => {
  test("a 500 says nothing was saved, and sends nothing again", async ({
    page,
  }) => {
    const id = await openDraft(page);
    await script(`PUT doctors/me/encounters/${id}`, 500);
    await field(page, t.form.diagnosis).fill(NOTE);
    await button(page, t.save.action).click();

    await expect(page.getByText(t.failure.notSaved)).toBeVisible();
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);
    await expect(page.getByText(t.status.unsaved)).toBeVisible();
    expect((await reads()).opened).toBe(1);
  });

  test("no answer says it isn't known", async ({ page }) => {
    const id = await openDraft(page);
    await script(`PUT doctors/me/encounters/${id}`, -1);
    await field(page, t.form.diagnosis).fill(NOTE);
    await button(page, t.save.action).click();

    await expect(page.getByText(t.failure.saveUnknown)).toBeVisible();
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);
  });

  for (const refusal of [403, 404]) {
    test(`a ${refusal} keeps the text on screen, and doesn't re-decide the page`, async ({
      page,
    }) => {
      const id = await openDraft(page);
      await script(`PUT doctors/me/encounters/${id}`, refusal);
      await field(page, t.form.diagnosis).fill(NOTE);
      await button(page, t.save.action).click();

      await expect(page.getByText(t.failure.stopped)).toBeVisible();
      await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);
      await expect(button(page, t.save.action)).toHaveCount(0);
    });
  }

  test("signing out failing keeps what's unsaved", async ({ page }) => {
    await openDraft(page);
    await field(page, t.form.diagnosis).fill(NOTE);
    await page.route("**/api/auth/sign-out", (route) => route.abort());

    await signOutButton(page, "en").click();
    await leave(page);

    await expect(page.getByText(m.auth.signOut.failure)).toBeVisible();
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);
    await expect(page.getByText(t.status.unsaved)).toBeVisible();
  });

  test("a session signed in to again from another tab isn't ended, and saving works", async ({
    page,
  }) => {
    await openDraft(page);
    await field(page, t.form.diagnosis).fill(NOTE);
    await page.route("**/api/backend/doctors/me/encounters/*", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ message: "Signed out." }),
          })
        : route.fallback(),
    );
    await button(page, t.save.action).click();
    await expect(shown(page, t.sessionEnded.heading)).toBeVisible();
    await page.unroute("**/api/backend/doctors/me/encounters/*");

    await button(page, t.sessionEnded.signIn).click();
    await expect(page.getByText(t.sessionEnded.heading)).toHaveCount(0);
    await expect(page).toHaveURL(/\/en\/my\/encounters\/\d+$/);
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);

    await button(page, t.save.action).click();
    await expect(page.getByText(t.save.done)).toBeVisible();
  });

  test("a real refusal of the role keeps the text too", async ({ page }) => {
    await openDraft(page);
    await field(page, t.form.diagnosis).fill(NOTE);
    await control(
      `account?email=${encodeURIComponent(ACCOUNTS.doctor)}&role=receptionist`,
    );
    await button(page, t.save.action).click();

    await expect(page.getByText(t.failure.stopped)).toBeVisible();
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);
  });

  test("a session ending during a save keeps the text, and leaves only when asked", async ({
    page,
  }) => {
    await openDraft(page);
    await field(page, t.form.diagnosis).fill(NOTE);
    await control(`revoke?email=${encodeURIComponent(ACCOUNTS.doctor)}`);
    await button(page, t.save.action).click();

    await expect(shown(page, t.sessionEnded.heading)).toBeVisible();
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);
    await expect(page).toHaveURL(/\/en\/my\/encounters\/\d+$/);

    await button(page, t.sessionEnded.signIn).click();
    await expect(page).toHaveURL(/\/en\/sign-in/);
    await page.goBack().catch(() => null);
    await expect(page.getByText(NOTE)).toHaveCount(0);
  });
});

test.describe("leaving with something unsaved", () => {
  test("a link warns, and staying keeps it, and leaving discards it", async ({
    page,
  }) => {
    const id = await openDraft(page);
    await field(page, t.form.diagnosis).fill(NOTE);

    await nav(page, m.shell.nav.mySchedule).click();
    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${record(id)}$`));
    await stay(page);
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);

    await nav(page, m.shell.nav.mySchedule).click();
    await leave(page);
    await expect(page).toHaveURL(/\/en\/my\/schedule$/);

    await pressBack(page);
    await expect(page).toHaveURL(new RegExp(`${record(id)}$`));
    await expect(field(page, t.form.diagnosis)).toHaveValue("");
  });

  test("the language switch warns", async ({ page }) => {
    const id = await openDraft(page);
    const before = (await reads()).opened;
    await field(page, t.form.diagnosis).fill(NOTE);

    await page.getByRole("link", { name: "العربية" }).click();
    await expect(dialog(page)).toBeVisible();
    await stay(page);
    await expect(page).toHaveURL(new RegExp(`${record(id)}$`));
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);
    expect((await reads()).opened).toBe(before);
  });

  test("signing out warns, and staying doesn't sign out", async ({ page }) => {
    await openDraft(page);
    await field(page, t.form.diagnosis).fill(NOTE);

    await signOutButton(page, "en").click();
    await expect(dialog(page)).toBeVisible();
    await stay(page);
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);

    await signOutButton(page, "en").click();
    await leave(page);
    await expect(page).toHaveURL(/\/en\/sign-in/);
  });

  test("closing or reloading asks the browser to warn", async ({ page }) => {
    await openDraft(page);
    await page.locator("main").click();
    await field(page, t.form.diagnosis).fill(NOTE);

    const asked = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(asked).toBe(true);
  });

  test("with nothing unsaved, nothing asks", async ({ page }) => {
    await openDraft(page);
    await nav(page, m.shell.nav.mySchedule).click();
    await expect(page).toHaveURL(/\/en\/my\/schedule$/);
    await expect(dialog(page)).toBeHidden();
  });
});

test.describe("another tab", () => {
  test("signing out leaves this tab too, as it was meant", async ({
    page,
    context,
  }) => {
    await openDraft(page);
    await field(page, t.form.diagnosis).fill(NOTE);

    const other = await context.newPage();
    await other.goto("/en/my/schedule");
    await signOutButton(other, "en").click();

    await expect(page).toHaveURL(/\/en\/sign-in/);
    await expect(page.getByText(NOTE)).toHaveCount(0);
  });

  test("finding the session ended keeps unsaved text here", async ({
    page,
    context,
  }) => {
    await openDraft(page);
    await field(page, t.form.diagnosis).fill(NOTE);

    const other = await context.newPage();
    await other.goto("/en/my/queue");
    await expect(
      other.getByRole("heading", { name: m.queue.own.listHeading }),
    ).toBeVisible();
    await control(`revoke?email=${encodeURIComponent(ACCOUNTS.doctor)}`);
    await other
      .getByRole("button", { name: m.shared.lastRead.refresh, exact: true })
      .click();
    await expect(other).toHaveURL(/\/en\/sign-in/);

    await expect(shown(page, t.sessionEnded.heading)).toBeVisible();
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);
    await expect(page).toHaveURL(/\/en\/my\/encounters\/\d+$/);
  });

  test("finding the session ended leaves a tab with nothing unsaved", async ({
    page,
    context,
  }) => {
    await openDraft(page);

    const other = await context.newPage();
    await other.goto("/en/my/queue");
    await expect(
      other.getByRole("heading", { name: m.queue.own.listHeading }),
    ).toBeVisible();
    await control(`revoke?email=${encodeURIComponent(ACCOUNTS.doctor)}`);
    await other
      .getByRole("button", { name: m.shared.lastRead.refresh, exact: true })
      .click();

    await expect(page).toHaveURL(/\/en\/sign-in/);
  });
});

test.describe("finalizing", () => {
  const finalize = async (page: Page) => {
    await button(page, t.finalize.action).click();
    await inDialog(page, t.finalize.confirm);
  };

  test("saves what's on screen, locks it, and shows it with no read", async ({
    page,
  }) => {
    await openDraft(page);
    const before = (await reads()).opened;
    await field(page, t.form.chiefComplaint).fill(COMPLETE.chief_complaint);
    await field(page, t.form.diagnosis).fill(NOTE);
    await finalize(page);

    await expect(
      page.getByRole("heading", { name: t.title, exact: true }),
    ).toBeFocused();
    await expect(shown(page, NOTE)).toBeVisible();
    await expect(field(page, t.form.diagnosis)).toHaveCount(0);
    await expect(button(page, t.save.action)).toHaveCount(0);
    expect(await reads()).toMatchObject({
      saves: 1,
      finalized: 1,
      opened: before,
    });
  });

  test("says what's missing on the fields, and stays a draft", async ({
    page,
  }) => {
    await openDraft(page);
    await finalize(page);

    await expect(
      page.getByText(
        "The chief_complaint is required to finalize this record.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("The diagnosis is required to finalize this record."),
    ).toBeVisible();
    await expect(field(page, t.form.diagnosis)).toBeVisible();
    expect((await reads()).finalized).toBe(0);
  });

  test("a failed save locks nothing", async ({ page }) => {
    const id = await openDraft(page, { content: COMPLETE });
    await script(`PUT doctors/me/encounters/${id}`, -1);
    await field(page, t.form.treatmentPlan).fill(NOTE);
    await finalize(page);

    await expect(page.getByText(t.failure.saveUnknown)).toBeVisible();
    expect((await reads()).finalized).toBe(0);
    await expect(field(page, t.form.treatmentPlan)).toHaveValue(NOTE);
  });

  test("finalized elsewhere keeps the text, and opens the record beside it when asked", async ({
    page,
  }) => {
    const id = await openDraft(page, { content: COMPLETE });
    await changeEncounter(id, { status: "finalized" });
    const before = (await reads()).opened;
    await field(page, t.form.treatmentPlan).fill(NOTE);
    await button(page, t.save.action).click();

    await expect(
      page.getByText("A finalized medical record cannot be changed."),
    ).toBeVisible();
    await expect(field(page, t.form.treatmentPlan)).toHaveValue(NOTE);
    expect((await reads()).opened).toBe(before);

    await button(page, t.failure.openAsItStands).click();
    await expect(shown(page, COMPLETE.diagnosis)).toBeVisible();
    await expect(field(page, t.form.treatmentPlan)).toHaveValue(NOTE);
    expect((await reads()).opened).toBe(before + 1);
  });

  test("says so when another tab's text is what was locked", async ({
    page,
  }) => {
    const id = await openDraft(page, { content: COMPLETE });
    await changeEncounter(id, { content: { diagnosis: "Another tab's text" } });
    await finalize(page);

    await expect(page.getByText(t.finalize.differs)).toBeVisible();
    await expect(shown(page, "Another tab's text")).toBeVisible();
  });

  test("the visit stays in progress", async ({ page }) => {
    const { id: visit } = await seedEntry(
      `status=with_doctor&patient=${PATIENT}`,
    );
    await seedEncounter({
      visit,
      patient: PATIENT,
      status: "finalized",
      content: COMPLETE,
    });
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");

    await expect(button(page, m.queue.own.finish.action)).toBeVisible();
    await expect(shown(page, status.finalized)).toBeVisible();
  });

  test("finishing a visit with no finalized record says so, and isn't blocked", async ({
    page,
  }) => {
    await seedEntry(`status=with_doctor&patient=${PATIENT}`);
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");
    await expect(shown(page, status.none)).toBeVisible();

    await button(page, m.queue.own.finish.action).click();
    await expect(dialog(page)).toContainText(m.queue.own.notFinalizedNote);
    await inDialog(page, m.queue.own.finish.confirm);
    await expect(shown(page, m.queue.own.nobodyWaiting)).toBeVisible();
  });
});

test.describe("my visits", () => {
  async function seedThree() {
    const doctor = await seedEntry(`status=seen&patient=${PATIENT}`);
    const draft = await seedEncounter({ patient: 3 });
    const done = await seedEncounter({
      patient: 1,
      status: "finalized",
      content: COMPLETE,
    });
    return { doctor, draft, done };
  }

  test("shows each record's status, and offers what matches", async ({
    page,
  }) => {
    const { draft, done } = await seedThree();
    await signIn(page, "doctor");
    await nav(page, m.shell.nav.myVisits).click();
    await expect(page).toHaveURL(/\/en\/my\/visits$/);

    await expect(button(page, t.actions.start)).toBeVisible();
    await expect(link(page, t.actions.continue)).toHaveAttribute(
      "href",
      record(draft.id),
    );
    await expect(link(page, t.actions.open)).toHaveAttribute(
      "href",
      record(done.id),
    );
  });

  test("filters survive a reload and going back", async ({ page }) => {
    await seedThree();
    await signIn(page, "doctor");
    await page.goto("/en/my/visits");

    await field(page, t.visits.recordStatus).selectOption("draft");
    await button(page, m.shared.filters.apply).click();
    await expect(page).toHaveURL(/record_status=draft/);
    await expect(shown(page, GAMMA)).toBeVisible();
    await expect(page.getByText(BETA)).toHaveCount(0);

    await page.reload();
    await expect(shown(page, GAMMA)).toBeVisible();
    await expect(page.getByText(BETA)).toHaveCount(0);

    await field(page, t.visits.recordStatus).selectOption("none");
    await button(page, m.shared.filters.apply).click();
    await expect(shown(page, BETA)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/record_status=draft/);
    await expect(shown(page, GAMMA)).toBeVisible();
  });

  test("a range over 92 days shows the API's refusal on the field", async ({
    page,
  }) => {
    await signIn(page, "doctor");
    await page.goto("/en/my/visits?from=2020-01-01&to=2026-01-01");
    await expect(
      page.getByText("The range can't be longer than 92 days."),
    ).toBeVisible();
    await expect(field(page, t.visits.to)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("an old visit with no record can be started", async ({ page }) => {
    await seedEntry(`status=seen&patient=${PATIENT}&date=2026-01-05`);
    await signIn(page, "doctor");
    await page.goto("/en/my/visits?from=2026-01-01&to=2026-01-31");

    await button(page, t.actions.start).click();
    await expect(page).toHaveURL(/\/en\/my\/encounters\/\d+$/);
    await expect(field(page, t.form.diagnosis)).toBeVisible();
    expect((await reads()).opened).toBe(0);
  });

  test("nothing reads a record but a person's click", async ({ page }) => {
    const { done } = await seedThree();
    await signIn(page, "doctor");
    await page.goto("/en/my/visits");

    await link(page, t.actions.open).hover();
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await field(page, t.visits.recordStatus).selectOption("finalized");
    await button(page, m.shared.filters.apply).click();
    await expect(page).toHaveURL(/record_status=finalized/);
    await page.waitForTimeout(500);
    expect((await reads()).opened).toBe(0);

    await link(page, t.actions.open).click();
    await expect(page).toHaveURL(new RegExp(`${record(done.id)}$`));
    await expect(shown(page, COMPLETE.diagnosis)).toBeVisible();
    expect((await reads()).opened).toBe(1);

    // Away and back reads nothing, and the same link again is a person asking.
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/my\/visits/);
    await page.goForward();
    await expect(shown(page, COMPLETE.diagnosis)).toBeVisible();
    expect((await reads()).opened).toBe(1);

    await page.goBack();
    await link(page, t.actions.open).click();
    await expect(shown(page, COMPLETE.diagnosis)).toBeVisible();
    await expect.poll(async () => (await reads()).opened).toBe(2);
  });

  test("a draft read again shows what the API holds now, not its first copy", async ({
    page,
  }) => {
    const { draft } = await seedThree();
    await signIn(page, "doctor");
    await page.goto("/en/my/visits");
    await link(page, t.actions.continue).click();
    await expect(page).toHaveURL(new RegExp(`${record(draft.id)}$`));
    await expect(field(page, t.form.diagnosis)).toHaveValue("");

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/my\/visits/);
    await changeEncounter(draft.id, {
      content: {
        diagnosis: "Another tab's text",
        last_saved_at: "2026-11-07T12:00:00.000000Z",
      },
    });

    await link(page, t.actions.continue).click();
    await expect(field(page, t.form.diagnosis)).toHaveValue(
      "Another tab's text",
    );
    await expect(page.getByText(t.status.saved)).toBeVisible();
  });

  test("an unknown or unreadable record gives the same neutral state", async ({
    page,
  }) => {
    const other = await anotherDoctor();
    const { id } = await seedEncounter({ doctor: other });
    await signIn(page, "doctor");

    await page.goto(record(id));
    await expect(shown(page, m.shared.states.notFoundHeading)).toBeVisible();
    const hidden = await page.locator("main").innerText();

    await page.goto(record(999_999));
    await expect(shown(page, m.shared.states.notFoundHeading)).toBeVisible();
    expect(await page.locator("main").innerText()).toBe(hidden);
  });
});

test.describe("a patient's history", () => {
  async function seedOthersRecord() {
    const other = await anotherDoctor();
    const { id } = await seedEncounter({
      doctor: other,
      patient: PATIENT,
      status: "finalized",
      date: "2026-01-15",
      content: COMPLETE,
    });
    return id;
  }

  test("from the queue to another doctor's record, read only, each read true", async ({
    page,
  }) => {
    await seedEntry(`status=waiting&patient=${PATIENT}`);
    const otherRecord = await seedOthersRecord();
    await signIn(page, "doctor");
    await page.goto("/en/my/queue");
    expect(await reads()).toMatchObject({ history: 0, opened: 0 });

    await link(page, t.actions.history).click();
    await expect(page).toHaveURL(
      new RegExp(`/en/my/patients/${PATIENT}/history$`),
    );
    await expect(shown(page, BETA)).toBeVisible();
    await expect.poll(async () => (await reads()).history).toBe(1);
    await expect(page.getByText(COMPLETE.diagnosis)).toHaveCount(0);

    await link(page, t.history.open).click();
    await expect(page).toHaveURL(new RegExp(`${record(otherRecord)}$`));
    await expect(shown(page, COMPLETE.diagnosis)).toBeVisible();
    await expect(page.getByLabel(t.addenda.label)).toHaveCount(0);
    expect(await reads()).toMatchObject({ history: 1, opened: 1 });
  });

  test("access ends when the patient has left", async ({ page }) => {
    const { id: entry } = await seedEntry(`status=waiting&patient=${PATIENT}`);
    const otherRecord = await seedOthersRecord();
    await signIn(page, "doctor");
    await page.goto(record(otherRecord));
    await expect(shown(page, COMPLETE.diagnosis)).toBeVisible();

    await control(`clinic/change-entry?id=${entry}&status=left`);
    await page.reload();
    await expect(shown(page, m.shared.states.notFoundHeading)).toBeVisible();
    await expect(page.getByText(COMPLETE.diagnosis)).toHaveCount(0);
  });

  test("a history the API refuses gives the same neutral state", async ({
    page,
  }) => {
    await seedOthersRecord();
    await signIn(page, "doctor");
    await page.goto(`/en/my/patients/${PATIENT}/history`);
    await expect(shown(page, m.shared.states.notFoundHeading)).toBeVisible();
    expect((await reads()).history).toBe(0);
  });

  test("no history is offered where the API would refuse", async ({ page }) => {
    await seedEntry(`status=seen&patient=${PATIENT}&date=2026-01-05`);
    await seedOthersRecord();
    await signIn(page, "doctor");
    await page.goto("/en/my/visits?from=2026-01-01&to=2026-01-31");

    await expect(button(page, t.actions.start)).toBeVisible();
    await expect(
      page.getByRole("link", { name: t.actions.history }),
    ).toHaveCount(0);
    expect((await reads()).history).toBe(0);
  });

  test("beside a draft, nothing reads until asked, and what's typed stays", async ({
    page,
  }) => {
    await seedEntry(`status=waiting&patient=${PATIENT}`);
    await seedOthersRecord();
    await openDraft(page, { patient: PATIENT });
    await field(page, t.form.diagnosis).fill(NOTE);
    expect((await reads()).history).toBe(0);

    await button(page, t.panel.open).click();
    const panel = page.getByRole("region", { name: t.panel.heading });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading").first()).toBeFocused();
    await expect(
      panel.getByRole("button", { name: t.history.open }),
    ).toBeVisible();
    expect((await reads()).history).toBe(1);

    const before = (await reads()).opened;
    await panel.getByRole("button", { name: t.history.open }).click();
    await expect(page.getByText(COMPLETE.diagnosis)).toBeVisible();
    expect((await reads()).opened).toBe(before + 1);
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);

    await page.getByRole("button", { name: t.panel.back }).click();
    expect((await reads()).opened).toBe(before + 1);

    await page.getByRole("button", { name: t.panel.close }).click();
    await expect(field(page, t.form.diagnosis)).toHaveValue(NOTE);
    await expect(button(page, t.panel.open)).toBeFocused();
    await expect(page.getByText(COMPLETE.diagnosis)).toHaveCount(0);

    await button(page, t.panel.open).click();
    await expect.poll(async () => (await reads()).history).toBe(2);
    await expect(dialog(page)).toBeHidden();
  });

  test("a draft for a patient not on today's list offers no panel", async ({
    page,
  }) => {
    await seedOthersRecord();
    await openDraft(page, { patient: 3, date: "2026-01-05" });
    await page.waitForTimeout(500);
    await expect(button(page, t.panel.open)).toHaveCount(0);
  });
});

test.describe("addenda", () => {
  async function openOwnFinalized(page: Page) {
    const { id } = await seedEncounter({
      status: "finalized",
      content: COMPLETE,
    });
    await signIn(page, "doctor");
    await page.goto(record(id));
    await expect(shown(page, COMPLETE.diagnosis)).toBeVisible();
    return id;
  }

  test("adds a correction, leaving the original, with no further read", async ({
    page,
  }) => {
    await openOwnFinalized(page);
    const before = (await reads()).opened;

    await field(page, t.addenda.label).fill(NOTE);
    await button(page, t.addenda.add).click();
    await expect(dialog(page)).toContainText(t.addenda.description);
    await inDialog(page, t.addenda.confirm);

    await expect(shown(page, NOTE)).toBeVisible();
    await expect(field(page, t.addenda.label)).toHaveValue("");
    await expect(shown(page, COMPLETE.diagnosis)).toBeVisible();
    expect(await reads()).toMatchObject({ addenda: 1, opened: before });
  });

  test("a refusal keeps the text", async ({ page }) => {
    const id = await openOwnFinalized(page);
    await script(`POST doctors/me/encounters/${id}/addenda`, 500);
    await field(page, t.addenda.label).fill(NOTE);
    await button(page, t.addenda.add).click();
    await inDialog(page, t.addenda.confirm);

    await expect(page.getByText(t.addenda.notAdded)).toBeVisible();
    await expect(field(page, t.addenda.label)).toHaveValue(NOTE);
  });

  test("unsaved text warns on leaving", async ({ page }) => {
    await openOwnFinalized(page);
    await field(page, t.addenda.label).fill(NOTE);
    await nav(page, m.shell.nav.mySchedule).click();
    await expect(dialog(page)).toBeVisible();
    await stay(page);
    await expect(field(page, t.addenda.label)).toHaveValue(NOTE);
  });

  test("a forced addendum on a draft or another doctor's record changes nothing", async ({
    page,
  }) => {
    const other = await anotherDoctor();
    await seedEntry(`status=waiting&patient=${PATIENT}`);
    const theirs = await seedEncounter({
      doctor: other,
      patient: PATIENT,
      status: "finalized",
      content: COMPLETE,
    });
    const mine = await seedEncounter({ patient: PATIENT });
    await signIn(page, "doctor");
    await page.goto("/en/my/visits");

    const send = (id: number) =>
      page.evaluate(
        async (target) =>
          (
            await fetch(
              `/api/backend/doctors/me/encounters/${target}/addenda`,
              {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ text: "Synthetic" }),
              },
            )
          ).status,
        id,
      );

    expect(await send(theirs.id)).toBe(403);
    expect(await send(mine.id)).toBe(422);
    expect((await reads()).addenda).toBe(0);
  });
});

test.describe("privacy", () => {
  test("clinical text stays out of everything that outlives the screen", async ({
    page,
  }) => {
    const MARKER = "SYNTHETIC-PLANTED-MARKER";
    await seedEntry(`status=waiting&patient=${PATIENT}`);
    const id = await openDraft(page, { patient: PATIENT, content: COMPLETE });
    const addresses: string[] = [];
    page.on("framenavigated", (frame) => addresses.push(frame.url()));

    await field(page, t.form.treatmentPlan).fill(MARKER);
    await button(page, t.form.lines.add).click();
    await field(page, t.form.lines.medication).fill(MARKER);
    await field(page, t.form.lines.dosage).fill(MARKER);
    await field(page, t.form.lines.frequency).fill(MARKER);
    await field(page, t.form.lines.duration).fill(MARKER);
    await button(page, t.save.action).click();
    await expect(page.getByText(t.save.done)).toBeVisible();
    await button(page, t.finalize.action).click();
    await inDialog(page, t.finalize.confirm);
    await expect(shown(page, t.addenda.heading)).toBeVisible();

    expect(await page.title()).not.toContain(MARKER);
    expect(await page.title()).not.toContain(BETA);
    expect(page.url()).toBe(new URL(record(id), page.url()).href);
    for (const address of addresses) expect(address).not.toContain(MARKER);
    const stored = await page.evaluate(async () => {
      const databases = (await indexedDB.databases?.()) ?? [];
      return JSON.stringify([
        { ...localStorage },
        { ...sessionStorage },
        databases,
        await caches.keys(),
        document.cookie,
      ]);
    });
    expect(stored).not.toContain(MARKER);

    await signOutButton(page, "en").click();
    await expect(page).toHaveURL(/\/en\/sign-in/);
    await page.goBack().catch(() => null);
    await expect(page.getByText(MARKER)).toHaveCount(0);
    await expect(page.getByText(BETA)).toHaveCount(0);
  });

  test("signing in doesn't return anyone to a clinical address", async ({
    page,
  }) => {
    const { id } = await seedEncounter();
    await page.goto(record(id));
    await expect(page).toHaveURL(/\/en\/sign-in/);
    await page.getByLabel(m.auth.signIn.email).fill(ACCOUNTS.doctor);
    await page.getByLabel(m.auth.signIn.password).fill("synthetic-password-1");
    await page
      .getByRole("button", { name: m.auth.signIn.submit, exact: true })
      .click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    expect((await reads()).opened).toBe(0);
  });
});

test.describe("in Arabic", () => {
  const a = messages.ar.encounters;

  test("writes, saves, and finalizes, with text as written", async ({
    page,
  }) => {
    const { id } = await seedEncounter();
    await signIn(page, "doctor", "ar");
    await page.goto(`/ar/my/encounters/${id}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const arabic = "شكوى تجريبية\nسطر ثانٍ with English";
    await field(page, a.form.chiefComplaint).fill(arabic);
    await field(page, a.form.diagnosis).fill("تشخيص تجريبي");
    await button(page, a.save.action).click();
    await expect(page.getByText(a.save.done)).toBeVisible();

    await button(page, a.finalize.action).click();
    await inDialog(page, a.finalize.confirm);
    const text = page.locator("main p[dir='auto']").first();
    await expect(text).toHaveText(arabic);
    await expect(page.getByRole("heading", { name: a.title })).toBeFocused();
  });

  test("my visits", async ({ page }) => {
    await seedEntry(`status=seen&patient=${PATIENT}`);
    await signIn(page, "doctor", "ar");
    await page.goto("/ar/my/visits");
    await expect(button(page, a.actions.start)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: a.visits.title }),
    ).toBeVisible();
  });
});
