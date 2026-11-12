import { randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { messages } from "../support/messages";

// Steps through the screens that more than one live spec takes. All data is synthetic.

const stamp = () => `${Date.now()}${randomBytes(2).toString("hex")}`;
const synthPassword = () => `Synthetic-${randomBytes(12).toString("hex")}`;

/** The whole journey, through the screens only. */
export async function takeDoctorFromAccountToBookable(
  page: Page,
  locale: "ar" | "en",
  specialtyName: string,
  { name, from }: { name: string; from: string },
) {
  const m = messages[locale];
  const email = `synthetic.journey.${stamp()}@example.test`;
  const password = synthPassword();

  // Account, with the doctor role, and straight on to its profile.
  await page.goto(`/${locale}/staff/new?role=doctor`);
  await expect(
    page.getByRole("button", { name: m.staff.create }),
  ).toBeEnabled();
  await page.getByLabel(new RegExp(`^${m.staff.name}`)).fill(name);
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

  // Hours, on every day so that slots exist whatever today is, from `from` to 24:00.
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
      .fill(from);
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
  await expect(page.getByRole("main")).toContainText(from);

  // Fee.
  await expect(
    page.getByRole("button", { name: m.fees.set, exact: true }),
  ).toBeEnabled();
  await page.getByLabel(new RegExp(`^${m.fees.amountLabel}`)).fill("350.10");
  await page.getByRole("button", { name: m.fees.set, exact: true }).click();

  await expect(page.getByText(m.doctors.setupComplete)).toBeVisible();
  await expect(page.getByText(m.doctors.chargeWarning)).toHaveCount(0);
  await expect(page.locator('[id^="doctor-fee-"]')).toContainText("350.10");

  const doctorId = Number(/\/doctors\/(\d+)$/.exec(doctorUrl)?.[1]);
  return { email, password, doctorUrl, doctorId };
}
