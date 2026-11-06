import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { signOutButton } from "../support/auth";
import { messages } from "../support/messages";
import {
  adminToken,
  api,
  apiSignIn,
  liveAccounts,
  liveDoctors,
  signInLive,
} from "./support";

// What a person sees against the real API, and how many permanent entries each action writes. These run on
// a production build, with this run's own doctors: see specs/006-appointments/quickstart.md.
const m = messages.en;
const t = m.appointments;
const stamp = () => `${Date.now()}${randomBytes(2).toString("hex")}`;
const CLINIC_ZONE = "Africa/Cairo";

let token = "";

test.beforeAll(async () => {
  token = await adminToken();
});

const clinicDate = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offset * 86_400_000));

const clinicClock = (at: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);

type Patient = { id: number; full_name: string };

async function newPatient(): Promise<Patient> {
  const response = await api("patients", {
    method: "POST",
    token,
    body: {
      full_name: `Synthetic Live Booker ${stamp()}`,
      date_of_birth: "1990-04-12",
      sex: "female",
      phone: "01000000321",
    },
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: Patient }).data;
}

/** How many entries of this kind the audit trail holds for the patient. */
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

type Slot = { date: string; start: string; end: string };

async function freeTimes(doctor: number, date: string): Promise<Slot[]> {
  const response = await api(
    `doctors/${doctor}/slots?from=${date}&to=${date}`,
    {
      token,
    },
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: Slot[] }).data;
}

async function book(
  patient: number,
  doctor: number,
  date: string,
  start: string,
): Promise<{ id: number }> {
  const response = await api("appointments", {
    method: "POST",
    token,
    body: { patient_id: patient, doctor_id: doctor, date, start },
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { id: number } }).data;
}

/** A date with no bookings yet for this doctor in this run, as each test takes its own. */
let nextOffset = 3;
const freshDate = () => clinicDate((nextOffset += 1));

const visible = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).locator("visible=true");
const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).locator("visible=true").first();
const firstFreeTime = (page: Page) =>
  page.getByRole("radio").locator("visible=true").first();

async function pickFirstTime(page: Page): Promise<Slot> {
  const radio = firstFreeTime(page);
  await page.locator("label", { has: radio }).first().click();
  await expect(radio).toBeChecked();
  const name = (await radio.getAttribute("aria-label")) ?? "";
  const [date = "", start = "", , end = ""] = name.replace(",", "").split(" ");
  return { date, start, end };
}

async function choosePatient(page: Page, patient: Patient) {
  await visible(page, m.patients.fields.number).fill(String(patient.id));
  await page
    .getByRole("button", { name: m.patients.search.button, exact: true })
    .click();
  await page
    .getByRole("button", {
      name: m.patients.chooser.chooseNamed.replace("{name}", patient.full_name),
    })
    .locator("visible=true")
    .first()
    .click();
}

async function chooseDoctor(page: Page, name: string) {
  await visible(page, m.doctors.name).fill(name);
  await page.getByRole("button", { name: m.doctors.chooser.find }).click();
  await page
    .getByRole("button", {
      name: m.doctors.chooser.chooseNamed.replace("{name}", name),
    })
    .locator("visible=true")
    .first()
    .click();
}

const bookButton = (page: Page) =>
  page.getByRole("button", { name: t.booking.submit, exact: true });

async function signInReception(page: Page) {
  await signInLive(page, liveAccounts().receptionist);
}

