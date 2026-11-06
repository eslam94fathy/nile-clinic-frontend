import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "../support/messages";
import { adminToken, api, apiSignIn, signInLive } from "./support";

// The phase's done condition, against the real API. All data is synthetic, and nothing can be deleted, so
// accounts end up deactivated and names carry a stamp.
const admin = () => ({
  email: process.env.LIVE_ADMIN_EMAIL ?? "",
  password: process.env.LIVE_ADMIN_PASSWORD ?? "",
});

const stamp = () => `${Date.now()}${randomBytes(2).toString("hex")}`;
const synthPassword = () => `Synthetic-${randomBytes(12).toString("hex")}`;

async function createSpecialtyThroughApi(token: string) {
  const id = stamp();
  const response = await api("specialties", {
    method: "POST",
    token,
    body: {
      name_en: `Synthetic Journey ${id}`,
      name_ar: `رحلة تجريبية ${id}`,
    },
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { name_en: string } }).data;
}

async function deactivateAccount(email: string) {
  const token = await adminToken();
  const response = await api("staff?role=doctor&per_page=100", { token });
  const { data } = (await response.json()) as {
    data: { id: number; email: string }[];
  };
  const found = data.find((row) => row.email === email);
  if (found) {
    await api(`staff/${found.id}/deactivate`, { method: "POST", token });
  }
}

async function newStaff(role: "receptionist" | "administrator" | "doctor") {
  const token = await adminToken();
  const email = `synthetic.session.${stamp()}@example.test`;
  const password = synthPassword();
  const response = await api("staff", {
    method: "POST",
    token,
    body: {
      name: `Synthetic Session ${stamp()}`,
      email,
      role,
      password,
      password_confirmation: password,
    },
  });
  expect(response.status).toBe(201);
  const { data } = (await response.json()) as { data: { id: number } };
  return { id: data.id, email, password };
}

/** A doctor with no schedule, so that earlier runs' data can't affect a test. */
async function newDoctor() {
  const token = await adminToken();
  const account = await newStaff("doctor");
  const specialties = (await (
    await api("specialties?is_active=1", { token })
  ).json()) as { data: { id: number }[] };
  const response = await api("doctors", {
    method: "POST",
    token,
    body: {
      user_id: account.id,
      title: "Synthetic Consultant",
      specialty_ids: [specialties.data[0]?.id],
    },
  });
  expect(response.status).toBe(201);
  const { data } = (await response.json()) as { data: { id: number } };
  return { doctorId: data.id, accountId: account.id };
}

async function deactivateById(id: number) {
  await api(`staff/${id}/deactivate`, {
    method: "POST",
    token: await adminToken(),
  });
}

