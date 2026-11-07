import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { messages } from "../support/messages";
import {
  adminToken,
  api,
  apiSignIn,
  liveAccounts,
  liveDoctors,
  signInLive,
} from "./support";

// What a person sees against the real API, and how many permanent entries each action writes. These run on a
// production build, with this run's own doctors: see specs/007-queue/quickstart.md.
const m = messages.en;
const t = m.queue;
const CLINIC_ZONE = "Africa/Cairo";
const stamp = () => `${Date.now()}${randomBytes(2).toString("hex")}`;

const ENTRY_KEYS = [
  "appointment",
  "arrived_at",
  "called_at",
  "doctor",
  "finished_at",
  "id",
  "left_at",
  "patient",
  "queue_number",
  "status",
  "walk_in",
].sort();

let token = "";
let doctorToken = "";

test.beforeAll(async () => {
  token = await adminToken();
  const { email, password } = liveAccounts().queueDoctor;
  doctorToken = await apiSignIn(email, password);
});

const clinicDate = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offset * 86_400_000));

type Patient = { id: number; full_name: string };
type Entry = {
  id: number;
  queue_number: number;
  status: string;
  patient: Record<string, unknown>;
  appointment: { id: number } | null;
  doctor?: { id: number };
};

async function newPatient(): Promise<Patient> {
  const response = await api("patients", {
    method: "POST",
    token,
    body: {
      full_name: `Synthetic Live Queue ${stamp()}`,
      date_of_birth: "1990-04-12",
      sex: "female",
      phone: "01000000654",
    },
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: Patient }).data;
}

async function entries(id: number, action: string): Promise<number> {
  const response = await api(
    `audit-entries?patient_id=${id}&action=${action}&per_page=100`,
    { token },
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: unknown[] }).data.length;
}

async function allEntries(id: number): Promise<number> {
  const response = await api(`audit-entries?patient_id=${id}&per_page=100`, {
    token,
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: unknown[] }).data.length;
}

const opened = (id: number) => entries(id, "patient.opened");

type Slot = { date: string; start: string };

async function freeTimes(doctor: number, date: string): Promise<Slot[]> {
  const response = await api(
    `doctors/${doctor}/slots?from=${date}&to=${date}`,
    { token },
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: Slot[] }).data;
}

/** A booking for today, or tomorrow. The last minutes of the day have no time left today. */
async function book(patient: number, doctor: number, date = clinicDate()) {
  const [slot] = await freeTimes(doctor, date);
  test.skip(!slot, "No free time is left today, at the very end of the day.");
  const response = await api("appointments", {
    method: "POST",
    token,
    body: {
      patient_id: patient,
      doctor_id: doctor,
      date,
      start: slot?.start,
    },
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { id: number } }).data.id;
}

async function checkIn(appointment: number): Promise<Entry> {
  const response = await api(`appointments/${appointment}/check-in`, {
    method: "POST",
    token,
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: Entry }).data;
}

async function walkIn(patient: number, doctor: number): Promise<Entry> {
  const response = await api("queue/walk-ins", {
    method: "POST",
    token,
    body: { patient_id: patient, doctor_id: doctor },
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: Entry }).data;
}

async function doctorList(doctor: number): Promise<Entry[]> {
  const response = await api(`doctors/${doctor}/queue`, { token });
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: Entry[] }).data;
}

async function appointmentStatus(id: number): Promise<string> {
  const response = await api(`appointments/${id}`, { token });
  return ((await response.json()) as { data: { status: string } }).data.status;
}

/** Each test starts with nobody waiting or with this doctor, as a list can't be emptied any other way. */
async function clearList(doctor: number) {
  for (const entry of await doctorList(doctor)) {
    if (entry.status === "waiting") {
      await api(`queue/${entry.id}/leave`, { method: "POST", token });
    }
  }
  if (doctor === liveDoctors().queue) {
    await api("doctors/me/queue/finish", {
      method: "POST",
      token: doctorToken,
    });
  }
}

