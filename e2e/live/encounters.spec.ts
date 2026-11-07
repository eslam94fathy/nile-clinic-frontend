import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "../support/messages";
import {
  adminToken,
  api,
  apiSignIn,
  liveAccounts,
  liveDoctors,
  signInLive,
} from "./support";

// What a doctor sees against the real API, and how many permanent entries each action writes. These run on a
// production build, with this run's own doctors: see specs/008-medical-encounters/quickstart.md. All text is synthetic.
const m = messages.en;
const t = m.encounters;
const stamp = () => `${Date.now()}${randomBytes(2).toString("hex")}`;

let admin = "";
let doctorToken = "";
let secondToken = "";

const accounts = () => liveAccounts();
const doctors = () => liveDoctors();

test.beforeAll(async () => {
  admin = await adminToken();
  const { encounterDoctor, secondEncounterDoctor } = accounts();
  doctorToken = await apiSignIn(
    encounterDoctor.email,
    encounterDoctor.password,
  );
  secondToken = await apiSignIn(
    secondEncounterDoctor.email,
    secondEncounterDoctor.password,
  );
});

/** Each doctor's list must be clear for the next test, as "call next" takes whoever's next. */
test.afterEach(async () => {
  for (const [doctor, token] of [
    [doctors().encounter, doctorToken],
    [doctors().secondEncounter, secondToken],
  ] as const) {
    await api("doctors/me/queue/finish", { method: "POST", token });
    const list = await api(`doctors/${doctor}/queue`, { token: admin });
    const { data } = (await list.json()) as {
      data: { id: number; status: string }[];
    };
    for (const entry of data.filter(({ status }) => status === "waiting")) {
      await api(`queue/${entry.id}/leave`, { method: "POST", token: admin });
    }
  }
});

type Patient = { id: number; full_name: string };

async function newPatient(): Promise<Patient> {
  const response = await api("patients", {
    method: "POST",
    token: admin,
    body: {
      full_name: `Synthetic Live Record ${stamp()}`,
      date_of_birth: "1990-04-12",
      sex: "female",
      phone: "01000000765",
    },
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: Patient }).data;
}

async function walkIn(patient: number, doctor: number): Promise<number> {
  const response = await api("queue/walk-ins", {
    method: "POST",
    token: admin,
    body: { patient_id: patient, doctor_id: doctor },
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { id: number } }).data.id;
}

async function callNext(token: string): Promise<number> {
  const response = await api("doctors/me/queue/call-next", {
    method: "POST",
    token,
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: { id: number } }).data.id;
}

/** A patient with this doctor now. */
async function withDoctor(doctor = doctors().encounter, token = doctorToken) {
  const patient = await newPatient();
  await walkIn(patient.id, doctor);
  return { patient, visit: await callNext(token) };
}

const EMPTY = {
  chief_complaint: null,
  examination_findings: null,
  diagnosis: null,
  treatment_plan: null,
  prescriptions: [],
};
const COMPLETE = {
  ...EMPTY,
  chief_complaint: "Synthetic complaint",
  diagnosis: "Synthetic diagnosis",
};

async function start(visit: number, token = doctorToken): Promise<number> {
  const response = await api(`doctors/me/visits/${visit}/encounter`, {
    method: "POST",
    token,
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { id: number } }).data.id;
}

async function save(id: number, body: unknown, token = doctorToken) {
  const response = await api(`doctors/me/encounters/${id}`, {
    method: "PUT",
    token,
    body,
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: Record<string, unknown> }).data;
}

async function finalize(id: number, token = doctorToken) {
  const response = await api(`doctors/me/encounters/${id}/finalize`, {
    method: "POST",
    token,
  });
  expect(response.status).toBe(200);
}

/** A finalized record of this patient, by the given doctor. */
async function finalizedRecord(token: string, visit: number) {
  const id = await start(visit, token);
  await save(id, COMPLETE, token);
  await finalize(id, token);
  return id;
}

type AuditEntry = { action: string; outcome: string };

