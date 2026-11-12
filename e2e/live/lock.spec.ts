import { randomBytes } from "node:crypto";
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

// The inactivity lock against the real API (ADR 0020): unlocking is a fresh sign-in that ends the old token, and
// neither locking nor unlocking reads the record again. The clock is moved forward rather than waited for.

const m = messages.en;
const lock = m.auth.lock;
const stamp = () => `${Date.now()}${randomBytes(2).toString("hex")}`;

let admin = "";
let doctorToken = "";

test.beforeAll(async () => {
  admin = await adminToken();
  const { encounterDoctor } = liveAccounts();
  doctorToken = await apiSignIn(
    encounterDoctor.email,
    encounterDoctor.password,
  );
});

/** The doctor's list must be clear for the next spec, as "call next" takes whoever's next. */
test.afterEach(async () => {
  await api("doctors/me/queue/finish", { method: "POST", token: doctorToken });
  const list = await api(`doctors/${liveDoctors().encounter}/queue`, {
    token: admin,
  });
  const { data } = (await list.json()) as {
    data: { id: number; status: string }[];
  };
  for (const entry of data.filter(({ status }) => status === "waiting")) {
    await api(`queue/${entry.id}/leave`, { method: "POST", token: admin });
  }
});

async function draftRecord(): Promise<{ patient: number; record: number }> {
  const created = await api("patients", {
    method: "POST",
    token: admin,
    body: {
      full_name: `Synthetic Live Lock ${stamp()}`,
      date_of_birth: "1990-04-12",
      sex: "female",
      phone: "01000000766",
    },
  });
  expect(created.status).toBe(201);
  const patient = ((await created.json()) as { data: { id: number } }).data.id;

  const walkIn = await api("queue/walk-ins", {
    method: "POST",
    token: admin,
    body: { patient_id: patient, doctor_id: liveDoctors().encounter },
  });
  expect(walkIn.status).toBe(201);
  const called = await api("doctors/me/queue/call-next", {
    method: "POST",
    token: doctorToken,
  });
  expect(called.status).toBe(200);
  const visit = ((await called.json()) as { data: { id: number } }).data.id;
  const started = await api(`doctors/me/visits/${visit}/encounter`, {
    method: "POST",
    token: doctorToken,
  });
  expect(started.status).toBe(201);
  const record = ((await started.json()) as { data: { id: number } }).data.id;
  return { patient, record };
}

async function count(query: string): Promise<number> {
  const response = await api(`audit-entries?${query}&per_page=100`, {
    token: admin,
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: unknown[] }).data.length;
}

const dialog = (page: Page) => page.getByRole("dialog", { name: lock.heading });

async function unlockWith(page: Page, password: string) {
  await dialog(page).getByLabel(lock.password, { exact: false }).fill(password);
  await dialog(page).getByRole("button", { name: lock.unlock }).click();
}

test("unlocking writes one sign-in and one sign-out, and never reads the record again", async ({
  page,
}) => {
  const doctor = liveAccounts().encounterDoctor;
  const { patient, record } = await draftRecord();

  await page.clock.install();
  await signInLive(page, doctor);
  await page.goto(`/en/my/encounters/${record}`);
  await expect(
    page
      .getByLabel(m.encounters.form.diagnosis, { exact: true })
      .locator("visible=true"),
  ).toBeVisible();
  await page
    .getByLabel(m.encounters.form.diagnosis, { exact: true })
    .locator("visible=true")
    .fill("Synthetic unsaved diagnosis");

  const signIns = await count(`staff_id=${doctor.id}&action=auth.sign_in`);
  const signOuts = await count(`staff_id=${doctor.id}&action=auth.sign_out`);
  const opened = await count(`patient_id=${patient}&action=encounter.opened`);
  const saved = await count(
    `patient_id=${patient}&action=encounter.draft_saved`,
  );

  await page.clock.fastForward("05:01");
  await expect(dialog(page)).toBeVisible();
  await unlockWith(page, doctor.password);
  await expect(dialog(page)).toBeHidden();
  await expect(
    page
      .getByLabel(m.encounters.form.diagnosis, { exact: true })
      .locator("visible=true"),
  ).toHaveValue("Synthetic unsaved diagnosis");

  expect(await count(`staff_id=${doctor.id}&action=auth.sign_in`)).toBe(
    signIns + 1,
  );
  expect(await count(`staff_id=${doctor.id}&action=auth.sign_out`)).toBe(
    signOuts + 1,
  );
  expect(await count(`patient_id=${patient}&action=encounter.opened`)).toBe(
    opened,
  );
  expect(
    await count(`patient_id=${patient}&action=encounter.draft_saved`),
  ).toBe(saved);

  // A wrong password: the API's own message, and still locked.
  await page.clock.fastForward("05:01");
  await expect(dialog(page)).toBeVisible();
  await unlockWith(page, "synthetic-wrong-password");
  await expect(dialog(page).getByRole("alert")).not.toHaveText("");
  await expect(dialog(page)).toBeVisible();
});
