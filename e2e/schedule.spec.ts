import { expect, type Page, test } from "@playwright/test";
import { control, resetBackend, signIn } from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const t = messages.en.scheduling;

async function openEditor(page: Page, locale: "ar" | "en" = "en") {
  await page.goto(`/${locale}/doctors/1/schedule`);
  await expect(
    page.getByRole("button", { name: messages[locale].scheduling.save }),
  ).toBeEnabled();
}

for (const locale of ["ar", "en"] as const) {
  const m = messages[locale].scheduling;
  const days = messages[locale].days;

  test.describe(`the schedule editor, in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "administrator", locale);
    });

    test("shows every day, and says existing appointments stay", async ({
      page,
    }) => {
      await openEditor(page, locale);

      await expect(page.getByRole("heading", { level: 3 })).toHaveText(
        Object.values(days),
      );
      await expect(page.getByText(m.appointmentsNote)).toBeVisible();
      await expect(page.getByRole("button", { name: m.clear })).toHaveCount(0);
    });

    test("saves a week, ending a period at 24:00", async ({ page }) => {
      await openEditor(page, locale);

      await page.getByLabel(new RegExp(`^${m.appointmentMinutes}`)).fill("30");
      await page
        .getByRole("button", {
          name: m.addPeriodOn.replace("{day}", days.monday),
        })
        .click();
      await page
        .getByLabel(
          new RegExp(
            `^${m.startOf.replace("{number}", "1").replace("{day}", days.monday)}`,
          ),
        )
        .fill("18:00");
      await page
        .getByLabel(
          new RegExp(
            `^${m.endOf.replace("{number}", "1").replace("{day}", days.monday)}`,
          ),
        )
        .fill("24:00");
      await page.getByRole("button", { name: m.save }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/doctors/1$`));
      await expect(page.getByText(m.saved)).toBeVisible();
      await expect(page.getByRole("main")).toContainText("24:00");
    });
  });
}

test.describe("refusals and clearing", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "administrator");
  });

  test("a period shorter than an appointment is refused against that period", async ({
    page,
  }) => {
    await openEditor(page);
    await page.getByLabel(new RegExp(`^${t.appointmentMinutes}`)).fill("60");
    await page.getByRole("button", { name: "Add a period on Monday" }).click();
    await page.getByLabel(/^Start of period 1 on Monday/).fill("09:00");
    await page.getByLabel(/^End of period 1 on Monday/).fill("10:00");
    await page.getByRole("button", { name: "Add a period on Sunday" }).click();
    await page.getByLabel(/^Start of period 1 on Sunday/).fill("09:00");
    await page.getByLabel(/^End of period 1 on Sunday/).fill("09:30");
    await page.getByRole("button", { name: t.save }).click();

    const message = page.getByText(
      "The period is shorter than one appointment.",
    );
    await expect(message).toBeVisible();
    // Added second, but Sunday comes first on screen, and it's Sunday's period that's too short.
    await expect(
      page
        .locator("[data-period-row]")
        .filter({ has: message })
        .getByLabel(/^Start of period 1 on Sunday/),
    ).toHaveValue("09:00");
    await expect(page.getByLabel(/^Start of period 1 on Monday/)).toHaveValue(
      "09:00",
    );
    await expect(page).toHaveURL(/\/schedule$/);
  });

  test("overlapping periods are refused, and nothing is saved", async ({
    page,
  }) => {
    await openEditor(page);
    await page.getByLabel(new RegExp(`^${t.appointmentMinutes}`)).fill("20");
    await page.getByRole("button", { name: "Add a period on Monday" }).click();
    await page.getByLabel(/^Start of period 1 on Monday/).fill("09:00");
    await page.getByLabel(/^End of period 1 on Monday/).fill("12:00");
    await page.getByRole("button", { name: "Add a period on Monday" }).click();
    await page.getByLabel(/^Start of period 2 on Monday/).fill("11:00");
    await page.getByLabel(/^End of period 2 on Monday/).fill("13:00");
    await page.getByRole("button", { name: t.save }).click();

    await expect(page.getByText("The periods overlap.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel(/^Start of period 1 on Monday/)).toHaveCount(
      0,
    );
  });

  test("clears a schedule after explaining the effect", async ({ page }) => {
    await control("clinic/setup?doctor=1&schedule=1");
    await openEditor(page);

    await page.getByRole("button", { name: t.clear }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(t.clearDescription);
    await dialog.getByRole("button", { name: t.clear }).click();

    await expect(page.getByText(t.cleared)).toBeVisible();
    await expect(page.getByLabel(/^Start of period 1 on Sunday/)).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: t.clear })).toHaveCount(0);
  });
});

test("a receptionist gets not allowed, with no editor sent", async ({
  page,
}) => {
  await signIn(page, "receptionist");

  const response = await page.request.get("/en/doctors/1/schedule");
  const body = await response.text();

  expect(body).toContain(messages.en.shared.states.forbiddenHeading);
  expect(body).not.toContain(t.appointmentMinutes);
});
