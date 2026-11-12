import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { control, resetBackend, script, signIn } from "./support/auth";
import { messages } from "./support/messages";
import { backendControlUrl } from "./support/ports";

// WCAG 2.2 AA (SC-006): any violation of these rules fails, whatever axe calls its impact.
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Serious or critical issues of any rule, and every WCAG A or AA violation (Phase 13). */
async function seriousIssues(page: Page) {
  // A form's submit fades in once hydrated. Measured mid-fade, its contrast reads lower than it is.
  for (const submit of await page.locator('button[type="submit"]').all()) {
    await expect(submit).toHaveCSS("opacity", "1");
  }

  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter(
      ({ impact, tags }) =>
        impact === "serious" ||
        impact === "critical" ||
        tags.some((tag) => WCAG_AA.includes(tag)),
    )
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

      test("dashboards: the desk's, with one panel failed and one refused, at desk and narrow widths", async ({
        page,
      }) => {
        const d = t.dashboard;
        await control("clinic/appointment?days=0&patient=2&start=10:00");
        await control("clinic/queue-entry?patient=3&status=waiting");
        await control("clinic/appointment?days=3&outside=1&patient=2");
        await script("visits", 500);
        await script("queue", 403);
        await signIn(page, "receptionist", locale);
        await expect(
          page.getByRole("region", { name: d.appointments.heading }),
        ).toContainText("10:00");
        await expect(
          page.getByRole("region", { name: d.owed.heading }).getByRole("alert"),
        ).toBeVisible();
        await expect(
          page
            .getByRole("region", { name: d.queue.heading })
            .getByText(t.shared.states.forbiddenHeading),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.setViewportSize({ width: 390, height: 844 });
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("dashboards: the doctor's, with someone waiting and nobody with them", async ({
        page,
      }) => {
        const d = t.dashboard;
        await control("clinic/queue-entry?patient=3&status=waiting");
        await signIn(page, "doctor", locale);
        await expect(
          page.getByRole("region", { name: d.waiting.heading }),
        ).toContainText("Synthetic Child Gamma");
        await expect(
          page.getByRole("region", { name: d.now.heading }),
        ).toContainText(d.now.empty);
        await expect(
          page.getByRole("region", { name: d.records.heading }),
        ).toContainText(d.records.empty);
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("dashboards: the administrator's", async ({ page }) => {
        const d = t.dashboard;
        await signIn(page, "administrator", locale);
        await expect(
          page.getByRole("region", { name: d.money.heading }),
        ).toContainText(d.money.empty);
        await expect(
          page.getByRole("region", { name: d.activity.heading }),
        ).toContainText(d.activity.empty);
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

      test("audit log", async ({ page }) => {
        await signIn(page, "administrator", locale);
        await page.goto(`/${locale}/audit`);
        await expect(
          page.getByText(t.audit.states.beforeSearchTitle),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        // Results: refusals, changes with kept values, and a search's filters among them.
        await page
          .getByRole("button", { name: t.audit.filters.search, exact: true })
          .click();
        await expect(page.locator("article").first()).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page
          .getByLabel(t.audit.filters.patient, { exact: true })
          .fill("999");
        await page
          .getByRole("button", { name: t.audit.filters.search, exact: true })
          .click();
        await expect(page.getByText(t.audit.states.emptyTitle)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await script("audit-entries", 500);
        await page
          .getByRole("button", { name: t.audit.filters.search, exact: true })
          .click();
        await expect(
          page.getByText(t.shared.states.errorHeading),
        ).toBeVisible();
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

      test("appointments: the list, with states and refusals", async ({
        page,
      }) => {
        const a = t.appointments;
        await control("clinic/appointment?days=0&start=09:00&outside=1");
        await control("clinic/appointment?days=0&start=10:00&status=cancelled");
        await signIn(page, "receptionist", locale);

        await page.goto(`/${locale}/appointments`);
        await expect(page.getByRole("row")).toHaveCount(3);
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/appointments?status=no_show`);
        await expect(
          page.getByText(a.empty.filteredTitle, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(
          `/${locale}/appointments?from=2026-01-01&to=2026-12-31`,
        );
        await expect(
          page.getByText("The date range can be at most 92 days."),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/appointments?patient_id=2`);
        await expect(page.getByText(a.patientFilter.heading)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/appointments`);
        await page
          .getByRole("button", { name: t.patients.filter.open })
          .click();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("appointments: booking, at each step and refused", async ({
        page,
      }) => {
        const a = t.appointments;
        await control("clinic/setup?schedule=1");
        await signIn(page, "receptionist", locale);
        await page.goto(`/${locale}/appointments/new?patient_id=9999`);
        await expect(page.getByText(a.booking.patientMissing)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/appointments/new?patient_id=2`);
        const choose = page
          .getByRole("button", { name: t.doctors.chooser.choose })
          .locator("visible=true")
          .first();
        await expect(choose).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await choose.click();
        const radio = page.getByRole("radio").first();
        await expect(radio).toBeAttached();
        expect(await seriousIssues(page)).toEqual([]);

        await page
          .locator("label", { has: page.getByRole("radio") })
          .first()
          .click();
        await expect(radio).toBeChecked();
        const name = (await radio.getAttribute("aria-label")) ?? "";
        // The words around them differ by language.
        const [, date = "", start = ""] =
          /(\d{4}-\d{2}-\d{2})\D+(\d{2}:\d{2})/u.exec(name) ?? [];
        await control(`clinic/take-time?date=${date}&start=${start}`);
        await page
          .getByRole("button", { name: a.booking.submit, exact: true })
          .click();
        await expect(
          page.getByText("This slot is already booked."),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("appointments: a page, moving, and both dialogs", async ({
        page,
      }) => {
        const a = t.appointments;
        await control("clinic/setup?schedule=1");
        const upcoming = (await control(
          "clinic/appointment?days=2&start=09:00&outside=1&note=First%20visit",
        )) as { id: number };
        const passed = (await control(
          "clinic/appointment?days=-1&start=09:00&patient=3",
        )) as { id: number };
        await signIn(page, "receptionist", locale);

        await page.goto(`/${locale}/appointments/${upcoming.id}`);
        await expect(page.getByText(a.outsideNotice.title)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.getByRole("button", { name: a.actions.reschedule }).click();
        await expect(page.getByRole("radio").first()).toBeAttached();
        expect(await seriousIssues(page)).toEqual([]);

        await page.getByRole("button", { name: a.reschedule.keep }).click();
        await page.getByRole("button", { name: a.actions.cancel }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page
          .getByRole("alertdialog")
          .getByLabel(a.cancel.reasonLabel)
          .fill("x".repeat(256));
        await page
          .getByRole("alertdialog")
          .getByRole("button", { name: a.cancel.confirm })
          .click();
        await expect(page.getByText(a.cancel.reasonTooLong)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/appointments/${passed.id}`);
        await page.getByRole("button", { name: a.actions.noShow }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("appointments: a doctor's own pages", async ({ page }) => {
        const a = t.appointments;
        const { id } = (await control(
          "clinic/appointment?days=0&start=09:00&outside=1&note=First%20visit",
        )) as { id: number };
        await signIn(page, "doctor", locale);

        await page.goto(`/${locale}/my/appointments`);
        await expect(page.getByRole("row")).toHaveCount(2);
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/my/appointments/${id}`);
        await expect(page.getByText(a.own.outsideDescription)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/my/appointments?status=no_show`);
        await expect(
          page.getByText(a.own.emptyFilteredTitle, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("queue: reception's list, with its states and a dialog", async ({
        page,
      }) => {
        const q = t.queue;
        await control("clinic/queue-entry?patient=2&start=09:00");
        await control("clinic/queue-entry?patient=3&status=seen");
        await signIn(page, "receptionist", locale);

        await page.goto(`/${locale}/queue?status=left`);
        await expect(
          page.getByText(q.empty.filteredTitle, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/queue`);
        await expect(page.getByRole("table").first()).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await script("queue", 500);
        await page
          .getByRole("button", { name: t.shared.lastRead.refresh, exact: true })
          .click();
        await expect(
          page.getByText(t.shared.lastRead.outOfDate, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
        await script("queue", 0);

        await page
          .getByRole("button", { name: q.undo.action, exact: true })
          .locator("visible=true")
          .click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("billing: today's visits, another date, and a refusal", async ({
        page,
      }) => {
        const bl = t.billing;
        await control("clinic/queue-entry?patient=2");
        await signIn(page, "receptionist", locale);
        await page.goto(`/${locale}/billing`);
        await expect(page.getByRole("table").first()).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page
          .getByRole("button", { name: bl.charge.action, exact: true })
          .locator("visible=true")
          .click();
        await expect(page.getByRole("alert").first()).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/billing?date=2026-01-01`);
        await expect(
          page.getByText(bl.empty.dateTitle, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("charges: the list, a range that can't be read, and the patient filter", async ({
        page,
      }) => {
        const ch = t.charges;
        await control("clinic/charge?payments=100");
        await signIn(page, "receptionist", locale);
        await page.goto(`/${locale}/charges`);
        await expect(page.getByRole("table").first()).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/charges?from=2026-01-01&to=2026-12-31`);
        await expect(
          page.getByText(ch.range.tooLong, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/charges?patient_id=2`);
        await expect(
          page.getByText(ch.patientFilterHeading, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("charges: one charge, with every form and dialog", async ({
        page,
      }) => {
        const ch = t.charges;
        const { id } = (await control(
          "clinic/charge?payments=100&refunds=20&discount=30",
        )) as { id: number };
        const empty = (await control("clinic/charge")) as { id: number };
        await signIn(page, "administrator", locale);
        await page.goto(`/${locale}/charges/${id}`);
        await expect(
          page.getByRole("heading", { name: ch.payment.heading }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page
          .getByRole("button", { name: ch.payment.submit, exact: true })
          .click();
        await expect(
          page.getByText(ch.payment.methodRule, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        // Within its own form, as the refund form has a "Method" group too.
        await page
          .getByRole("region", { name: ch.payment.heading, exact: true })
          .getByRole("group")
          .getByText(t.shared.paymentMethod.cash, { exact: true })
          .click();
        await page
          .getByRole("button", { name: ch.payment.submit, exact: true })
          .click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
        await page
          .getByRole("alertdialog")
          .getByRole("button", { name: t.shared.confirm.cancel })
          .click();

        await script(`charges/${id}/payments`, -2);
        await page
          .getByRole("button", { name: ch.payment.submit, exact: true })
          .click();
        await page
          .getByRole("alertdialog")
          .getByRole("button", { name: ch.payment.confirm, exact: true })
          .click();
        await expect(
          page.getByText(ch.outcomeUnknown, { exact: true }),
        ).toBeVisible();
        // The payment went through before its answer was lost, so the page is read again. Measured once that read has
        // settled, as it replaces the forms' buttons.
        await expect(
          page
            .getByRole("table", { name: ch.details.paymentsCaption })
            .getByRole("row"),
        ).toHaveCount(3);
        expect(await seriousIssues(page)).toEqual([]);
        await script(`charges/${id}/payments`, 0);

        await page.goto(`/${locale}/charges/${empty.id}`);
        await page
          .getByRole("button", { name: ch.cancel.action, exact: true })
          .click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        const cancelled = (await control("clinic/charge?cancelled=1")) as {
          id: number;
        };
        await page.goto(`/${locale}/charges/${cancelled.id}`);
        await expect(page.getByRole("note")).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("reports: each report, empty, refused, and an unknown doctor", async ({
        page,
      }) => {
        const rp = t.reports;
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Africa/Cairo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        const first = `${today.slice(0, 8)}01`;
        const money = (net: string) => ({
          received: "350.00",
          refunded: "0.00",
          net,
        });
        const body = {
          totals: money("-50.00"),
          by_method: [
            {
              method: "cash",
              ...money("-50.00"),
              staff: [
                { id: 2, name: "Synthetic Reception", ...money("-50.00") },
              ],
            },
          ],
          by_day: [
            { date: first, ...money("350.00") },
            { date: today, ...money("-400.00") },
          ],
        };
        await control(
          `clinic/report?name=money-collected&body=${encodeURIComponent(JSON.stringify(body))}`,
        );
        await signIn(page, "administrator", locale);

        await page.goto(`/${locale}/reports`);
        await expect(
          page.getByRole("img", { name: /Net money by day|صافي الأموال/ }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        for (const report of ["billing", "activity", "times"]) {
          await page.goto(`/${locale}/reports/${report}`);
          await expect(
            page.getByRole("heading", { name: rp.allDoctors }),
          ).toBeVisible();
          expect(await seriousIssues(page)).toEqual([]);
        }

        await page.goto(
          `/${locale}/reports/times?from=2025-01-01&to=2026-12-31`,
        );
        await expect(
          page.getByText(rp.range.tooLong, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/reports?doctor_id=999`);
        await expect(
          page.getByText(rp.doctorNotFound, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await script("reports/billing", 503);
        await page.goto(`/${locale}/reports/billing`);
        await expect(page.getByRole("alert").first()).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
        await script("reports/billing", 0);
      });

      test("queue: adding a walk-in", async ({ page }) => {
        const q = t.queue;
        await signIn(page, "receptionist", locale);
        await page.goto(`/${locale}/queue/walk-in`);
        await expect(
          page.getByText(q.walkInForm.choosePatientFirst, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.goto(`/${locale}/queue/walk-in?patient_id=2`);
        const choose = page
          .getByRole("button", { name: t.doctors.chooser.choose })
          .locator("visible=true")
          .first();
        await choose.click();
        await expect(
          page.getByText(q.walkInForm.permanent, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("queue: a doctor's list, with a current patient and a dialog", async ({
        page,
      }) => {
        const q = t.queue;
        await signIn(page, "doctor", locale);
        await page.goto(`/${locale}/my/queue`);
        await expect(
          page.getByText(q.own.emptyTitle, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await control("clinic/queue-entry?patient=2&status=with_doctor");
        await control("clinic/queue-entry?patient=3&start=09:00");
        await page.reload();
        await expect(
          page.getByRole("region", { name: q.own.currentHeading }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page
          .getByRole("button", { name: q.own.finish.action, exact: true })
          .click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("medical records: my visits, in each state", async ({ page }) => {
        const e = t.encounters;
        await signIn(page, "doctor", locale);
        await page.goto(`/${locale}/my/visits`);
        await expect(
          page.getByText(e.visits.emptyTitle, { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await control("clinic/queue-entry?patient=2&status=seen");
        await control("clinic/encounter?patient=3");
        await control(
          `clinic/encounter?patient=1&status=finalized&content=${encodeURIComponent(
            JSON.stringify({ diagnosis: "Synthetic" }),
          )}`,
        );
        await page.reload();
        await expect(
          page
            .getByRole("button", { name: e.actions.start, exact: true })
            .locator("visible=true"),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("medical records: a draft, with errors, a dialog, and the panel", async ({
        page,
      }) => {
        const e = t.encounters;
        const { id } = (await control(
          "clinic/queue-entry?patient=2&status=with_doctor",
        )) as { id: number };
        const record = (await control(
          `clinic/encounter?patient=2&visit=${id}`,
        )) as { id: number };
        await control(
          `clinic/encounter?patient=2&status=finalized&date=2026-01-15&content=${encodeURIComponent(
            JSON.stringify({ diagnosis: "Synthetic" }),
          )}`,
        );
        await signIn(page, "doctor", locale);
        await page.goto(`/${locale}/my/encounters/${record.id}`);
        const button = (name: string) =>
          page.getByRole("button", { name, exact: true });
        await expect(button(e.save.action)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await button(e.form.lines.add).click();
        await page.getByLabel(e.form.lines.dosage).fill("Synthetic");
        await button(e.save.action).click();
        await expect(page.locator('[aria-invalid="true"]')).not.toHaveCount(0);
        expect(await seriousIssues(page)).toEqual([]);

        await button(e.finalize.action).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
        await page
          .getByRole("alertdialog")
          .getByRole("button", { name: t.shared.confirm.cancel, exact: true })
          .click();

        await button(e.panel.open).click();
        await expect(
          page.getByRole("region", { name: e.panel.heading }),
        ).toBeVisible();
        await expect(button(e.history.open).first()).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await button(e.history.open).first().click();
        await expect(button(e.panel.back)).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.getByRole("link", { name: t.shell.nav.mySchedule }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
      });

      test("medical records: a finalized record with addenda, and a history", async ({
        page,
      }) => {
        const e = t.encounters;
        const { id } = (await control(
          `clinic/encounter?patient=2&status=finalized&content=${encodeURIComponent(
            JSON.stringify({
              chief_complaint: "Synthetic complaint",
              diagnosis: "Synthetic diagnosis",
              prescriptions: [
                {
                  medication: "Synthetic",
                  dosage: "One",
                  frequency: "Daily",
                  duration: "A week",
                  instructions: null,
                },
              ],
              addenda: [
                {
                  id: 9001,
                  text: "Synthetic addendum",
                  created_at: "2026-02-02T10:00:00.000000Z",
                },
              ],
            }),
          )}`,
        )) as { id: number };
        await signIn(page, "doctor", locale);
        await page.goto(`/${locale}/my/encounters/${id}`);
        await expect(
          page.getByText("Synthetic addendum", { exact: true }),
        ).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);

        await page.getByLabel(e.addenda.label).fill("Synthetic");
        await page
          .getByRole("button", { name: e.addenda.add, exact: true })
          .click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        expect(await seriousIssues(page)).toEqual([]);
        await page
          .getByRole("alertdialog")
          .getByRole("button", { name: t.shared.confirm.cancel, exact: true })
          .click();

        await page.goto(`/${locale}/my/patients/2/history`);
        await expect(
          page.getByRole("link", { name: e.history.open, exact: true }),
        ).toBeVisible();
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