async function audit(patient: number): Promise<AuditEntry[]> {
  const response = await api(
    `audit-entries?patient_id=${patient}&per_page=100`,
    {
      token: admin,
    },
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: AuditEntry[] }).data;
}

async function count(
  patient: number,
  action: string,
  outcome = "succeeded",
): Promise<number> {
  return (await audit(patient)).filter(
    (entry) => entry.action === action && entry.outcome === outcome,
  ).length;
}

const opened = (patient: number) => count(patient, "encounter.opened");
const viewed = (patient: number) => count(patient, "encounter.history_viewed");

const signIn = (page: Page, which = accounts().encounterDoctor) =>
  signInLive(page, which);
const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).locator("visible=true");
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).locator("visible=true");
const link = (page: Page, name: string) =>
  page.getByRole("link", { name, exact: true }).locator("visible=true").first();
const dialog = (page: Page) => page.getByRole("alertdialog");
const inDialog = (page: Page, name: string) =>
  dialog(page).getByRole("button", { name, exact: true }).click();
const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).locator("visible=true").first();
const recordAddress = (id: number) => `/en/my/encounters/${id}`;

test.describe("what the API does, directly", () => {
  test("lists hold no clinical content, and write no entry", async () => {
    const { patient, visit } = await withDoctor();
    const id = await start(visit);
    await save(id, COMPLETE);
    const before = (await audit(patient.id)).length;

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
    }).format(new Date());
    const list = await api(`doctors/me/visits?from=${today}&to=${today}`, {
      token: doctorToken,
    });
    expect(list.status).toBe(200);
    const body = await list.text();
    expect(body).not.toContain("Synthetic diagnosis");
    const { data } = JSON.parse(body) as {
      data: { id: number; encounter_id: number; record_status: string }[];
    };
    const row = data.find((visitRow) => visitRow.id === visit);
    expect(row).toMatchObject({ encounter_id: id, record_status: "draft" });

    expect((await audit(patient.id)).length).toBe(before);
  });

  test("an identical save writes no entry, and a changed one writes one", async () => {
    const { patient, visit } = await withDoctor();
    const id = await start(visit);

    await save(id, { ...EMPTY, diagnosis: "Synthetic" });
    expect(await count(patient.id, "encounter.draft_saved")).toBe(1);

    await save(id, { ...EMPTY, diagnosis: "Synthetic" });
    expect(await count(patient.id, "encounter.draft_saved")).toBe(1);

    await save(id, { ...EMPTY, diagnosis: "Synthetic, changed" });
    expect(await count(patient.id, "encounter.draft_saved")).toBe(2);
  });

  test("keeps the largest content allowed, Arabic, and line breaks", async () => {
    const { visit } = await withDoctor();
    const id = await start(visit);
    const line = "ن".repeat(500);
    const saved = await save(id, {
      chief_complaint: "س".repeat(10_000),
      examination_findings: "First line\n\nسطر ثالث",
      diagnosis: "x".repeat(10_000),
      treatment_plan: "ت".repeat(10_000),
      prescriptions: Array.from({ length: 20 }, () => ({
        medication: line,
        dosage: line,
        frequency: line,
        duration: line,
        instructions: line,
      })),
    });

    expect(saved.chief_complaint).toBe("س".repeat(10_000));
    expect(saved.examination_findings).toBe("First line\n\nسطر ثالث");
    expect(saved.prescriptions).toHaveLength(20);
  });

  test("trims spaces at the ends, and turns empty text into nothing", async () => {
    const { visit } = await withDoctor();
    const id = await start(visit);
    const saved = await save(id, {
      ...EMPTY,
      diagnosis: "  Synthetic  ",
      treatment_plan: "   ",
    });

    expect(saved.diagnosis).toBe("Synthetic");
    expect(saved.treatment_plan).toBeNull();
  });
});

