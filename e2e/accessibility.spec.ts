import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { control, resetBackend, script, signIn } from "./support/auth";
import { messages } from "./support/messages";
import { backendControlUrl } from "./support/ports";

async function seriousIssues(page: Page) {
  // A form's submit fades in once hydrated. Measured mid-fade, its contrast reads lower than it is.
  for (const submit of await page.locator('button[type="submit"]').all()) {
    await expect(submit).toHaveCSS("opacity", "1");
  }

  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.html).join(", ")}`);
}

async function setMode(mode: string) {
  await fetch(`${backendControlUrl}/mode/${mode}`);
}

test.afterEach(async () => {
  await setMode("ok");
});

for (const locale of ["ar", "en"] as const) {
  const status = messages[locale].status;

  for (const [mode, text] of [
    ["ok", status.working],
    ["unavailable", status.unavailable],
    ["destroy", status.unreachable],
  ] as const) {
    test(`sign-in page in ${locale}, ${mode}`, async ({ page }) => {
      await setMode(mode);
      await page.goto(`/${locale}/sign-in`);
      await expect(page.getByRole("status")).toContainText(text);

      expect(await seriousIssues(page)).toEqual([]);
    });
  }

  test(`checking state in ${locale}`, async ({ page }) => {
    await setMode("slow");
    await page.goto(`/${locale}/sign-in`, { waitUntil: "commit" });
    await expect(page.getByRole("status")).toContainText(status.checking);

    expect(await seriousIssues(page)).toEqual([]);
  });

  test(`not-found page in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/missing`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages[locale].notFound.heading,
    );

    expect(await seriousIssues(page)).toEqual([]);
  });
}

for (const locale of ["ar", "en"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`signed-in screens in ${locale}, ${theme}`, () => {
      test.use({ colorScheme: theme });
      test.beforeEach(resetBackend);

      const t = messages[locale];

      test("landing page", async ({ page }) => {
        await signIn(page, "receptionist", locale);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("account page, with errors showing", async ({ page }) => {
        await signIn(page, "doctor", locale);
        await page.goto(`/${locale}/account`);
        await page.getByRole("button", { name: t.auth.account.submit }).click();
        await expect(
          page.getByText(t.auth.account.currentRequired),
        ).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("not allowed", async ({ page }) => {
        await signIn(page, "doctor", locale);
        await page.goto(`/${locale}/staff`);
        await expect(
          page.getByText(t.shared.states.forbiddenHeading),
        ).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("not found, in the frame", async ({ page }) => {
        await signIn(page, "doctor", locale);
        await page.goto(`/${locale}/nowhere`);
        await expect(
          page.getByText(t.shared.states.notFoundHeading),
        ).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("placeholder", async ({ page }) => {
        await signIn(page, "administrator", locale);
        await page.goto(`/${locale}/reports`);
        await expect(page.getByText(t.shell.placeholderHeading)).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("no doctor profile", async ({ page }) => {
        await signIn(page, "newDoctor", locale);
        await expect(page.getByText(t.auth.noProfile.heading)).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      for (const [path, heading] of [
        ["staff", t.staff.title],
        ["staff/new", t.staff.createTitle],
        ["staff/2", t.staff.detailsHeading],
        ["specialties", t.specialties.title],
        ["doctors", t.doctors.title],
        ["doctors/new", t.doctors.chooseTitle],
        ["doctors/1", t.doctors.profileHeading],
        ["doctors/1/edit", t.doctors.editTitle],
        ["doctors/1/schedule", t.scheduling.editorTitle],
        ["fees", t.fees.title],
      ] as const) {
        test(`clinic setup: /${path}`, async ({ page }) => {
          await control("clinic/setup?doctor=1&schedule=1&fee=350.10");
          await signIn(page, "administrator", locale);
          await page.goto(`/${locale}/${path}`);
          await expect(page.getByRole("main")).toContainText(heading);

          expect(await seriousIssues(page)).toEqual([]);
        });
      }

      test("clinic setup: a doctor with nothing set, and time off listed", async ({
        page,
      }) => {
        await control(
          "clinic/time-off?doctor=1&start=2030-01-10&end=2030-01-12&reason=Synthetic",
        );
        await signIn(page, "administrator", locale);
        await page.goto(`/${locale}/doctors/1?from=2030-01-01&to=2030-02-01`);
        await expect(page.getByText(t.doctors.notBookable)).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("clinic setup: the charge warning", async ({ page }) => {
        await control("clinic/setup?doctor=1&schedule=1");
        await signIn(page, "administrator", locale);
        await page.goto(`/${locale}/doctors/1`);
        await expect(page.getByText(t.doctors.chargeWarning)).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("clinic setup: the editor, with errors showing", async ({
        page,
      }) => {
        await signIn(page, "administrator", locale);
        await page.goto(`/${locale}/doctors/1/schedule`);
        const save = page.getByRole("button", { name: t.scheduling.save });
        await expect(save).toBeEnabled();
        await page
          .getByRole("button", {
            name: t.scheduling.addPeriodOn.replace("{day}", t.days.sunday),
          })
          .click();
        await save.click();
        await expect(page.getByText(t.scheduling.minutesRule)).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("clinic setup: forms with errors, and a dialog", async ({
        page,
      }) => {
        await signIn(page, "administrator", locale);
        await page.goto(`/${locale}/staff/new`);
        const create = page.getByRole("button", { name: t.staff.create });
        await expect(create).toBeEnabled();
        await create.click();
        await expect(page.getByText(t.staff.nameRequired)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/doctors/new?account=4`);
        const profile = page.getByRole("button", {
          name: t.doctors.create,
          exact: true,
        });
        await expect(profile).toBeEnabled();
        await profile.click();
        await expect(
          page.getByText(t.doctors.specialtiesRequired),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/staff/2`);
        await page.getByRole("button", { name: t.staff.deactivate }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("clinic setup: my schedule", async ({ page }) => {
        await control("clinic/setup?doctor=1&schedule=1");
        await signIn(page, "doctor", locale);
        await page.goto(`/${locale}/my/schedule`);
        await expect(page.getByRole("main")).toContainText("09:00");

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("patients: searching", async ({ page }) => {
        const p = t.patients;
        await control("clinic/more-patients?count=20");
        await signIn(page, "receptionist", locale);
        await page.goto(`/${locale}/patients`);
        await expect(
          page.getByText(p.search.promptTitle, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        const search = page.getByRole("button", { name: p.search.button });
        await search.click();
        await expect(page.getByText(p.search.needTerm)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        const name = page.getByRole("textbox", {
          name: p.fields.fullName,
          exact: true,
        });
        const phone = page.getByRole("textbox", {
          name: p.fields.phone,
          exact: true,
        });
        await name.fill("Crowd");
        await search.click();
        await expect(page.getByRole("table")).toContainText("Synthetic Crowd");
        expect(await seriousIssues(page)).toEqual([]);

        await name.fill("Nobody Synthetic");
        await search.click();
        await expect(page.getByText(p.search.emptyTitle)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await name.fill("");
        await phone.fill("12");
        await search.click();
        await expect(phone).toHaveAttribute("aria-invalid", "true");
        expect(await seriousIssues(page)).toEqual([]);

        await script("patients", 500);
        await phone.fill("01000000002");
        await search.click();
        await expect(
          page.getByText(t.shared.states.errorHeading),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("patients: registering, with errors and warnings", async ({
        page,
      }) => {
        const p = t.patients;
        const form = p.registerForm;
        const field = (label: string) =>
          page.getByLabel(new RegExp(`^${label}`, "u")).locator("visible=true");
        await signIn(page, "receptionist", locale);
        await page.goto(`/${locale}/patients/new`);
        const submit = page.getByRole("button", {
          name: form.submit,
          exact: true,
        });
        await expect(submit).toBeEnabled();
        await submit.click();
        await expect(page.getByText(p.form.nameRequired)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await field(p.fields.fullName).fill("Synthetic Axe");
        await field(p.fields.dateOfBirth).fill("1990-04-12");
        await field(p.fields.sex).selectOption("female");
        await field(p.fields.phone).fill("01000000002");
        await submit.click();
        await expect(page.getByText(form.matchesTitle)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await script("GET patients", 500);
        await submit.click();
        await expect(page.getByText(form.checkFailedTitle)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("patients: a record, editing, and failures", async ({ page }) => {
        const p = t.patients;
        await signIn(page, "receptionist", locale);
        await page.goto(`/${locale}/patients/2`);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          "Synthetic Patient Beta",
        );
        expect(await seriousIssues(page)).toEqual([]);

        await script("patients/2", 500);
        await page.getByRole("button", { name: p.record.reload }).click();
        await expect(page.getByText(p.record.outOfDate)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
        await script("patients/2", 0);

        await page.getByRole("button", { name: p.record.edit }).click();
        await page
          .getByLabel(new RegExp(`^${p.fields.fullName}`, "u"))
          .locator("visible=true")
          .fill("");
        await page.getByRole("button", { name: p.form.save }).click();
        await expect(page.getByText(p.form.nameRequired)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("API failing", async ({ page }) => {
        await signIn(page, "doctor", locale);
        await script("auth/me", 500);
        await page.reload();
        await expect(page.getByText(t.auth.errors.unavailable)).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("sign-in, with a refusal and the session-ended message", async ({
        page,
      }) => {
        await page.goto(`/${locale}/sign-in?ended=1`);
        await expect(page.getByText(t.auth.signIn.sessionEnded)).toBeVisible();
        await page
          .getByRole("button", { name: t.auth.signIn.submit, exact: true })
          .click();
        await expect(page.getByText(t.auth.signIn.emailRequired)).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });
    });
  }
}
