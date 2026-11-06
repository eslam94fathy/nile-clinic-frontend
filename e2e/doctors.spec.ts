import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  control,
  resetBackend,
  script,
  signIn,
} from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const NEW_DOCTOR_ACCOUNT = 4;

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale].doctors;
  const { shared } = messages[locale];

  test.describe(`doctors, in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "administrator", locale);
    });

    test("lists doctors, using the language's specialty name", async ({
      page,
    }) => {
      await page.goto(`/${locale}/doctors`);

      const row = page.getByRole("row", { name: /Synthetic Doctor/ });
      await expect(row).toContainText(
        locale === "ar" ? "قلب تجريبي" : "Synthetic Cardiology",
      );
      await expect(row).toContainText(shared.status.activity.active);
    });

    test("filters by name, surviving a reload and the back button", async ({
      page,
    }) => {
      await page.goto(`/${locale}/doctors`);

      await page.getByLabel(t.name, { exact: true }).fill("nobody at all");
      await page.getByRole("button", { name: shared.filters.apply }).click();
      await expect(page).toHaveURL(/name=nobody/);
      await expect(page.getByText(t.emptyFilteredTitle)).toBeVisible();

      await page.reload();
      await expect(page.getByLabel(t.name, { exact: true })).toHaveValue(
        "nobody at all",
      );
      await expect(page.getByText(t.emptyFilteredTitle)).toBeVisible();

      await page.goBack();
      await expect(
        page.getByRole("row", { name: /Synthetic Doctor/ }),
      ).toBeVisible();
    });

    test("chooses an account with the note about existing profiles", async ({
      page,
    }) => {
      await page.goto(`/${locale}/doctors`);
      await page.getByRole("link", { name: t.newDoctor }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/doctors/new$`));
      await expect(page.getByText(t.chooseNote)).toBeVisible();
      await page
        .getByRole("row", { name: /Synthetic Newdoctor/ })
        .getByRole("link", { name: t.choose })
        .click();

      await expect(page).toHaveURL(/\/doctors\/new\?account=4$/);
      await expect(page.getByRole("main")).toContainText(ACCOUNTS.newDoctor);
    });

    test("creates a profile, leading to a page saying what's missing", async ({
      page,
    }) => {
      await page.goto(`/${locale}/doctors/new?account=${NEW_DOCTOR_ACCOUNT}`);

      await page.getByLabel(new RegExp(`^${t.fieldTitle}`)).fill("Specialist");
      await page.getByRole("checkbox").first().check();
      await page.getByRole("button", { name: t.create, exact: true }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/doctors/\\d+$`));
      await expect(page.getByText(t.created)).toBeVisible();
      await expect(page.getByText(t.notBookable)).toBeVisible();
      await expect(
        page.getByRole("listitem").filter({ hasText: t.itemHours }),
      ).toContainText(t.stateIncomplete);
      await expect(
        page.getByRole("listitem").filter({ hasText: t.itemFee }),
      ).toContainText(t.stateIncomplete);
    });

    test("shows an account that already has a profile as refused", async ({
      page,
    }) => {
      await page.goto(`/${locale}/doctors/new?account=3`);

      await page.getByLabel(new RegExp(`^${t.fieldTitle}`)).fill("Specialist");
      await page.getByRole("checkbox").first().check();
      await page.getByRole("button", { name: t.create, exact: true }).click();

      await expect(
        page.getByText("That account already has a doctor profile."),
      ).toBeVisible();
      await expect(page).toHaveURL(/account=3/);
    });

    test("says a specialty is needed first", async ({ page }) => {
      await control("clinic/empty?what=active-specialties");
      await page.goto(`/${locale}/doctors/new?account=${NEW_DOCTOR_ACCOUNT}`);

      await expect(page.getByText(t.noSpecialtiesTitle)).toBeVisible();
      await page.getByRole("link", { name: t.goToSpecialties }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/specialties$`));
    });

    test("offers to create an account when there are no doctor accounts", async ({
      page,
    }) => {
      for (const email of [ACCOUNTS.doctor, ACCOUNTS.newDoctor]) {
        await control(
          `account?email=${encodeURIComponent(email)}&active=false`,
        );
      }
      await page.goto(`/${locale}/doctors/new`);

      await expect(page.getByText(t.noAccountsTitle)).toBeVisible();
      await page.getByRole("link", { name: t.newDoctorAccount }).click();
      await expect(page).toHaveURL(/\/staff\/new\?role=doctor$/);
    });

    test("edits a profile, clearing the number", async ({ page }) => {
      await page.goto(`/${locale}/doctors/1/edit`);
      const number = page.getByLabel(new RegExp(`^${t.registrationNumber}`));
      await expect(number).toHaveValue("SYN100");
      await expect(page.getByRole("button", { name: t.save })).toBeEnabled();

      await number.fill("");
      await page.getByRole("button", { name: t.save }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/doctors/1$`));
      await expect(page.getByText(t.saved)).toBeVisible();
      await expect(page.getByRole("main")).not.toContainText("SYN100");
    });

    test("explains an inactive doctor", async ({ page }) => {
      await control(
        `account?email=${encodeURIComponent(ACCOUNTS.doctor)}&active=false`,
      );
      await page.goto(`/${locale}/doctors/1`);

      await expect(page.getByText(t.inactiveNotice)).toBeVisible();
      await expect(
        page.getByRole("listitem").filter({ hasText: t.itemAccount }),
      ).toContainText(t.stateIncomplete);
    });
  });
}

test.describe("readiness", () => {
  const t = messages.en.doctors;

  test.beforeEach(async ({ page }) => {
    await signIn(page, "administrator");
  });

  test("slots but no fee: bookable, with the warning, and not complete", async ({
    page,
  }) => {
    await control("clinic/setup?doctor=1&schedule=1");
    await page.goto("/en/doctors/1");

    await expect(page.getByText(t.bookable, { exact: true })).toBeVisible();
    await expect(page.getByText(t.chargeWarning)).toBeVisible();
    await expect(page.getByText(t.setupComplete, { exact: true })).toHaveCount(
      0,
    );
  });

  test("slots and a fee: setup complete", async ({ page }) => {
    await control("clinic/setup?doctor=1&schedule=1&fee=350.10");
    await page.goto("/en/doctors/1");

    await expect(page.getByText(t.setupComplete)).toBeVisible();
    await expect(page.getByText(t.chargeWarning)).toHaveCount(0);
  });

  test("hours but no slots in the window: not bookable", async ({ page }) => {
    await control("clinic/setup?doctor=1&schedule=1&fee=350.10");
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
    }).format(new Date());
    const end = new Date(Date.parse(`${today}T00:00:00Z`) + 40 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await control(`clinic/time-off?doctor=1&start=${today}&end=${end}`);
    await page.goto("/en/doctors/1");

    await expect(page.getByText(t.notBookable)).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: t.itemHours }),
    ).toContainText(t.stateComplete);
    await expect(
      page.getByRole("listitem").filter({ hasText: t.itemSlots }),
    ).toContainText(t.stateIncomplete);
  });

  test("one section failing leaves the others, and claims only what it can", async ({
    page,
  }) => {
    await control("clinic/setup?doctor=1&schedule=1&fee=350.10");
    await script("doctors/1/fee", 500);
    await page.goto("/en/doctors/1");

    await expect(page.getByText("Scripted 500.")).toBeVisible();
    await expect(page.getByText(t.bookable, { exact: true })).toBeVisible();
    await expect(page.getByText(t.setupUnknown)).toBeVisible();
    await expect(page.getByText(t.setupComplete, { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("listitem").filter({ hasText: t.itemFee }),
    ).toContainText(t.stateUnknown);
    await expect(
      page.getByRole("heading", { name: messages.en.scheduling.hoursHeading }),
    ).toBeVisible();
  });

  test("slots failing claims neither", async ({ page }) => {
    await control("clinic/setup?doctor=1&schedule=1&fee=350.10");
    await script("doctors/1/slots", 500);
    await page.goto("/en/doctors/1");

    await expect(page.getByText(t.bookableUnknown)).toBeVisible();
    await expect(page.getByText(t.setupUnknown)).toBeVisible();
    await expect(page.getByText(t.chargeWarning)).toHaveCount(0);
  });

  test("slots appear once a schedule is saved", async ({ page }) => {
    const s = messages.en.scheduling;
    await page.goto("/en/doctors/1");
    await expect(page.getByText(s.slotsEmptyTitle)).toBeVisible();

    await page.getByRole("link", { name: s.setHours }).first().click();
    await expect(page).toHaveURL(/\/doctors\/1\/schedule$/);
    await page.getByLabel(new RegExp(`^${s.appointmentMinutes}`)).fill("30");
    await page.getByRole("button", { name: "Add a period on Sunday" }).click();
    await page.getByLabel(/^Start of period 1 on Sunday/).fill("09:00");
    await page.getByLabel(/^End of period 1 on Sunday/).fill("12:00");
    await page.getByRole("button", { name: s.save }).click();

    await expect(page).toHaveURL(/\/doctors\/1$/);
    await expect(page.getByText(s.saved)).toBeVisible();
    await expect(page.getByText(s.slotsEmptyTitle)).toHaveCount(0);
    await expect(page.getByText(/slots? in the coming 31 days/)).toBeVisible();
  });
});

test("the fee link reaches this doctor's fee, with another's page still mounted", async ({
  page,
}) => {
  const t = messages.en.doctors;
  await signIn(page, "administrator");
  await control("clinic/setup?doctor=1&schedule=1&fee=350.10");
  await page.goto("/en/doctors/1");
  await expect(page.getByText(t.setupComplete)).toBeVisible();
  await page.goto("/en/doctors/new?account=4");
  await expect(
    page.getByRole("button", { name: t.create, exact: true }),
  ).toBeEnabled();
  await page.getByLabel(new RegExp(`^${t.fieldTitle}`)).fill("Specialist");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: t.create, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/doctors\/\d+$/);

  await page.getByRole("link", { name: t.fixFee }).click();

  await expect(page).toHaveURL(/#doctor-fee-\d+$/);
  const id = /#(.+)$/.exec(page.url())?.[1] ?? "";
  await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
  await expect(page.locator(`[id="${id}"]`)).toBeInViewport();
});

test("a doctor's page gives not-found for an unknown or malformed id", async ({
  page,
}) => {
  await signIn(page, "administrator");

  for (const id of ["999", "abc"]) {
    await page.goto(`/en/doctors/${id}`);
    await expect(
      page.getByText(messages.en.shared.states.notFoundHeading),
    ).toBeVisible();
  }
});

test("the setup journey can be finished by keyboard alone", async ({
  page,
}) => {
  const t = messages.en.doctors;
  const s = messages.en.scheduling;
  const f = messages.en.fees;
  await signIn(page, "administrator");
  await page.goto(`/en/doctors/new?account=${NEW_DOCTOR_ACCOUNT}`);

  await expect(
    page.getByRole("button", { name: t.create, exact: true }),
  ).toBeEnabled();
  await page.getByLabel(new RegExp(`^${t.fieldTitle}`)).focus();
  await page.keyboard.type("Specialist");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("checkbox").first()).toBeFocused();
  await page.keyboard.press("Space");
  await page.getByLabel(new RegExp(`^${t.fieldTitle}`)).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/doctors\/\d+$/);

  await page.getByRole("link", { name: t.fixHours }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole("button", { name: s.save })).toBeEnabled();
  await page.getByLabel(new RegExp(`^${s.appointmentMinutes}`)).focus();
  await page.keyboard.type("30");
  await page.getByRole("button", { name: "Add a period on Sunday" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel(/^Start of period 1 on Sunday/)).toBeFocused();
  await page.keyboard.type("09:00");
  await page.keyboard.press("Tab");
  await page.keyboard.type("12:00");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/doctors\/\d+$/);

  await page.getByLabel(new RegExp(`^${f.amountLabel}`)).focus();
  await page.keyboard.type("350");
  await page.keyboard.press("Enter");
  await expect(page.getByText(t.setupComplete)).toBeVisible();
});