test.describe("what can't be changed", () => {
  test("finalizing names what's missing, and a finalized record refuses a save", async () => {
    const { visit } = await withDoctor();
    const id = await start(visit);
    await save(id, {
      ...EMPTY,
      prescriptions: [{ medication: "Synthetic" }],
    });

    const incomplete = await api(`doctors/me/encounters/${id}/finalize`, {
      method: "POST",
      token: doctorToken,
    });
    expect(incomplete.status).toBe(422);
    const { errors } = (await incomplete.json()) as {
      errors: Record<string, string[]>;
    };
    expect(Object.keys(errors).sort()).toEqual([
      "chief_complaint",
      "diagnosis",
      "prescriptions.0.dosage",
      "prescriptions.0.duration",
      "prescriptions.0.frequency",
    ]);

    await save(id, COMPLETE);
    await finalize(id);

    const late = await api(`doctors/me/encounters/${id}`, {
      method: "PUT",
      token: doctorToken,
      body: EMPTY,
    });
    expect(late.status).toBe(422);
    const refusal = (await late.json()) as { errors: Record<string, string[]> };
    expect(Object.keys(refusal.errors)).toEqual(["encounter"]);
  });

  test("a save missing a key is refused, so it can't erase anything", async () => {
    const { visit } = await withDoctor();
    const id = await start(visit);
    const response = await api(`doctors/me/encounters/${id}`, {
      method: "PUT",
      token: doctorToken,
      body: { chief_complaint: "Synthetic" },
    });
    expect(response.status).toBe(422);
  });

  test("a draft refuses an addendum", async () => {
    const { visit } = await withDoctor();
    const id = await start(visit);
    const response = await api(`doctors/me/encounters/${id}/addenda`, {
      method: "POST",
      token: doctorToken,
      body: { text: "Synthetic" },
    });
    expect(response.status).toBe(422);
  });
});

test.describe("who may do what", () => {
  test("other roles get 403 on all seven operations", async () => {
    const { patient, visit } = await withDoctor();
    const id = await finalizedRecord(doctorToken, visit);
    const reception = await apiSignIn(
      accounts().receptionist.email,
      accounts().receptionist.password,
    );

    for (const token of [admin, reception]) {
      for (const [path, method, body] of [
        ["doctors/me/visits?from=2026-01-01&to=2026-01-02", "GET"],
        [`doctors/me/visits/${visit}/encounter`, "POST"],
        [`doctors/me/encounters/${id}`, "GET"],
        [`doctors/me/encounters/${id}`, "PUT", EMPTY],
        [`doctors/me/encounters/${id}/finalize`, "POST"],
        [`doctors/me/encounters/${id}/addenda`, "POST", { text: "Synthetic" }],
        [`doctors/me/patients/${patient.id}/encounters`, "GET"],
      ] as const) {
        const response = await api(path, {
          method,
          token,
          ...(body ? { body } : {}),
        });
        expect(`${method} ${path}: ${response.status}`).toBe(
          `${method} ${path}: 403`,
        );
      }
    }
  });

  test("another doctor's draft is exactly like nothing at all", async () => {
    const { visit } = await withDoctor();
    const id = await start(visit);

    const theirs = await api(`doctors/me/encounters/${id}`, {
      token: secondToken,
    });
    const nothing = await api("doctors/me/encounters/99999999", {
      token: secondToken,
    });

    expect(theirs.status).toBe(404);
    expect(nothing.status).toBe(404);
    expect(await theirs.text()).toBe(await nothing.text());
  });

  test("another doctor's finalized record follows the patient on this list", async () => {
    const { patient, visit } = await withDoctor();
    const id = await finalizedRecord(doctorToken, visit);
    await api("doctors/me/queue/finish", {
      method: "POST",
      token: doctorToken,
    });

    const read = () =>
      api(`doctors/me/encounters/${id}`, { token: secondToken });

    expect((await read()).status).toBe(404);
    expect(await count(patient.id, "encounter.opened", "refused")).toBe(1);

    const entry = await walkIn(patient.id, doctors().secondEncounter);
    expect((await read()).status).toBe(200);

    const change = await api(`doctors/me/encounters/${id}`, {
      method: "PUT",
      token: secondToken,
      body: EMPTY,
    });
    expect(change.status).toBe(403);
    const adding = await api(`doctors/me/encounters/${id}/addenda`, {
      method: "POST",
      token: secondToken,
      body: { text: "Synthetic" },
    });
    expect(adding.status).toBe(403);

    await api(`queue/${entry}/leave`, { method: "POST", token: admin });
    expect((await read()).status).toBe(404);
  });

  test("a history with no access is 404, with a refusal only if records exist", async () => {
    const { patient, visit } = await withDoctor();
    await finalizedRecord(doctorToken, visit);

    const response = await api(`doctors/me/patients/${patient.id}/encounters`, {
      token: secondToken,
    });
    expect(response.status).toBe(404);
    expect(await count(patient.id, "encounter.history_viewed", "refused")).toBe(
      1,
    );

    const other = await newPatient();
    const none = await api(`doctors/me/patients/${other.id}/encounters`, {
      token: secondToken,
    });
    expect(none.status).toBe(404);
    expect(await count(other.id, "encounter.history_viewed", "refused")).toBe(
      0,
    );
  });
});

