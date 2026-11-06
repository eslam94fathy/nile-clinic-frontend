import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { messages } from "../support/messages";
import { adminToken, api, signInLive } from "./support";

// The operations in specs/004-clinic-setup/contracts/api-usage.md that the journey doesn't reach, and the
// real API's refusals, through the screens. Each proves that the contract and the screen agree.
const m = messages.en;
const admin = () => ({
  email: process.env.LIVE_ADMIN_EMAIL ?? "",
  password: process.env.LIVE_ADMIN_PASSWORD ?? "",
});
const stamp = () => `${Date.now()}${randomBytes(2).toString("hex")}`;

async function apiCreate<T>(
  path: string,
  token: string,
  body: unknown,
): Promise<T> {
  const response = await api(path, { method: "POST", token, body });
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: T }).data;
}

async function newDoctor(token: string) {
  const password = `Synthetic-${randomBytes(12).toString("hex")}`;
  const name = `Synthetic Operations ${stamp()}`;
  const account = await apiCreate<{ id: number; email: string }>(
    "staff",
    token,
    {
      name,
      email: `synthetic.operations.${stamp()}@example.test`,
      role: "doctor",
      password,
      password_confirmation: password,
    },
  );
  const specialty = await apiCreate<{ id: number; name_en: string }>(
    "specialties",
    token,
    {
      name_en: `Synthetic Operations ${stamp()}`,
      name_ar: `عمليات تجريبية ${stamp()}`,
    },
  );
  const doctor = await apiCreate<{ id: number }>("doctors", token, {
    user_id: account.id,
    title: "Synthetic Consultant",
    registration_number: `SYN${randomBytes(6).toString("hex")}`,
    specialty_ids: [specialty.id],
  });
  return { account, specialty, doctor, name };
}

test("specialties: add, refuse a duplicate, rename, deactivate, reactivate", async ({
  page,
}) => {
  const t = m.specialties;
  const name = `Synthetic Catalog ${stamp()}`;
  await signInLive(page, admin());
  await page.goto("/en/specialties");
  await expect(
    page.getByRole("button", { name: t.add, exact: true }),
  ).toBeEnabled();

  await page.getByLabel(new RegExp(`^${t.nameEn}`)).fill(name);
  await page.getByLabel(new RegExp(`^${t.nameAr}`)).fill(`كتالوج ${stamp()}`);
  await page.getByRole("button", { name: t.add, exact: true }).click();
  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row).toBeVisible();

  // The real API's own refusal, on its field.
  await page.getByLabel(new RegExp(`^${t.nameEn}`)).fill(name);
  await page.getByLabel(new RegExp(`^${t.nameAr}`)).fill(`آخر ${stamp()}`);
  await page.getByRole("button", { name: t.add, exact: true }).click();
  await expect(page.getByLabel(new RegExp(`^${t.nameEn}`))).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.reload();

  const renamed = `${name} Renamed`;
  await row.getByRole("button", { name: t.rename }).click();
  await page.getByLabel(new RegExp(`^${t.nameEn}`)).fill(renamed);
  await page.getByRole("button", { name: t.save, exact: true }).click();
  const after = page.getByRole("row", { name: new RegExp(renamed) });
  await expect(after).toBeVisible();

  await after.getByRole("button", { name: t.deactivate }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: t.deactivate })
    .click();
  await expect(after).toContainText(m.shared.status.activity.deactivated);

  await after.getByRole("button", { name: t.reactivate }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: t.reactivate })
    .click();
  await expect(after).toContainText(m.shared.status.activity.active);
});