test.beforeEach(async () => {
  await clearList(liveDoctors().queue);
});

const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).locator("visible=true").first();
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).locator("visible=true");
const confirm = (page: Page, name: string) =>
  page
    .getByRole("alertdialog")
    .getByRole("button", { name, exact: true })
    .click();
const signInReception = (page: Page) =>
  signInLive(page, liveAccounts().receptionist);
const signInDoctor = (page: Page) =>
  signInLive(page, liveAccounts().queueDoctor);

async function newPage(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test.describe("checking in, against the real API", () => {
  test("through the page, writing one entry and opening nobody", async ({
    page,
  }) => {
    const patient = await newPatient();
    const { queue } = liveDoctors();
    const id = await book(patient.id, queue);
    const a = m.appointments;

    await signInReception(page);
    await page.goto(`/en/appointments/${id}`);
    await button(page, a.checkIn.action).click();
    await expect(page.getByText(/Queue number \d+/)).toBeVisible();
    await expect(
      page.locator("dl").getByText(m.shared.status.appointment.checked_in),
    ).toBeVisible();

    expect(await entries(patient.id, "visit.checked_in")).toBe(1);
    expect(await opened(patient.id)).toBe(0);

    await page.getByRole("link", { name: a.checkIn.seeList }).click();
    await expect(page).toHaveURL(new RegExp(`/queue\\?doctor_id=${queue}$`));
    await expect(shown(page, patient.full_name)).toBeVisible();
  });

  test("refused on a second attempt, and on another day", async () => {
    const patient = await newPatient();
    const { queue } = liveDoctors();
    const today = await book(patient.id, queue);
    await checkIn(today);

    const again = await api(`appointments/${today}/check-in`, {
      method: "POST",
      token,
    });
    expect(again.status).toBe(422);
    const body = (await again.json()) as { errors: Record<string, unknown> };
    expect(Object.keys(body.errors)).toEqual(["appointment"]);

    const later = await book(patient.id, queue, clinicDate(2));
    const early = await api(`appointments/${later}/check-in`, {
      method: "POST",
      token,
    });
    expect(early.status).toBe(422);
  });

  test("two at once give one entry", async () => {
    const patient = await newPatient();
    const { queue } = liveDoctors();
    const id = await book(patient.id, queue);
    const attempt = () =>
      api(`appointments/${id}/check-in`, { method: "POST", token });

    const answers = await Promise.all([attempt(), attempt()]);
    const statuses = answers.map(({ status }) => status).sort();
    expect(statuses[0]).toBe(201);
    expect(statuses[1]).not.toBe(201);
    expect([409, 422]).toContain(statuses[1]);

    const rows = (await doctorList(queue)).filter(
      (entry) => entry.appointment?.id === id,
    );
    expect(rows).toHaveLength(1);
  });
});

test.describe("reception's list, against the real API", () => {
  test("rows match the contract, and reading writes nothing", async ({
    page,
  }) => {
    const patient = await newPatient();
    const { queue, queueName } = liveDoctors();
    const id = await book(patient.id, queue);
    await checkIn(id);

    const list = await api("queue?per_page=100", { token });
    expect(list.status).toBe(200);
    const body = (await list.json()) as {
      data: (Record<string, unknown> & { id: number })[];
      meta: { total: number };
    };
    const raw = (await doctorList(queue)).find(
      (entry) => entry.appointment?.id === id,
    );
    const row = body.data.find(({ id: rowId }) => rowId === raw?.id);
    expect(Object.keys(row ?? {}).sort()).toEqual(ENTRY_KEYS);
    expect(row?.patient).toEqual({
      id: patient.id,
      full_name: patient.full_name,
      phone: "01000000654",
    });

    const before = await allEntries(patient.id);
    await signInReception(page);
    await page.goto(`/en/queue?doctor_id=${queue}`);
    await expect(
      page.getByRole("heading", { level: 3, name: new RegExp(queueName) }),
    ).toBeVisible();
    await expect(shown(page, patient.full_name)).toBeVisible();
    await page.reload();
    await expect(shown(page, patient.full_name)).toBeVisible();

    expect(await allEntries(patient.id)).toBe(before);
    expect(await opened(patient.id)).toBe(0);
  });

  test("filters match, and survive a reload", async ({ page }) => {
    const waiting = await newPatient();
    const gone = await newPatient();
    const { queue } = liveDoctors();
    await walkIn(waiting.id, queue);
    const left = await walkIn(gone.id, queue);
    await api(`queue/${left.id}/leave`, { method: "POST", token });

    await signInReception(page);
    await page.goto(`/en/queue?doctor_id=${queue}&status=left`);
    await expect(shown(page, gone.full_name)).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(waiting.full_name);
    await page.reload();
    await expect(shown(page, gone.full_name)).toBeVisible();

    await page.goto("/en/queue?status=waiting");
    await expect(shown(page, waiting.full_name)).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(gone.full_name);
  });

  test("a doctor who doesn't exist is not found", async ({ page }) => {
    await signInReception(page);
    await page.goto("/en/queue?doctor_id=999999");
    await expect(shown(page, m.shared.states.notFoundHeading)).toBeVisible();
  });
});

test.describe("adding a walk-in, against the real API", () => {
  test("carried from a patient's page, taking no free time, and refused twice", async ({
    page,
  }) => {
    const patient = await newPatient();
    const { queue, queueName } = liveDoctors();
    const free = await freeTimes(queue, clinicDate(1));

    await signInReception(page);
    await page.goto(`/en/patients/${patient.id}`);
    await expect.poll(() => opened(patient.id)).toBe(1);
    await page
      .getByRole("link", { name: m.patients.recordLinks.addToQueue })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/queue/walk-in\\?patient_id=${patient.id}$`),
    );

    const chooseDoctor = async () => {
      await page
        .getByLabel(m.doctors.name, { exact: true })
        .locator("visible=true")
        .fill(queueName);
      await page.getByRole("button", { name: m.doctors.chooser.find }).click();
      await page
        .getByRole("button", {
          name: m.doctors.chooser.chooseNamed.replace("{name}", queueName),
        })
        .locator("visible=true")
        .first()
        .click();
    };
    await chooseDoctor();
    await button(page, t.walkInForm.submit).click();

    await expect(page).toHaveURL(/\/en\/queue$/);
    await expect(page.getByText(/Queue number \d+/)).toBeVisible();
    expect(await entries(patient.id, "visit.walk_in_added")).toBe(1);
    expect(await opened(patient.id)).toBe(1);
    expect(await freeTimes(queue, clinicDate(1))).toEqual(free);

    await page.goto(`/en/queue/walk-in?patient_id=${patient.id}`);
    await chooseDoctor();
    await button(page, t.walkInForm.submit).click();
    await expect(page).toHaveURL(/walk-in/);
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(await entries(patient.id, "visit.walk_in_added")).toBe(1);
  });

  test("refused on patient_id for someone already on the list", async () => {
    const patient = await newPatient();
    const { queue } = liveDoctors();
    await walkIn(patient.id, queue);
    const again = await api("queue/walk-ins", {
      method: "POST",
      token,
      body: { patient_id: patient.id, doctor_id: queue },
    });
    expect(again.status).toBe(422);
    const body = (await again.json()) as { errors: Record<string, unknown> };
    expect(Object.keys(body.errors)).toEqual(["patient_id"]);
  });
});

test.describe("corrections, against the real API", () => {
  test("marking as left keeps the row, with one entry, and it's never called", async ({
    page,
  }) => {
    const patient = await newPatient();
    const { queue } = liveDoctors();
    await walkIn(patient.id, queue);

    await signInReception(page);
    await page.goto(`/en/queue?doctor_id=${queue}`);
    await button(page, t.left.action).click();
    await confirm(page, t.left.confirm);
    // In this patient's row, as earlier tests' rows on this list say "Left" too.
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: patient.full_name })
        .locator("visible=true"),
    ).toContainText(m.shared.status.queue.left);
    expect(await entries(patient.id, "visit.left")).toBe(1);

    const call = await api("doctors/me/queue/call-next", {
      method: "POST",
      token: doctorToken,
    });
    expect(call.status).toBe(422);
    const body = (await call.json()) as { errors: Record<string, unknown> };
    expect(Object.keys(body.errors)).toEqual(["queue"]);
  });

  test("undoing removes the row and schedules the appointment, and a new check-in gets a new number", async ({
    page,
  }) => {
    const patient = await newPatient();
    const { queue } = liveDoctors();
    const id = await book(patient.id, queue);
    const first = await checkIn(id);

    await signInReception(page);
    await page.goto(`/en/queue?doctor_id=${queue}`);
    const row = page
      .getByRole("row")
      .filter({ hasText: patient.full_name })
      .locator("visible=true");
    await row.getByRole("button", { name: t.undo.action }).click();
    await confirm(page, t.undo.confirm);
    await expect(page.getByText(t.undo.done)).toBeVisible();
    await expect(row).toHaveCount(0);

    expect(await entries(patient.id, "visit.check_in_undone")).toBe(1);
    expect(await appointmentStatus(id)).toBe("scheduled");

    const second = await checkIn(id);
    expect(second.queue_number).toBeGreaterThan(first.queue_number);
  });

  test("refused on `entry` once someone isn't waiting", async () => {
    const patient = await newPatient();
    const { queue } = liveDoctors();
    const entry = await walkIn(patient.id, queue);
    await api(`queue/${entry.id}/leave`, { method: "POST", token });

    for (const [method, path] of [
      ["POST", `queue/${entry.id}/leave`],
      ["DELETE", `queue/${entry.id}`],
    ] as const) {
      const answer = await api(path, { method, token });
      expect(answer.status).toBe(422);
      const body = (await answer.json()) as { errors: Record<string, unknown> };
      expect(Object.keys(body.errors)).toEqual(["entry"]);
    }
  });
});

test.describe("a doctor's list, against the real API", () => {
  test("call next and finish through the page, writing one entry each", async ({
    page,
  }) => {
    const patient = await newPatient();
    const { queue } = liveDoctors();
    const id = await book(patient.id, queue);
    await checkIn(id);

    await signInDoctor(page);
    await page.goto("/en/my/queue");
    await expect(shown(page, patient.full_name)).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText("01000000654");
    await expect(page.getByRole("main")).toContainText("1990-04-12");

    await button(page, t.own.callNext.action).click();
    await confirm(page, t.own.callNext.confirm);
    const current = page.getByRole("region", { name: t.own.currentHeading });
    await expect(current).toContainText(patient.full_name);
    expect(await entries(patient.id, "visit.called")).toBe(1);

    const again = await api("doctors/me/queue/call-next", {
      method: "POST",
      token: doctorToken,
    });
    expect(again.status).toBe(422);

    await button(page, t.own.finish.action).click();
    await confirm(page, t.own.finish.confirm);
    await expect(current).toHaveCount(0);
    await expect(shown(page, m.shared.status.queue.seen)).toBeVisible();
    expect(await entries(patient.id, "visit.finished")).toBe(1);
    expect(await appointmentStatus(id)).toBe("completed");
    expect(await opened(patient.id)).toBe(0);

    const none = await api("doctors/me/queue/finish", {
      method: "POST",
      token: doctorToken,
    });
    expect(none.status).toBe(422);
  });

  test("own rows hold what the contract says, with no phone or doctor", async () => {
    const patient = await newPatient();
    const { queue } = liveDoctors();
    await walkIn(patient.id, queue);

    const response = await api("doctors/me/queue", { token: doctorToken });
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Entry[] };
    const row = data.find((entry) => entry.patient.id === patient.id);
    expect(Object.keys(row ?? {}).sort()).toEqual(
      ENTRY_KEYS.filter((key) => key !== "doctor"),
    );
    expect(Object.keys(row?.patient ?? {}).sort()).toEqual(
      ["date_of_birth", "full_name", "id", "sex"].sort(),
    );
  });

  test("each side refuses the other's routes", async () => {
    const patient = await newPatient();
    const { queue } = liveDoctors();
    const entry = await walkIn(patient.id, queue);
    const reception = await apiSignIn(
      liveAccounts().receptionist.email,
      liveAccounts().receptionist.password,
    );

    for (const [method, path] of [
      ["GET", "queue"],
      ["GET", `doctors/${queue}/queue`],
      ["POST", "queue/walk-ins"],
      ["POST", `queue/${entry.id}/leave`],
      ["DELETE", `queue/${entry.id}`],
    ] as const) {
      const answer = await api(path, { method, token: doctorToken });
      expect(answer.status).toBe(403);
    }
    for (const [method, path] of [
      ["GET", "doctors/me/queue"],
      ["POST", "doctors/me/queue/call-next"],
      ["POST", "doctors/me/queue/finish"],
    ] as const) {
      const answer = await api(path, { method, token: reception });
      expect(answer.status).toBe(403);
    }
  });
});

test.describe("two computers, against the real API", () => {
  test("each sees the other's change within 20 seconds, with no interaction", async ({
    browser,
  }) => {
    const first = await newPatient();
    const { queue } = liveDoctors();
    await walkIn(first.id, queue);

    const desk = await newPage(browser);
    const room = await newPage(browser);
    await signInReception(desk.page);
    await signInDoctor(room.page);
    await desk.page.goto(`/en/queue?doctor_id=${queue}`);
    await room.page.goto("/en/my/queue");
    await expect(shown(desk.page, first.full_name)).toBeVisible();
    await expect(shown(room.page, first.full_name)).toBeVisible();

    // The doctor acts, and reception's screen follows.
    await button(room.page, t.own.callNext.action).click();
    await confirm(room.page, t.own.callNext.confirm);
    await expect(
      shown(desk.page, m.shared.status.queue.with_doctor),
    ).toBeVisible({ timeout: 20_000 });

    // Reception acts, and the doctor's screen follows.
    const second = await newPatient();
    await walkIn(second.id, queue);
    await expect(shown(room.page, second.full_name)).toBeVisible({
      timeout: 20_000,
    });

    await desk.context.close();
    await room.context.close();
  });

  test("several refreshes add no entries, and leave no details behind", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const patient = await newPatient();
    const { queue } = liveDoctors();
    await walkIn(patient.id, queue);
    const before = await allEntries(patient.id);

    await signInReception(page);
    const addresses: string[] = [];
    page.on("framenavigated", (frame) => addresses.push(frame.url()));
    await page.goto(`/en/queue?doctor_id=${queue}`);
    await expect(shown(page, patient.full_name)).toBeVisible();

    // Four real intervals.
    await page.waitForTimeout(62_000);
    await expect(shown(page, patient.full_name)).toBeVisible();
    expect(await allEntries(patient.id)).toBe(before);
    expect(await opened(patient.id)).toBe(0);

    const stored = await page.evaluate(() =>
      JSON.stringify([{ ...localStorage }, { ...sessionStorage }]),
    );
    const log = readFileSync(".next/e2e-live-app-server.log", "utf8");
    for (const detail of [patient.full_name, "01000000654"]) {
      expect(addresses.join()).not.toContain(detail);
      expect(stored).not.toContain(detail);
      expect(log).not.toContain(detail);
    }
  });
});