test.describe("each journey writes exactly what it should", () => {
  test("starting, saving, finalizing, and adding write no opening", async ({
    page,
  }) => {
    const { patient } = await withDoctor();
    await signIn(page);

    await page.goto("/en/my/queue");
    await button(page, t.actions.start).click();
    await expect(field(page, t.form.diagnosis)).toBeVisible();
    expect(await count(patient.id, "encounter.started")).toBe(1);
    expect(await opened(patient.id)).toBe(0);

    await field(page, t.form.chiefComplaint).fill("Synthetic complaint");
    await button(page, t.save.action).click();
    await expect(page.getByText(t.save.done)).toBeVisible();
    expect(await count(patient.id, "encounter.draft_saved")).toBe(1);

    // Nothing changed, so nothing is sent.
    await button(page, t.save.action).click();
    await expect(page.getByText(m.shared.form.nothingToSave)).toBeVisible();
    expect(await count(patient.id, "encounter.draft_saved")).toBe(1);

    await field(page, t.form.diagnosis).fill("Synthetic diagnosis");
    await button(page, t.finalize.action).click();
    await inDialog(page, t.finalize.confirm);
    await expect(shown(page, "Synthetic diagnosis")).toBeVisible();
    await expect(field(page, t.form.diagnosis)).toHaveCount(0);
    expect(await count(patient.id, "encounter.draft_saved")).toBe(2);
    expect(await count(patient.id, "encounter.finalized")).toBe(1);

    await field(page, t.addenda.label).fill("Synthetic correction");
    await button(page, t.addenda.add).click();
    await inDialog(page, t.addenda.confirm);
    await expect(shown(page, "Synthetic correction")).toBeVisible();
    expect(await count(patient.id, "encounter.addendum_added")).toBe(1);

    expect(await opened(patient.id)).toBe(0);
  });

  test("an opening is counted once per person's action", async ({
    page,
    context,
  }) => {
    const { patient, visit } = await withDoctor();
    const id = await finalizedRecord(doctorToken, visit);
    await signIn(page);
    await page.goto("/en/my/queue");
    expect(await opened(patient.id)).toBe(0);

    // Hovering writes nothing.
    await link(page, t.actions.open).hover();
    await page.waitForTimeout(500);
    expect(await opened(patient.id)).toBe(0);

    await link(page, t.actions.open).click();
    await expect(shown(page, "Synthetic diagnosis")).toBeVisible();
    expect(await opened(patient.id)).toBe(1);

    // Focus, reconnecting, and a refresh of something else don't.
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(500);
    expect(await opened(patient.id)).toBe(1);

    // Away and back doesn't.
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/my\/queue$/);
    await page.goForward();
    await expect(shown(page, "Synthetic diagnosis")).toBeVisible();
    await page.waitForTimeout(500);
    expect(await opened(patient.id)).toBe(1);

    // The same link again does.
    await page.goBack();
    await link(page, t.actions.open).click();
    await expect(shown(page, "Synthetic diagnosis")).toBeVisible();
    await expect.poll(() => opened(patient.id)).toBe(2);

    // A new tab reads for itself, and the first tab doesn't read again.
    await page.goBack();
    const [opening] = await Promise.all([
      context.waitForEvent("page"),
      link(page, t.actions.open).click({ modifiers: ["Control"] }),
    ]);
    await opening.waitForLoadState();
    await expect(shown(opening, "Synthetic diagnosis")).toBeVisible();
    await expect.poll(() => opened(patient.id)).toBe(3);
    await opening.close();

    // Reloading does.
    await page.goto(recordAddress(id));
    await expect(shown(page, "Synthetic diagnosis")).toBeVisible();
    await expect.poll(() => opened(patient.id)).toBe(4);
    await page.reload();
    await expect(shown(page, "Synthetic diagnosis")).toBeVisible();
    await expect.poll(() => opened(patient.id)).toBe(5);

    // Asking to read again does, and says so.
    await button(page, t.view.reload).click();
    await expect.poll(() => opened(patient.id)).toBe(6);

    // Switching language does.
    await page.getByRole("link", { name: "العربية" }).click();
    await expect(page).toHaveURL(new RegExp(`/ar/my/encounters/${id}$`));
    await expect.poll(() => opened(patient.id)).toBe(7);
  });

  test("polling My queue over four real intervals reads no record", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const { patient, visit } = await withDoctor();
    await finalizedRecord(doctorToken, visit);
    await signIn(page);
    await page.goto("/en/my/queue");
    await expect(link(page, t.actions.open)).toBeVisible();
    const before = (await audit(patient.id)).length;

    await page.waitForTimeout(62_000);

    await expect(link(page, t.actions.open)).toBeVisible();
    expect((await audit(patient.id)).length).toBe(before);
  });

  test("a history counts each page read, from a person's action", async ({
    page,
  }) => {
    const { patient, visit } = await withDoctor();
    await finalizedRecord(doctorToken, visit);
    await signIn(page);
    await page.goto("/en/my/queue");
    await expect(link(page, t.actions.history)).toBeVisible();
    expect(await viewed(patient.id)).toBe(0);

    await link(page, t.actions.history).click();
    await expect(shown(page, patient.full_name)).toBeVisible();
    await expect.poll(() => viewed(patient.id)).toBe(1);
    await expect(page.getByText("Synthetic diagnosis")).toHaveCount(0);

    await page.reload();
    await expect(link(page, t.history.open)).toBeVisible();
    await expect.poll(() => viewed(patient.id)).toBe(2);
    // After a reload, only the number is known.
    await expect(page.getByText(patient.full_name)).toHaveCount(0);

    await link(page, t.history.open).click();
    await expect(shown(page, "Synthetic diagnosis")).toBeVisible();
    await expect.poll(() => opened(patient.id)).toBe(1);
  });

  test("the panel reads when asked, and leaves what's typed alone", async ({
    page,
  }) => {
    // This doctor's earlier, finalized record, then a new visit for the same patient, with a draft.
    const { patient, visit } = await withDoctor();
    await finalizedRecord(doctorToken, visit);
    await api("doctors/me/queue/finish", {
      method: "POST",
      token: doctorToken,
    });
    await walkIn(patient.id, doctors().encounter);
    const secondVisit = await callNext(doctorToken);
    const draft = await start(secondVisit);

    await signIn(page);
    await page.goto(recordAddress(draft));
    await expect(field(page, t.form.diagnosis)).toBeVisible();
    await expect.poll(() => opened(patient.id)).toBe(1);
    expect(await viewed(patient.id)).toBe(0);
    await field(page, t.form.diagnosis).fill("Synthetic, being written");

    await button(page, t.panel.open).click();
    const panel = page.getByRole("region", { name: t.panel.heading });
    await expect(
      panel.getByRole("button", { name: t.history.open }),
    ).toBeVisible();
    await expect.poll(() => viewed(patient.id)).toBe(1);

    await panel.getByRole("button", { name: t.history.open }).click();
    await expect(page.getByText("Synthetic diagnosis")).toBeVisible();
    await expect.poll(() => opened(patient.id)).toBe(2);

    await page.getByRole("button", { name: t.panel.back }).click();
    await page.getByRole("button", { name: t.panel.close }).click();
    await expect(page.getByText("Synthetic diagnosis")).toHaveCount(0);
    await expect(field(page, t.form.diagnosis)).toHaveValue(
      "Synthetic, being written",
    );
    expect(await viewed(patient.id)).toBe(1);
    expect(await opened(patient.id)).toBe(2);

    await button(page, t.panel.open).click();
    await expect.poll(() => viewed(patient.id)).toBe(2);
  });

  test("access ending writes a true refusal, and shows the neutral state", async ({
    page,
  }) => {
    const { patient, visit } = await withDoctor();
    const id = await finalizedRecord(doctorToken, visit);
    await api("doctors/me/queue/finish", {
      method: "POST",
      token: doctorToken,
    });
    const entry = await walkIn(patient.id, doctors().secondEncounter);

    await signIn(page, accounts().secondEncounterDoctor);
    await page.goto(recordAddress(id));
    await expect(shown(page, "Synthetic diagnosis")).toBeVisible();
    await expect(page.getByLabel(t.addenda.label)).toHaveCount(0);

    await api(`queue/${entry}/leave`, { method: "POST", token: admin });
    await page.reload();
    await expect(shown(page, m.shared.states.notFoundHeading)).toBeVisible();
    await expect(page.getByText("Synthetic diagnosis")).toHaveCount(0);
    await expect
      .poll(() => count(patient.id, "encounter.opened", "refused"))
      .toBe(1);
  });

  test("showing a row where no history is offered writes no refusal", async ({
    page,
  }) => {
    // Another doctor's record exists, so a refused read would write an entry, and this doctor's page must not cause one.
    const { patient, visit } = await withDoctor();
    await finalizedRecord(doctorToken, visit);
    await api("doctors/me/queue/finish", {
      method: "POST",
      token: doctorToken,
    });

    await signIn(page, accounts().secondEncounterDoctor);
    await page.goto("/en/my/visits");
    await expect(
      page.getByRole("heading", { name: t.visits.title }),
    ).toBeVisible();
    await page.waitForTimeout(500);

    expect(await count(patient.id, "encounter.history_viewed", "refused")).toBe(
      0,
    );
  });
});