test.describe("finding appointments, against the real API", () => {
  test("rows, details, and page data match the contract, and reading writes nothing", async ({
    page,
  }) => {
    const patient = await newPatient();
    const { booking, bookingName } = liveDoctors();
    const date = freshDate();
    const [slot] = await freeTimes(booking, date);
    if (!slot) throw new Error("The doctor should have free times.");
    const { id } = await book(patient.id, booking, date, slot.start);

    const list = await api(
      `appointments?from=${date}&to=${date}&doctor_id=${booking}`,
      { token },
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as {
      data: Record<string, unknown>[];
      meta: Record<string, unknown>;
    };
    expect(Object.keys(body.data[0] ?? {}).sort()).toEqual(
      [
        "date",
        "doctor",
        "end",
        "id",
        "outside_availability",
        "patient",
        "start",
        "status",
      ].sort(),
    );
    expect(body.data[0]?.patient).toEqual({
      id: patient.id,
      full_name: patient.full_name,
      phone: "01000000321",
    });
    expect(body.meta.total).toBe(1);

    const before = await allEntries(patient.id);
    await signInReception(page);
    await page.goto(`/en/appointments?from=${date}&to=${date}`);
    await expect(shown(page, patient.full_name)).toBeVisible();
    await page.reload();
    await expect(shown(page, patient.full_name)).toBeVisible();

    await page.goto(`/en/appointments/${id}`);
    await expect(page.locator("dl").getByText(bookingName)).toBeVisible();
    await expect(
      page.locator("dl").getByText(slot.start, { exact: false }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator("dl").getByText(bookingName)).toBeVisible();
    expect(await allEntries(patient.id)).toBe(before);
    expect(await opened(patient.id)).toBe(0);
  });

  test("filters match, and a range over 92 days is refused on that filter", async ({
    page,
  }) => {
    const patient = await newPatient();
    const other = await newPatient();
    const { booking } = liveDoctors();
    const date = freshDate();
    const slots = await freeTimes(booking, date);
    await book(patient.id, booking, date, slots[0]?.start ?? "");
    await book(other.id, booking, date, slots[1]?.start ?? "");

    await signInReception(page);
    await page.goto(`/en/appointments?from=${date}&to=${date}`);
    await expect(shown(page, patient.full_name)).toBeVisible();
    await expect(shown(page, other.full_name)).toBeVisible();

    await page.goto(`/en/appointments?patient_id=${patient.id}`);
    await expect(shown(page, patient.full_name)).toBeVisible();
    await expect(
      page.getByRole("table").getByText(other.full_name),
    ).toHaveCount(0);
    expect(await opened(patient.id)).toBe(0);

    await page.goto(
      `/en/appointments?from=${date}&to=${date}&doctor_id=${booking}&status=cancelled`,
    );
    await expect(shown(page, t.empty.filteredTitle)).toBeVisible();

    await page.goto("/en/appointments?from=2026-01-01&to=2026-12-31");
    await expect(visible(page, t.fields.to)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByRole("table")).toHaveCount(0);

    const refused = await api("appointments?from=2026-01-01&to=2026-12-31", {
      token,
    });
    expect(refused.status).toBe(422);
    expect(
      Object.keys(
        ((await refused.json()) as { errors: Record<string, unknown> }).errors,
      ),
    ).toEqual(["to"]);
  });
});

test.describe("booking, against the real API", () => {
  test("a booking writes one entry, opens nobody, and takes the time", async ({
    page,
  }) => {
    const patient = await newPatient();
    const { booking, bookingName } = liveDoctors();

    await signInReception(page);
    await page.goto("/en/appointments/new");
    await choosePatient(page, patient);
    await chooseDoctor(page, bookingName);
    const slot = await pickFirstTime(page);
    await visible(page, t.booking.noteLabel).fill("ملاحظة تجريبية");
    await bookButton(page).click();

    await expect(page).toHaveURL(/\/en\/appointments\/\d+$/);
    await expect(page.locator("dl").getByText("ملاحظة تجريبية")).toBeVisible();

    expect(await entries(patient.id, "appointment.booked")).toBe(1);
    expect(await opened(patient.id)).toBe(0);
    const left = await freeTimes(booking, slot.date);
    expect(left.some(({ start }) => start === slot.start)).toBe(false);
  });

  test("both patient-page links write no further opening, and the list read writes none", async ({
    page,
  }) => {
    const patient = await newPatient();
    const lookup = await api(`patients?id=${patient.id}`, { token });
    expect(lookup.status).toBe(200);
    expect(await opened(patient.id)).toBe(0);

    await signInReception(page);
    await page.goto(`/en/patients/${patient.id}`);
    await expect(
      page.getByRole("heading", { name: m.patients.record.detailsHeading }),
    ).toBeVisible();
    expect(await opened(patient.id)).toBe(1);

    await page.getByRole("link", { name: m.patients.recordLinks.view }).click();
    await expect(page).toHaveURL(
      new RegExp(`/en/appointments\\?patient_id=${patient.id}$`),
    );
    await expect(page.getByText(t.patientFilter.heading)).toBeVisible();
    await expect(page.getByText(patient.full_name).first()).toBeVisible();
    expect(await opened(patient.id)).toBe(1);

    await page.goBack();
    await page.getByRole("link", { name: m.patients.recordLinks.book }).click();
    await expect(page).toHaveURL(
      new RegExp(`/en/appointments/new\\?patient_id=${patient.id}$`),
    );
    await expect(page.getByText(patient.full_name).first()).toBeVisible();
    expect(await opened(patient.id)).toBe(1);
  });

  test("two simultaneous bookings: exactly one succeeds, the other is told why", async ({
    page,
  }) => {
    const first = await newPatient();
    const second = await newPatient();
    const { booking, bookingName } = liveDoctors();
    const date = freshDate();
    const [slot] = await freeTimes(booking, date);
    if (!slot) throw new Error("The doctor should have free times.");

    const answers = await Promise.all(
      [first, second].map((patient) =>
        api("appointments", {
          method: "POST",
          token,
          body: {
            patient_id: patient.id,
            doctor_id: booking,
            date,
            start: slot.start,
          },
        }),
      ),
    );
    expect(answers.map(({ status }) => status).sort()).toEqual([201, 409]);
    const loser = answers.find(({ status }) => status === 409);
    expect(
      ((await loser?.json()) as { reason: string } | undefined)?.reason,
    ).toBe("slot_booked");

    // Through the page: someone takes the time after the screen has read it.
    const third = await newPatient();
    const taker = await newPatient();
    await signInReception(page);
    await page.goto("/en/appointments/new");
    await choosePatient(page, third);
    await chooseDoctor(page, bookingName);
    const chosen = await pickFirstTime(page);
    await visible(page, t.booking.noteLabel).fill("First visit");
    await book(taker.id, booking, chosen.date, chosen.start);
    await bookButton(page).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(visible(page, t.booking.noteLabel)).toHaveValue("First visit");
    await expect(page.getByText(third.full_name).first()).toBeVisible();

    await pickFirstTime(page);
    await bookButton(page).click();
    await expect(page).toHaveURL(/\/en\/appointments\/\d+$/);
    await expect(page.locator("dl").getByText("First visit")).toBeVisible();
    expect(await entries(third.id, "appointment.booked")).toBe(1);
  });

  test("a busy patient is refused across doctors, with a link to their day", async ({
    page,
  }) => {
    const patient = await newPatient();
    const { booking, second, secondName } = liveDoctors();

    // The same time with both doctors, on a date neither has used yet.
    const date = freshDate();
    const [slot] = await freeTimes(booking, date);
    if (!slot) throw new Error("The doctor should have free times.");
    const chosen = { date, start: slot.start };

    await signInReception(page);
    await page.goto(`/en/appointments/new?patient_id=${patient.id}`);
    await chooseDoctor(page, secondName);
    await visible(page, m.scheduling.freeTimes.from).fill(date);
    const radio = page.getByRole("radio", {
      name: new RegExp(`^${date}, ${slot.start} `),
    });
    await page.locator("label", { has: radio }).click();
    await expect(radio).toBeChecked();
    await book(patient.id, booking, date, slot.start);
    await bookButton(page).click();

    const link = page.getByRole("link", { name: t.booking.seePatient });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      "href",
      new RegExp(
        `patient_id=${patient.id}&from=${chosen.date}&to=${chosen.date}$`,
      ),
    );
    const left = await freeTimes(second, chosen.date);
    expect(left.some(({ start }) => start === chosen.start)).toBe(true);

    const refused = await api("appointments", {
      method: "POST",
      token,
      body: {
        patient_id: patient.id,
        doctor_id: second,
        date: chosen.date,
        start: chosen.start,
      },
    });
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { reason: string }).reason).toBe(
      "patient_busy",
    );
  });

  test("a time that isn't on offer is refused under the start", async () => {
    const patient = await newPatient();
    const { booking } = liveDoctors();
    const refused = await api("appointments", {
      method: "POST",
      token,
      body: {
        patient_id: patient.id,
        doctor_id: booking,
        date: freshDate(),
        start: "03:00",
      },
    });
    expect(refused.status).toBe(422);
    expect(
      Object.keys(
        ((await refused.json()) as { errors: Record<string, unknown> }).errors,
      ),
    ).toEqual(["start"]);
  });
});