/** The whole journey, through the screens only. */
async function takeDoctorFromAccountToBookable(
  page: Page,
  locale: "ar" | "en",
  specialtyName: string,
) {
  const m = messages[locale];
  const email = `synthetic.journey.${stamp()}@example.test`;
  const password = synthPassword();

  // Account, with the doctor role, and straight on to its profile.
  await page.goto(`/${locale}/staff/new?role=doctor`);
  await expect(
    page.getByRole("button", { name: m.staff.create }),
  ).toBeEnabled();
  await page
    .getByLabel(new RegExp(`^${m.staff.name}`))
    .fill(`Synthetic Journey ${locale}`);
  await page.getByLabel(new RegExp(`^${m.staff.email}`)).fill(email);
  await page.getByLabel(new RegExp(`^${m.staff.password}`)).fill(password);
  await page
    .getByLabel(new RegExp(`^${m.staff.passwordConfirmation}`))
    .fill(password);
  await page.getByRole("button", { name: m.staff.create }).click();
  await expect(page).toHaveURL(
    new RegExp(`/${locale}/doctors/new\\?account=\\d+$`),
  );

  // Profile.
  await expect(
    page.getByRole("button", { name: m.doctors.create, exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel(new RegExp(`^${m.doctors.fieldTitle}`))
    .fill("Synthetic Consultant");
  await page.getByRole("checkbox", { name: specialtyName }).check();
  await page
    .getByRole("button", { name: m.doctors.create, exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/doctors/\\d+$`));
  await expect(page.getByText(m.doctors.notBookable)).toBeVisible();
  const doctorUrl = page.url();

  // Hours, on every day so that slots exist whatever today is, ending one period at 24:00.
  await page.getByRole("link", { name: m.doctors.fixHours }).first().click();
  await expect(
    page.getByRole("button", { name: m.scheduling.save }),
  ).toBeEnabled();
  await page
    .getByLabel(new RegExp(`^${m.scheduling.appointmentMinutes}`))
    .fill("30");
  for (const day of Object.values(m.days)) {
    await page
      .getByRole("button", {
        name: m.scheduling.addPeriodOn.replace("{day}", day),
      })
      .click();
    await page
      .getByLabel(
        new RegExp(
          `^${m.scheduling.startOf.replace("{number}", "1").replace("{day}", day)}`,
        ),
      )
      .fill("20:00");
    await page
      .getByLabel(
        new RegExp(
          `^${m.scheduling.endOf.replace("{number}", "1").replace("{day}", day)}`,
        ),
      )
      .fill("24:00");
  }
  await page.getByRole("button", { name: m.scheduling.save }).click();
  await expect(page).toHaveURL(doctorUrl);

  // Slots from the API: bookable, with the warning, but not complete.
  await expect(
    page.getByText(m.doctors.bookable, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(m.doctors.chargeWarning)).toBeVisible();
  await expect(
    page.getByText(m.doctors.setupComplete, { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText("20:00");

  // Fee.
  await expect(
    page.getByRole("button", { name: m.fees.set, exact: true }),
  ).toBeEnabled();
  await page.getByLabel(new RegExp(`^${m.fees.amountLabel}`)).fill("350.10");
  await page.getByRole("button", { name: m.fees.set, exact: true }).click();

  await expect(page.getByText(m.doctors.setupComplete)).toBeVisible();
  await expect(page.getByText(m.doctors.chargeWarning)).toHaveCount(0);
  await expect(page.locator('[id^="doctor-fee-"]')).toContainText("350.10");

  return { email, password, doctorUrl };
}

for (const locale of ["en", "ar"] as const) {
  test(`an administrator takes a doctor from account to setup complete, in ${locale}`, async ({
    browser,
    page,
  }) => {
    const token = await adminToken();
    const specialty = await createSpecialtyThroughApi(token);
    const specialtyName =
      locale === "ar"
        ? `رحلة تجريبية ${specialty.name_en.split(" ").at(-1)}`
        : specialty.name_en;
    await signInLive(page, admin(), locale);

    const started = Date.now();
    const { email, password } = await takeDoctorFromAccountToBookable(
      page,
      locale,
      specialtyName,
    );
    console.log(`Journey in ${locale}: ${Date.now() - started} ms`);

    // That doctor signs in, with no "profile not set up" state, and sees their own hours.
    const doctor = await (await browser.newContext()).newPage();
    await signInLive(doctor, { email, password }, locale);
    const m = messages[locale];
    await expect(doctor.getByText(m.auth.noProfile.heading)).toHaveCount(0);
    await doctor.goto(`/${locale}/my/schedule`);
    await expect(doctor.getByRole("main")).toContainText("24:00");
    await expect(doctor.getByRole("main")).not.toContainText("350.10");
    await doctor.context().close();

    await deactivateAccount(email);
  });
}

test.describe("what the API says about refused changes", () => {
  const m = messages.en;

  test("a schedule refusal lands on the right period, and time off changes the slots", async ({
    page,
  }) => {
    const { doctorId, accountId } = await newDoctor();
    await signInLive(page, admin());

    await page.goto(`/en/doctors/${doctorId}/schedule`);
    await expect(
      page.getByRole("button", { name: m.scheduling.save }),
    ).toBeEnabled();
    await page
      .getByLabel(new RegExp(`^${m.scheduling.appointmentMinutes}`))
      .fill("60");
    await page.getByRole("button", { name: "Add a period on Tuesday" }).click();
    await page.getByLabel(/^Start of period 1 on Tuesday/).fill("09:00");
    await page.getByLabel(/^End of period 1 on Tuesday/).fill("09:30");
    await page.getByRole("button", { name: m.scheduling.save }).click();

    const row = page.locator("[data-period-row]").filter({
      has: page.getByLabel(/^Start of period 1 on Tuesday/),
    });
    await expect(row.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/schedule$/);

    // A valid week, then whole-day time off across the slots' whole window.
    await page.getByLabel(/^End of period 1 on Tuesday/).fill("12:00");
    for (const day of [
      "Sunday",
      "Monday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]) {
      await page
        .getByRole("button", { name: `Add a period on ${day}` })
        .click();
      await page
        .getByLabel(new RegExp(`^Start of period 1 on ${day}`))
        .fill("20:00");
      await page
        .getByLabel(new RegExp(`^End of period 1 on ${day}`))
        .fill("24:00");
    }
    await page.getByRole("button", { name: m.scheduling.save }).click();
    await expect(page).toHaveURL(new RegExp(`/en/doctors/${doctorId}$`));
    await expect(
      page.getByText(m.doctors.bookable, { exact: true }),
    ).toBeVisible();

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
    }).format(new Date());
    const end = new Date(Date.parse(`${today}T00:00:00Z`) + 40 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await expect(
      page.getByRole("button", { name: m.scheduling.add }),
    ).toBeEnabled();
    await page.getByLabel(new RegExp(`^${m.scheduling.startDate}`)).fill(today);
    await page.getByLabel(new RegExp(`^${m.scheduling.endDate}`)).fill(end);
    await page.getByRole("button", { name: m.scheduling.add }).click();

    await expect(page.getByText(m.scheduling.slotsEmptyTitle)).toBeVisible();
    await expect(page.getByText(m.doctors.notBookable)).toBeVisible();

    await page.getByRole("button", { name: m.scheduling.remove }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: m.scheduling.remove })
      .click();
    await expect(
      page.getByText(m.doctors.bookable, { exact: true }),
    ).toBeVisible();

    await deactivateById(accountId);
  });

  test("a receptionist reads a doctor's page, and the API refuses a forced change", async ({
    page,
  }) => {
    const receptionist = await newStaff("receptionist");
    await signInLive(page, receptionist);
    const token = await apiSignIn(receptionist.email, receptionist.password);
    const doctors = (await (
      await api("doctors?per_page=1", { token })
    ).json()) as { data: { id: number }[] };
    const id = doctors.data[0]?.id;

    await page.goto(`/en/doctors/${id}`);
    await expect(
      page.getByRole("heading", { name: m.doctors.profileHeading }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: m.doctors.readinessHeading }),
    ).toHaveCount(0);
    await expect(
      page.getByLabel(new RegExp(`^${m.fees.amountLabel}`)),
    ).toHaveCount(0);

    const status = await page.evaluate(async (doctorId) => {
      const response = await fetch(`/api/backend/doctors/${doctorId}/fee`, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: "1.00" }),
      });
      return response.status;
    }, id);
    expect(status).toBe(403);
  });
});

test.describe("what an administrator's account changes do", () => {
  const t = messages.en.staff;

  test("deactivating ends the session, and reactivating restores sign-in only", async ({
    browser,
    page,
  }) => {
    const person = await newStaff("receptionist");
    const theirs = await (await browser.newContext()).newPage();
    await signInLive(theirs, person);
    await signInLive(page, admin());

    await page.goto(`/en/staff/${person.id}`);
    await page.getByRole("button", { name: t.deactivate }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.deactivate })
      .click();
    await expect(
      page.getByRole("button", { name: t.reactivate }),
    ).toBeVisible();

    await theirs.goto("/en/dashboard");
    await expect(theirs).toHaveURL(/\/en\/sign-in\?ended=1/);

    await page.getByRole("button", { name: t.reactivate }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.reactivate })
      .click();
    await expect(
      page.getByRole("button", { name: t.deactivate }),
    ).toBeVisible();

    await signInLive(theirs, person);
    await theirs.context().close();

    await api(`staff/${person.id}/deactivate`, {
      method: "POST",
      token: await adminToken(),
    });
  });

  test("setting a password ends the session, and the new one works", async ({
    browser,
    page,
  }) => {
    const person = await newStaff("receptionist");
    const theirs = await (await browser.newContext()).newPage();
    await signInLive(theirs, person);
    await signInLive(page, admin());
    const next = synthPassword();

    await page.goto(`/en/staff/${person.id}`);
    await expect(
      page.getByRole("button", { name: t.setPassword }),
    ).toBeEnabled();
    await page.getByLabel(new RegExp(`^${t.password}`)).fill(next);
    await page.getByLabel(new RegExp(`^${t.passwordConfirmation}`)).fill(next);
    await page.getByRole("button", { name: t.setPassword }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.setPassword })
      .click();
    await expect(page.getByText(t.passwordSet)).toBeVisible();

    await theirs.goto("/en/dashboard");
    await expect(theirs).toHaveURL(/\/en\/sign-in\?ended=1/);
    await signInLive(theirs, { email: person.email, password: next });
    await theirs.context().close();

    await api(`staff/${person.id}/deactivate`, {
      method: "POST",
      token: await adminToken(),
    });
  });

  test("an administrator can deactivate themselves, and is signed out", async ({
    page,
  }) => {
    const self = await newStaff("administrator");
    await signInLive(page, self);

    await page.goto(`/en/staff/${self.id}`);
    await expect(page.getByText(t.ownPassword)).toBeVisible();
    await page.getByRole("button", { name: t.deactivate }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(t.selfDeactivateDescription);
    await dialog.getByRole("button", { name: t.deactivate }).click();

    await expect(page).toHaveURL(/\/en\/sign-in\?ended=1/);
  });

  test("an administrator can demote themselves, and loses the page", async ({
    page,
  }) => {
    const self = await newStaff("administrator");
    await signInLive(page, self);

    await page.goto(`/en/staff/${self.id}`);
    await expect(page.getByRole("button", { name: t.save })).toBeEnabled();
    await page
      .getByLabel(new RegExp(`^${t.role}`))
      .selectOption("receptionist");
    await page.getByRole("button", { name: t.save }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(t.selfDemoteDescription);
    await dialog.getByRole("button", { name: t.confirmRole }).click();

    await expect(
      page.getByText(messages.en.shared.states.forbiddenHeading),
    ).toBeVisible();

    await api(`staff/${self.id}/deactivate`, {
      method: "POST",
      token: await adminToken(),
    });
  });
});