test.describe("two tabs", () => {
  test("the last save wins, and finalizing says when it locked another tab's", async ({
    page,
  }) => {
    const { visit } = await withDoctor();
    const id = await start(visit);
    await save(id, { ...COMPLETE });

    await signIn(page);
    await page.goto(recordAddress(id));
    await expect(field(page, t.form.diagnosis)).toHaveValue(
      "Synthetic diagnosis",
    );

    // Another tab saves after this one read.
    await save(id, { ...COMPLETE, diagnosis: "Synthetic, from another tab" });

    await button(page, t.finalize.action).click();
    await inDialog(page, t.finalize.confirm);

    await expect(page.getByText(t.finalize.differs)).toBeVisible();
    await expect(shown(page, "Synthetic, from another tab")).toBeVisible();
  });
});

test.describe("privacy", () => {
  test("planted text is nowhere that outlives the screen", async ({ page }) => {
    const marker = `SYNTHETICMARKER${stamp()}`;
    const markers = {
      complaint: `${marker}COMPLAINT`,
      findings: `${marker}FINDINGS`,
      diagnosis: `${marker}DIAGNOSIS`,
      plan: `${marker}PLAN`,
      medication: `${marker}MEDICATION`,
      dosage: `${marker}DOSAGE`,
      frequency: `${marker}FREQUENCY`,
      duration: `${marker}DURATION`,
      instructions: `${marker}INSTRUCTIONS`,
      addendum: `${marker}ADDENDUM`,
    };
    const { patient } = await withDoctor();

    const addresses: string[] = [];
    const titles: string[] = [];
    const noteTitle = async () => {
      titles.push(await page.title());
    };
    page.on("framenavigated", (frame) => addresses.push(frame.url()));
    const clinicalAnswers: { url: string; cache: string | undefined }[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/api/backend/doctors/me/encounters")) {
        clinicalAnswers.push({
          url: response.url(),
          cache: response.headers()["cache-control"],
        });
      }
      if (response.url().includes("/encounters?")) {
        clinicalAnswers.push({
          url: response.url(),
          cache: response.headers()["cache-control"],
        });
      }
    });

    await signIn(page);
    await page.goto("/en/my/queue");
    await button(page, t.actions.start).click();
    await expect(field(page, t.form.diagnosis)).toBeVisible();
    await noteTitle();

    await field(page, t.form.chiefComplaint).fill(markers.complaint);
    await field(page, t.form.examinationFindings).fill(markers.findings);
    await field(page, t.form.diagnosis).fill(markers.diagnosis);
    await field(page, t.form.treatmentPlan).fill(markers.plan);
    await button(page, t.form.lines.add).click();
    await field(page, t.form.lines.medication).fill(markers.medication);
    await field(page, t.form.lines.dosage).fill(markers.dosage);
    await field(page, t.form.lines.frequency).fill(markers.frequency);
    await field(page, t.form.lines.duration).fill(markers.duration);
    await field(page, t.form.lines.instructions).fill(markers.instructions);
    await button(page, t.save.action).click();
    await expect(page.getByText(t.save.done)).toBeVisible();
    await noteTitle();

    await button(page, t.finalize.action).click();
    await inDialog(page, t.finalize.confirm);
    await expect(shown(page, markers.diagnosis)).toBeVisible();
    await noteTitle();

    await field(page, t.addenda.label).fill(markers.addendum);
    await button(page, t.addenda.add).click();
    await inDialog(page, t.addenda.confirm);
    await expect(shown(page, markers.addendum)).toBeVisible();
    await noteTitle();

    // A read, for its answer's headers and to prove the marker comes from the API here.
    const recordUrl = page.url();
    await page.reload();
    await expect(shown(page, markers.diagnosis)).toBeVisible();
    await noteTitle();

    await link(page, t.actions.history).click();
    await expect(link(page, t.history.open)).toBeVisible();
    await noteTitle();

    // The HTML the server sends for clinical pages, as a person's browser would ask for it.
    for (const address of [recordUrl, page.url()]) {
      const html = await (await page.request.get(address)).text();
      expect(html).not.toContain(marker);
      expect(html).not.toContain(patient.full_name);
    }

    // Answers holding clinical content are never kept (FR-035).
    expect(clinicalAnswers.length).toBeGreaterThan(3);
    for (const answer of clinicalAnswers) {
      expect(`${answer.url}: ${answer.cache}`).toBe(`${answer.url}: no-store`);
    }

    const stored = await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      const cached = await Promise.all(
        (await caches.keys()).map(async (name) =>
          (await (await caches.open(name)).keys()).map(({ url }) => url),
        ),
      );
      return JSON.stringify([
        { ...localStorage },
        { ...sessionStorage },
        databases,
        cached,
        document.cookie,
      ]);
    });
    expect(stored).not.toContain(marker);

    await page
      .getByRole("button", { name: m.auth.signOut.label })
      .locator("visible=true")
      .click();
    await expect(page).toHaveURL(/\/en\/sign-in/);

    for (const address of addresses) {
      expect(decodeURIComponent(address)).not.toContain(marker);
    }
    for (const title of titles) {
      expect(title).not.toContain(marker);
      expect(title).not.toContain(patient.full_name);
    }

    // Going back after signing out shows nothing.
    await page.goBack();
    await page.waitForLoadState("networkidle");
    expect((await page.locator("body").textContent()) ?? "").not.toContain(
      marker,
    );
    expect((await page.locator("body").textContent()) ?? "").not.toContain(
      patient.full_name,
    );

    // The audit trail holds only which fields changed.
    const trail = await api(
      `audit-entries?patient_id=${patient.id}&per_page=100`,
      { token: admin },
    );
    expect(await trail.text()).not.toContain(marker);

    // The application server's own output.
    const log = readFileSync(".next/e2e-live-app-server.log", "utf8");
    expect(log.length).toBeGreaterThan(0);
    expect(log).not.toContain(marker);
    expect(log).not.toContain(patient.full_name);
  });
});