test.describe("changes, against the real API", () => {
  test("rescheduling keeps the number, frees the old time, and writes one entry", async ({
    page,
  }) => {
    const patient = await newPatient();
    const { booking } = liveDoctors();
    const date = clinicDate(1);
    const slots = await freeTimes(booking, date);
    const original = slots[slots.length - 1];
    if (!original) throw new Error("The doctor should have free times.");
    const { id } = await book(patient.id, booking, date, original.start);

    await signInReception(page);
    await page.goto(`/en/appointments/${id}`);
    await page.getByRole("button", { name: t.actions.reschedule }).click();
    await expect(page.getByText(`Current time: ${date}`)).toBeVisible();
    const target = await pickFirstTime(page);
    await page.getByRole("button", { name: t.reschedule.submit }).click();

    await expect(page.getByText(t.details.rescheduledAt)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/appointments/${id}$`));
    await expect(page.locator("dl").getByText(target.date)).toBeVisible();

    expect(await entries(patient.id, "appointment.rescheduled")).toBe(1);
    expect(await opened(patient.id)).toBe(0);
    const freed = await freeTimes(booking, date);
    expect(freed.some(({ start }) => start === original.start)).toBe(true);
  });

  test("cancelling records the reason as written, frees the time, and writes one entry", async ({
    page,
  }) => {
    const patient = await newPatient();
    const { booking } = liveDoctors();
    const date = freshDate();
    const [slot] = await freeTimes(booking, date);
    if (!slot) throw new Error("The doctor should have free times.");
    const { id } = await book(patient.id, booking, date, slot.start);
    expect(
      (await freeTimes(booking, date)).some(
        ({ start }) => start === slot.start,
      ),
    ).toBe(false);

    await signInReception(page);
    await page.goto(`/en/appointments/${id}`);
    await page.getByRole("button", { name: t.actions.cancel }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByLabel(t.cancel.reasonLabel).fill("المريض مسافر");
    await dialog.getByRole("button", { name: t.cancel.confirm }).click();

    await expect(page.locator("dl").getByText("المريض مسافر")).toBeVisible();
    await expect(
      page.locator("dl").getByText(m.shared.status.appointment.cancelled),
    ).toBeVisible();
    await expect(page.locator("dl")).toContainText(
      "Synthetic Live receptionist",
    );
    await expect(
      page.getByRole("button", { name: t.actions.cancel }),
    ).toHaveCount(0);

    expect(await entries(patient.id, "appointment.cancelled")).toBe(1);
    expect(
      (await freeTimes(booking, date)).some(
        ({ start }) => start === slot.start,
      ),
    ).toBe(true);
  });

  test("time off makes one need moving, and moving it removes that", async ({
    page,
  }) => {
    const patient = await newPatient();
    const { booking } = liveDoctors();
    const date = freshDate();
    const [slot] = await freeTimes(booking, date);
    if (!slot) throw new Error("The doctor should have free times.");
    const { id } = await book(patient.id, booking, date, slot.start);

    const off = await api(`doctors/${booking}/time-off`, {
      method: "POST",
      token,
      body: { start_date: date, end_date: date },
    });
    expect(off.status).toBe(201);

    await signInReception(page);
    await page.goto(`/en/appointments?patient_id=${patient.id}`);
    await expect(shown(page, t.outsideLabel)).toBeVisible();

    await page.getByRole("link", { name: t.views.needingMove }).click();
    await expect(page).toHaveURL(/outside_availability=1/);
    await expect(shown(page, patient.full_name)).toBeVisible();

    await page.goto(`/en/appointments/${id}`);
    await expect(page.getByText(t.outsideNotice.title)).toBeVisible();
    await page.getByRole("button", { name: t.actions.reschedule }).click();
    await pickFirstTime(page);
    await page.getByRole("button", { name: t.reschedule.submit }).click();
    await expect(page.getByText(t.outsideNotice.title)).toHaveCount(0);

    await page.goto(
      `/en/appointments?patient_id=${patient.id}&outside_availability=1`,
    );
    await expect(shown(page, t.empty.moveTitle)).toBeVisible();
  });
});

test.describe("a no-show, against the real API", () => {
  test("is refused before the start, and recorded after a real start passes", async ({
    page,
  }) => {
    // Up to about six minutes: the API refuses a booking in the past, so real time has to pass (research R10).
    test.setTimeout(480_000);

    const FIVE_MINUTES = 300_000;
    const boundary = new Date(
      Math.ceil((Date.now() + 60_000) / FIVE_MINUTES) * FIVE_MINUTES,
    );
    const start = clinicClock(boundary);
    const after = clinicClock(new Date(boundary.getTime() + FIVE_MINUTES));
    test.skip(
      after <= start,
      "The clinic's day is ending, so no period exists to book. Repeat the run at another time.",
    );

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: CLINIC_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(boundary);
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: CLINIC_ZONE,
      weekday: "long",
    })
      .format(boundary)
      .toLowerCase();

    const { noShow } = liveDoctors();
    const hours = await api(`doctors/${noShow}/schedule`, {
      method: "PUT",
      token,
      body: {
        appointment_minutes: 5,
        periods: [{ day, start, end: after }],
      },
    });
    expect(hours.status).toBe(200);

    const patient = await newPatient();
    const { id } = await book(patient.id, noShow, today, start);

    // Before the start, the API refuses under `appointment`, and the page doesn't offer it.
    const early = await api(`appointments/${id}/no-show`, {
      method: "POST",
      token,
    });
    expect(early.status).toBe(422);
    expect(
      Object.keys(
        ((await early.json()) as { errors: Record<string, unknown> }).errors,
      ),
    ).toEqual(["appointment"]);

    await signInReception(page);
    await page.goto(`/en/appointments/${id}`);
    await expect(
      page.getByRole("button", { name: t.actions.reschedule }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: t.actions.noShow }),
    ).toHaveCount(0);

    // This page is now out of date, and still offers cancelling once the start has passed.
    await page.waitForTimeout(boundary.getTime() - Date.now() + 5_000);
    await page.getByRole("button", { name: t.actions.cancel }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.cancel.confirm })
      .click();

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(await entries(patient.id, "appointment.cancelled")).toBe(0);

    await page.getByRole("button", { name: t.actions.noShow }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.noShow.confirm })
      .click();

    await expect(
      page.locator("dl").getByText(m.shared.status.appointment.no_show),
    ).toBeVisible();
    expect(await entries(patient.id, "appointment.no_show")).toBe(1);
    expect(await opened(patient.id)).toBe(0);
  });
});

test.describe("each role, against the real API", () => {
  test("a doctor sees only their own, with no phone and no actions", async ({
    page,
  }) => {
    const accounts = liveAccounts();
    const { booking, second } = liveDoctors();
    const mine = await newPatient();
    const theirs = await newPatient();
    const today = clinicDate(0);
    const date = clinicDate(1);
    const [slot] = await freeTimes(booking, date);
    const [otherSlot] = await freeTimes(second, date);
    if (!slot || !otherSlot) throw new Error("Free times were expected.");
    const own = await book(mine.id, booking, date, slot.start);
    const other = await book(theirs.id, second, date, otherSlot.start);

    await signInLive(page, accounts.bookingDoctor);
    await page.goto(`/en/my/appointments?from=${today}&to=${date}`);
    await expect(shown(page, mine.full_name)).toBeVisible();
    await expect(
      page.getByRole("table").getByText(theirs.full_name),
    ).toHaveCount(0);
    await expect(page.getByText("01000000321")).toHaveCount(0);
    await expect(shown(page, "1990-04-12")).toBeVisible();

    await page.goto(`/en/my/appointments/${own.id}`);
    await expect(page.locator("dl").getByText(mine.full_name)).toBeVisible();
    await expect(page.getByText("01000000321")).toHaveCount(0);
    await expect(page.locator("dl").getByRole("link")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: t.actions.cancel }),
    ).toHaveCount(0);

    await page.goto(`/en/my/appointments/${other.id}`);
    await expect(page.getByText(m.shared.states.notFoundHeading)).toBeVisible();
    await expect(page.getByText(theirs.full_name)).toHaveCount(0);

    await page.goto("/en/appointments");
    await expect(
      page.getByText(m.shared.states.forbiddenHeading),
    ).toBeVisible();

    const doctorToken = await apiSignIn(
      accounts.bookingDoctor.email,
      accounts.bookingDoctor.password,
    );
    for (const [path, method, body] of [
      ["appointments?from=2026-11-01&to=2026-11-02", "GET", undefined],
      [`appointments/${own.id}`, "GET", undefined],
      [`appointments/${own.id}/cancel`, "POST", {}],
      [`appointments/${own.id}/no-show`, "POST", undefined],
      [
        `appointments/${own.id}/reschedule`,
        "POST",
        { date, start: slot.start },
      ],
    ] as const) {
      const refused = await api(path, {
        method,
        token: doctorToken,
        ...(body ? { body } : {}),
      });
      expect(refused.status).toBe(403);
    }
    await api("auth/sign-out", { method: "POST", token: doctorToken });
  });

  test("a doctor with no profile gets that state", async ({ page }) => {
    await signInLive(page, liveAccounts().newDoctor);
    await page.goto("/en/my/appointments");
    await expect(page.getByText(m.auth.noProfile.heading)).toBeVisible();
  });
});

test.describe("a whole journey", () => {
  test("is quick enough, and leaves no details behind", async ({ page }) => {
    const patient = await newPatient();
    const { bookingName } = liveDoctors();
    const note = `Synthetic note ${stamp()}`;
    const reason = `Synthetic reason ${stamp()}`;
    const term = `Synthetic Live Booker`;
    const visited: string[] = [];
    page.on("framenavigated", (frame) => visited.push(frame.url()));

    await signInReception(page);

    // SC-001, by script: only a guard against slowness, as a person's speed needs a person.
    const started = Date.now();
    await page.goto("/en/appointments");
    await page.getByRole("link", { name: t.book }).first().click();
    await visible(page, m.patients.fields.fullName).fill(patient.full_name);
    await page
      .getByRole("button", { name: m.patients.search.button, exact: true })
      .click();
    await page
      .getByRole("button", {
        name: m.patients.chooser.chooseNamed.replace(
          "{name}",
          patient.full_name,
        ),
      })
      .locator("visible=true")
      .first()
      .click();
    await chooseDoctor(page, bookingName);
    await pickFirstTime(page);
    await visible(page, t.booking.noteLabel).fill(note);
    await bookButton(page).click();
    await expect(page).toHaveURL(/\/en\/appointments\/\d+$/);
    expect(Date.now() - started).toBeLessThan(60_000);

    // SC-004, by script, as above.
    const moving = Date.now();
    await page.getByRole("button", { name: t.actions.reschedule }).click();
    await pickFirstTime(page);
    await page.getByRole("button", { name: t.reschedule.submit }).click();
    await expect(page.getByText(t.details.rescheduledAt)).toBeVisible();
    expect(Date.now() - moving).toBeLessThan(60_000);

    await page.getByRole("button", { name: t.actions.cancel }).click();
    await page
      .getByRole("alertdialog")
      .getByLabel(t.cancel.reasonLabel)
      .fill(reason);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.cancel.confirm })
      .click();
    await expect(page.locator("dl").getByText(reason)).toBeVisible();

    await signOutButton(page, "en").click();
    await expect(page).toHaveURL(/\/en\/sign-in/);

    const details = [patient.full_name, note, reason, "01000000321"];
    for (const url of visited) {
      const address = decodeURIComponent(url);
      for (const detail of details) expect(address).not.toContain(detail);
      expect(address).not.toContain(term);
    }

    await page.goBack();
    await page.waitForLoadState("networkidle");
    const onScreen = (await page.locator("body").textContent()) ?? "";
    const stored = await page.evaluate(() =>
      JSON.stringify([{ ...localStorage }, { ...sessionStorage }]),
    );
    for (const detail of details) {
      expect(onScreen).not.toContain(detail);
      expect(stored).not.toContain(detail);
    }

    // SC-005: the application server's own output.
    const log = readFileSync(".next/e2e-live-app-server.log", "utf8");
    expect(log.length).toBeGreaterThan(0);
    for (const detail of details) expect(log).not.toContain(detail);
  });
});