test("doctors: filters, edit, clearing the number, and an account refused", async ({
  page,
}) => {
  const t = m.doctors;
  const token = await adminToken();
  const { doctor, account, specialty, name } = await newDoctor(token);
  await signInLive(page, admin());

  await page.goto("/en/doctors");
  await page.getByLabel(t.name, { exact: true }).fill(name);
  await page
    .getByLabel(t.specialty, { exact: true })
    .selectOption(String(specialty.id));
  await page.getByLabel(t.status, { exact: true }).selectOption("1");
  await page.getByRole("button", { name: m.shared.filters.apply }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(2);

  await page.goto(`/en/doctors/${doctor.id}/edit`);
  await expect(page.getByRole("button", { name: t.save })).toBeEnabled();
  await page
    .getByLabel(new RegExp(`^${t.fieldTitle}`))
    .fill("Synthetic Specialist");
  await page.getByLabel(new RegExp(`^${t.registrationNumber}`)).fill("");
  await page.getByRole("button", { name: t.save }).click();
  await expect(page).toHaveURL(new RegExp(`/en/doctors/${doctor.id}$`));
  await expect(page.getByRole("main")).toContainText("Synthetic Specialist");

  // A number the API refuses, on its field.
  await page.goto(`/en/doctors/${doctor.id}/edit`);
  await expect(page.getByRole("button", { name: t.save })).toBeEnabled();
  await page
    .getByLabel(new RegExp(`^${t.registrationNumber}`))
    .fill("not valid!");
  await page.getByRole("button", { name: t.save }).click();
  await expect(
    page.getByLabel(new RegExp(`^${t.registrationNumber}`)),
  ).toHaveAttribute("aria-invalid", "true");

  // An account that already has a profile: the API decides, as there's no way to know in advance (G2).
  await page.goto(`/en/doctors/new?account=${account.id}`);
  await expect(
    page.getByRole("button", { name: t.create, exact: true }),
  ).toBeEnabled();
  await page.getByLabel(new RegExp(`^${t.fieldTitle}`)).fill("Synthetic Twice");
  await page.getByRole("checkbox", { name: specialty.name_en }).check();
  await page.getByRole("button", { name: t.create, exact: true }).click();
  await expect(page).toHaveURL(/account=/);
  await expect(page.getByRole("main").getByRole("alert").first()).toBeVisible();

  // The doctor list reflects an account that's deactivated.
  await api(`staff/${account.id}/deactivate`, { method: "POST", token });
  await page.goto(`/en/doctors/${doctor.id}`);
  await expect(page.getByText(t.inactiveNotice)).toBeVisible();
  await expect(page.getByText(t.notBookable)).toBeVisible();
});

test("schedule: saving, then clearing, with slots following", async ({
  page,
}) => {
  const s = m.scheduling;
  const token = await adminToken();
  const { doctor, account } = await newDoctor(token);
  await signInLive(page, admin());

  await page.goto(`/en/doctors/${doctor.id}/schedule`);
  await expect(page.getByRole("button", { name: s.save })).toBeEnabled();
  await expect(page.getByRole("button", { name: s.clear })).toHaveCount(0);
  await page.getByLabel(new RegExp(`^${s.appointmentMinutes}`)).fill("7");
  await page.getByRole("button", { name: s.save }).click();
  await expect(page.getByText(s.minutesRule)).toBeVisible();

  await page.getByLabel(new RegExp(`^${s.appointmentMinutes}`)).fill("30");
  for (const day of Object.values(m.days)) {
    await page.getByRole("button", { name: `Add a period on ${day}` }).click();
    await page
      .getByLabel(new RegExp(`^Start of period 1 on ${day}`))
      .fill("20:00");
    await page
      .getByLabel(new RegExp(`^End of period 1 on ${day}`))
      .fill("24:00");
  }
  await page.getByRole("button", { name: s.save }).click();
  await expect(page).toHaveURL(new RegExp(`/en/doctors/${doctor.id}$`));
  await expect(
    page.getByText(m.doctors.bookable, { exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: s.changeHours }).click();
  await page.getByRole("button", { name: s.clear }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: s.clear })
    .click();
  await expect(page.getByRole("button", { name: s.clear })).toHaveCount(0);

  await page.goto(`/en/doctors/${doctor.id}`);
  await expect(page.getByText(s.noHoursTitle)).toBeVisible();
  await expect(page.getByText(m.doctors.notBookable)).toBeVisible();

  await api(`staff/${account.id}/deactivate`, { method: "POST", token });
});

test("fees: the API's own refusal, an exact amount, and the list", async ({
  page,
}) => {
  const f = m.fees;
  const token = await adminToken();
  const { doctor, account, name } = await newDoctor(token);
  await signInLive(page, admin());

  await page.goto(`/en/doctors/${doctor.id}`);
  await expect(page.getByText(f.noFeeTitle)).toBeVisible();

  const refused = await api(`doctors/${doctor.id}/fee`, {
    method: "PUT",
    token,
    body: { amount: "100000.01" },
  });
  expect(refused.status).toBe(422);
  const body = (await refused.json()) as { errors: Record<string, string[]> };
  expect(Object.keys(body.errors)).toEqual(["amount"]);

  await expect(
    page.getByRole("button", { name: f.set, exact: true }),
  ).toBeEnabled();
  await page.getByLabel(new RegExp(`^${f.amountLabel}`)).fill("٣٥٠.٠٧");
  await page.getByRole("button", { name: f.set, exact: true }).click();
  const section = page.locator('[id^="doctor-fee-"]');
  await expect(section).toContainText("350.07");
  await expect(section.locator("time")).toBeVisible();

  // The list is by name across every doctor, so go through its pages to find this one.
  let found = false;
  for (let number = 1; number <= 50 && !found; number += 1) {
    await page.goto(`/en/fees?page=${number}`);
    await expect(page.getByRole("main")).toContainText(f.title);
    found =
      (await page.getByRole("row", { name: new RegExp(name) }).count()) > 0;
  }
  expect(found).toBe(true);
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText(
    "350.07",
  );

  await api(`staff/${account.id}/deactivate`, { method: "POST", token });
});

test("staff: filters, a real email refusal, and a real validation key", async ({
  page,
}) => {
  const t = m.staff;
  await signInLive(page, admin());

  await page.goto("/en/staff?role=administrator&is_active=1");
  await expect(
    page.getByRole("row", { name: new RegExp(admin().email) }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: new RegExp(m.roles.receptionist) }),
  ).toHaveCount(0);

  await page.goto("/en/staff?role=nonsense");
  await expect(
    page.getByRole("button", { name: m.shared.states.retry }),
  ).toBeVisible();

  await page.goto("/en/staff/new");
  await expect(page.getByRole("button", { name: t.create })).toBeEnabled();
  await page.getByLabel(new RegExp(`^${t.name}`)).fill("Synthetic Duplicate");
  await page.getByLabel(new RegExp(`^${t.email}`)).fill(admin().email);
  await page.getByLabel(new RegExp(`^${t.role}`)).selectOption("receptionist");
  await page
    .getByLabel(new RegExp(`^${t.password}`))
    .fill("synthetic-password-2");
  await page
    .getByLabel(new RegExp(`^${t.passwordConfirmation}`))
    .fill("synthetic-password-2");
  await page.getByRole("button", { name: t.create }).click();
  await expect(page.getByLabel(new RegExp(`^${t.email}`))).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});
