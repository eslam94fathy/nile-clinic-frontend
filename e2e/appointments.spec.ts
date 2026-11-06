import { expect, type Page, test } from "@playwright/test";
import {
  ACCOUNTS,
  callsTo,
  control,
  mainNavigation,
  resetBackend,
  script,
  signIn,
} from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const m = messages.en;
const t = m.appointments;

type Seeded = { id: number; date: string; start: string };

async function seed(options = ""): Promise<Seeded> {
  return (await control(`clinic/appointment?${options}`)) as Seeded;
}

const workingWeek = () => control("clinic/setup?schedule=1");

async function openings(id: number): Promise<number> {
  const answer = (await control(`clinic/patient-openings?id=${id}`)) as {
    count: number;
  };
  return answer.count;
}

const settle = (page: Page) => page.waitForTimeout(500);
/** The table keeps a copy for narrow screens, so text can be there twice, with one showing. */
const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).locator("visible=true").first();
const visible = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).locator("visible=true");

async function searchForPatient(page: Page, name: string) {
  await visible(page, m.patients.fields.fullName).fill(name);
  await page
    .getByRole("button", { name: m.patients.search.button, exact: true })
    .click();
}

async function choosePatient(page: Page, name: string) {
  await searchForPatient(page, name);
  await page
    .getByRole("button", {
      name: m.patients.chooser.chooseNamed.replace("{name}", name),
    })
    .click();
}

async function chooseDoctor(page: Page, name = "Synthetic Doctor") {
  await page
    .getByRole("button", {
      name: m.doctors.chooser.chooseNamed.replace("{name}", name),
    })
    .click();
}

const firstFreeTime = (page: Page) =>
  page.getByRole("radio").locator("visible=true").first();

/** A free time, with the date and start its name gives, for checking afterwards. */
/** The label is what a person presses, and it covers the radio. */
const pressFreeTime = (page: Page) =>
  page
    .locator("label", { has: firstFreeTime(page) })
    .first()
    .click();

async function pickFreeTime(page: Page) {
  const radio = firstFreeTime(page);
  await pressFreeTime(page);
  const name = (await radio.getAttribute("aria-label")) ?? "";
  const [date = "", start = ""] = name.replace(",", "").split(" ");
  return { date, start };
}

const bookButton = (page: Page) =>
  page.getByRole("button", { name: t.booking.submit, exact: true });

test.describe("who can reach appointment pages", () => {
  for (const locale of ["ar", "en"] as const) {
    test(`a doctor can't reach reception's, and causes no read, in ${locale}`, async ({
      page,
    }) => {
      await signIn(page, "doctor", locale);
      const { forbiddenHeading } = messages[locale].shared.states;

      for (const address of [
        "appointments",
        "appointments/new",
        "appointments/1",
      ]) {
        await page.goto(`/${locale}/${address}`);
        await expect(shown(page, forbiddenHeading)).toBeVisible();
      }
      await settle(page);
      expect(await callsTo("appointments")).toBe(0);
      expect(await callsTo("appointments/1")).toBe(0);
    });
  }

  for (const role of ["administrator", "receptionist"] as const) {
    test(`a ${role} reaches the page from the navigation, and not a doctor's`, async ({
      page,
    }) => {
      await signIn(page, role);
      await mainNavigation(page, "en")
        .getByRole("link", { name: m.shell.nav.appointments })
        .click();
      await expect(page).toHaveURL(/\/en\/appointments$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.title);
      await expect(shown(page, m.shell.placeholderHeading)).toHaveCount(0);

      for (const address of ["my/appointments", "my/appointments/1"]) {
        await page.goto(`/en/${address}`);
        await expect(
          shown(page, m.shared.states.forbiddenHeading),
        ).toBeVisible();
      }
      expect(await callsTo("doctors/me/appointments")).toBe(0);
    });
  }

  test("later phases' placeholders are unchanged", async ({ page }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await expect(shown(page, m.shell.placeholderHeading)).toBeVisible();
  });
});

test.describe("the list", () => {
  test("opens on today, for all doctors and every status", async ({ page }) => {
    await seed("days=0&start=09:00");
    await seed("days=0&start=10:00&status=cancelled&patient=3");
    await seed("days=1&start=11:00&patient=1");
    await signIn(page, "receptionist");
    await page.goto("/en/appointments");

    const rows = page.getByRole("row");
    await expect(rows).toHaveCount(3);
    await expect(shown(page, "Synthetic Patient Beta")).toBeVisible();
    await expect(shown(page, "Synthetic Child Gamma")).toBeVisible();
    await expect(shown(page, "أحمد سامي تجريبي")).toHaveCount(0);
    await expect(
      rows.nth(2).getByText(m.shared.status.appointment.cancelled),
    ).toBeVisible();
    await expect(shown(page, "01000000002").first()).toBeVisible();
  });

  test("filters survive a reload and the back button", async ({ page }) => {
    const { date } = await seed("days=3&start=09:00");
    await seed("days=3&start=10:00&status=cancelled&patient=3");
    await signIn(page, "receptionist");
    await page.goto("/en/appointments");

    await visible(page, t.fields.from).fill(date);
    await visible(page, t.fields.to).fill(date);
    await visible(page, t.fields.status).selectOption("cancelled");
    await page.getByRole("button", { name: m.shared.filters.apply }).click();

    await expect(page).toHaveURL(/status=cancelled/);
    await expect(shown(page, "Synthetic Child Gamma")).toBeVisible();
    await expect(shown(page, "Synthetic Patient Beta")).toHaveCount(0);

    await page.reload();
    await expect(shown(page, "Synthetic Child Gamma")).toBeVisible();
    await expect(visible(page, t.fields.status)).toHaveValue("cancelled");
    await expect(visible(page, t.fields.from)).toHaveValue(date);

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/appointments$/);
  });

  test("offers inactive doctors in the filter, saying so", async ({ page }) => {
    await signIn(page, "administrator");
    await page.goto("/en/appointments");
    await expect(
      visible(page, t.fields.doctor).getByRole("option", {
        name: "Synthetic Doctor",
      }),
    ).toHaveCount(1);
  });

  test("shows the API's refusal of a long range on that filter", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments?from=2026-01-01&to=2026-12-31");

    await expect(
      shown(page, "The date range can be at most 92 days."),
    ).toBeVisible();
    await expect(visible(page, t.fields.to)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(visible(page, t.fields.from)).toBeEnabled();
  });

  test("shows a refusal with no field of its own at form level", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments?patient_id=abc");

    await expect(shown(page, "The patient number is not valid.")).toBeVisible();
  });

  test("each empty state says the right thing", async ({ page }) => {
    await signIn(page, "receptionist");

    await page.goto("/en/appointments");
    await expect(shown(page, t.empty.todayTitle)).toBeVisible();

    await page.goto("/en/appointments?status=cancelled");
    await expect(shown(page, t.empty.filteredTitle)).toBeVisible();
    await expect(visible(page, t.fields.status)).toHaveValue("cancelled");

    await page.goto("/en/appointments?outside_availability=1");
    await expect(shown(page, t.empty.moveTitle)).toBeVisible();
  });

  test("a failed read offers to try again", async ({ page }) => {
    await signIn(page, "receptionist");
    await script("GET appointments", 500);
    await page.goto("/en/appointments");
    await expect(
      page.getByRole("button", { name: m.shared.states.retry }),
    ).toBeVisible();
    await script("GET appointments", 0);
  });

  test("a list held in history shows a change made elsewhere", async ({
    page,
  }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto("/en/appointments?patient_id=2");
    await expect(page.getByRole("row")).toHaveCount(2);

    await page.getByRole("link", { name: "09:00 – 09:20" }).click();
    await expect(page).toHaveURL(new RegExp(`/appointments/${id}$`));
    await page.getByRole("button", { name: t.actions.cancel }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.cancel.confirm })
      .click();
    await expect(
      page.locator("dl").getByText(m.shared.status.appointment.cancelled),
    ).toBeVisible();

    await page.goBack();
    await expect(page.getByRole("row").nth(1)).toContainText(
      m.shared.status.appointment.cancelled,
    );
  });
});

test.describe("filtering by patient", () => {
  test("uses the search, puts only the number in the address, and opens nobody", async ({
    page,
  }) => {
    await seed("days=2&start=09:00&patient=2");
    await seed("days=2&start=10:00&patient=3");
    await signIn(page, "receptionist");
    await page.goto("/en/appointments");

    await page.getByRole("button", { name: t.patientFilter.open }).click();
    await choosePatient(page, "Synthetic Patient Beta");

    await expect(page).toHaveURL(/\/en\/appointments\?patient_id=2$/);
    await expect(shown(page, t.patientFilter.heading)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "09:00 – 09:20" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "10:00 – 10:20" })).toHaveCount(
      0,
    );
    expect(await openings(2)).toBe(0);

    await page.getByRole("link", { name: t.patientFilter.clear }).click();
    await expect(page).toHaveURL(/\/en\/appointments$/);
  });

  test("says when the number isn't anyone", async ({ page }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments?patient_id=9999");
    await expect(shown(page, m.patients.chosen.notFound)).toBeVisible();
  });

  test("a patient's page links here, with no further opening", async ({
    page,
  }) => {
    await seed("days=2&start=09:00&patient=2");
    await signIn(page, "receptionist");
    await page.goto("/en/patients/2");
    await expect(
      page.getByRole("heading", { name: m.patients.record.detailsHeading }),
    ).toBeVisible();
    expect(await openings(2)).toBe(1);

    await page.getByRole("link", { name: m.patients.recordLinks.view }).click();
    await expect(page).toHaveURL(/\/en\/appointments\?patient_id=2$/);
    await expect(
      page.getByRole("link", { name: "09:00 – 09:20" }),
    ).toBeVisible();
    await settle(page);
    expect(await openings(2)).toBe(1);
  });
});

test.describe("an appointment's page", () => {
  test("shows every detail, as written", async ({ page }) => {
    const { id, date } = await seed(
      "days=2&start=09:00&end=24:00&note=First%20visit",
    );
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      t.details.title.replace("{number}", String(id)),
    );
    await expect(page.locator("dl").getByText(date)).toBeVisible();
    await expect(shown(page, "09:00 – 24:00")).toBeVisible();
    await expect(shown(page, "First visit")).toBeVisible();
    await expect(
      page.locator("dl").getByText("Synthetic Reception"),
    ).toBeVisible();
    await expect(shown(page, "01000000002")).toBeVisible();
    await expect(page).toHaveTitle(/^(?!.*Beta).*$/);
  });

  test("says what wasn't recorded, and leaves out history that didn't happen", async ({
    page,
  }) => {
    const { id } = await seed("days=2&start=09:00&no_booker=1");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);

    await expect(
      page.locator("dl").getByText(t.details.notRecorded),
    ).toHaveCount(2);
    await expect(shown(page, t.details.rescheduledAt)).toHaveCount(0);
    await expect(shown(page, t.details.statusChangedAt)).toHaveCount(0);
    await expect(shown(page, t.details.cancellationReason)).toHaveCount(0);
  });

  test("a bad number asks nothing, and an unknown one is neutral", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    for (const address of ["abc", "0", "-5", "1.5"]) {
      await page.goto(`/en/appointments/${address}`);
      await expect(shown(page, m.shared.states.notFoundHeading)).toBeVisible();
      expect(await callsTo(`appointments/${address}`)).toBe(0);
    }

    await page.goto("/en/appointments/9999");
    await expect(shown(page, m.shared.states.notFoundHeading)).toBeVisible();
  });

  test("opening the patient happens only by following the link", async ({
    page,
  }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);

    const link = page.getByRole("link", { name: "Synthetic Patient Beta" });
    await link.hover();
    await link.focus();
    await settle(page);
    expect(await openings(2)).toBe(0);

    await link.click();
    await expect(page).toHaveURL(/\/en\/patients\/2$/);
    await expect(
      page.getByRole("heading", { name: m.patients.record.detailsHeading }),
    ).toBeVisible();
    expect(await openings(2)).toBe(1);
  });
});

test.describe("booking", () => {
  test.beforeEach(workingWeek);

  test("takes a patient, a doctor, and a time, and opens nobody", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");

    await expect(shown(page, t.booking.chooseDoctorFirst)).toBeVisible();
    await expect(shown(page, t.booking.chooseTimeFirst)).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);

    await choosePatient(page, "Synthetic Patient Beta");
    await expect(shown(page, t.booking.chooseTimeFirst)).toBeVisible();
    await chooseDoctor(page);

    const { date, start } = await pickFreeTime(page);
    await visible(page, t.booking.noteLabel).fill("First visit");
    await bookButton(page).click();

    await expect(page).toHaveURL(/\/en\/appointments\/\d+$/);
    await expect(shown(page, t.booking.booked)).toBeVisible();
    await expect(page.locator("dl").getByText(date)).toBeVisible();
    await expect(shown(page, "First visit")).toBeVisible();
    expect(await openings(2)).toBe(0);
    expect(await callsTo("patients/2")).toBe(0);

    // The time has gone, and the form is empty on returning to it.
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/appointments\/new$/);
    await expect(shown(page, t.booking.chooseDoctorFirst)).toBeVisible();
    await choosePatient(page, "Synthetic Child Gamma");
    await chooseDoctor(page);
    await expect(firstFreeTime(page)).toBeVisible();
    await expect(
      page.getByRole("radio", { name: new RegExp(`^${date}, ${start} `) }),
    ).toHaveCount(0);
    await expect(visible(page, t.booking.noteLabel)).toHaveValue("");
  });

  test("carries a patient from their page, opening them no further", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/patients/2");
    await expect(
      page.getByRole("heading", { name: m.patients.record.detailsHeading }),
    ).toBeVisible();

    await page.getByRole("link", { name: m.patients.recordLinks.book }).click();
    await expect(page).toHaveURL(/\/en\/appointments\/new\?patient_id=2$/);
    await expect(shown(page, "Synthetic Patient Beta")).toBeVisible();
    await expect(
      page.getByRole("button", { name: m.patients.search.button, exact: true }),
    ).toHaveCount(0);
    await settle(page);
    expect(await openings(2)).toBe(1);
    expect(await callsTo("patients/2")).toBe(1);
  });

  test("offers links on a record just registered too", async ({ page }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/patients/new");
    const f = m.patients.fields;
    const field = (label: string) =>
      page.getByLabel(label).locator("visible=true").first();
    await field(f.fullName).fill("Synthetic Newly Registered");
    await field(f.dateOfBirth).fill("1990-04-12");
    await field(f.sex).selectOption("female");
    await field(f.phone).fill("01000000555");
    await page
      .getByRole("button", { name: m.patients.registerForm.submit })
      .click();

    await expect(
      page.getByRole("link", { name: m.patients.recordLinks.book }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: m.patients.recordLinks.view }),
    ).toBeVisible();
  });

  test("says when a carried number isn't anyone, and offers the search", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    for (const value of ["9999", "abc"]) {
      await page.goto(`/en/appointments/new?patient_id=${value}`);
      await expect(shown(page, t.booking.patientMissing)).toBeVisible();
      await expect(visible(page, m.patients.fields.fullName)).toBeVisible();
    }
    expect(await callsTo("patients/9999")).toBe(0);
  });

  test("offers to register when nobody matches", async ({ page }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await searchForPatient(page, "Nobody With This Name");
    await expect(
      page.getByRole("link", { name: m.patients.register }),
    ).toBeVisible();
  });

  test("finds doctors through the API, and offers only active ones", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await choosePatient(page, "Synthetic Patient Beta");
    await expect(
      page.getByRole("button", {
        name: m.doctors.chooser.chooseNamed.replace(
          "{name}",
          "Synthetic Doctor",
        ),
      }),
    ).toBeVisible();

    await visible(page, m.doctors.name).fill("Nobody");
    await page.getByRole("button", { name: m.doctors.chooser.find }).click();
    await expect(shown(page, m.doctors.chooser.emptyTitle)).toBeVisible();
    expect(
      ((await control("calls")) as Record<string, number>).doctors,
    ).toBeGreaterThanOrEqual(2);
  });

  test("moves between weeks, and says neutrally when nothing is free", async ({
    page,
  }) => {
    await control("clinic/more-staff?count=0");
    const { id: doctor } = (await control("clinic/second-doctor")) as {
      id: number;
    };
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await choosePatient(page, "Synthetic Patient Beta");
    await chooseDoctor(page, "Synthetic Newdoctor");
    await expect(firstFreeTime(page)).toBeVisible();

    const previous = page.getByRole("button", {
      name: m.scheduling.freeTimes.previousWeek,
    });
    const next = page.getByRole("button", {
      name: m.scheduling.freeTimes.nextWeek,
    });
    await expect(previous).toBeDisabled();
    const first = await firstFreeTime(page).getAttribute("aria-label");
    await next.click();
    await expect(previous).toBeEnabled();
    await expect(firstFreeTime(page)).not.toHaveAttribute(
      "aria-label",
      first ?? "",
    );

    // A date beyond the limit is never asked for, and no later week is offered.
    await visible(page, m.scheduling.freeTimes.from).fill("2099-01-01");
    await expect(next).toBeDisabled();
    expect(doctor).toBeGreaterThan(0);
  });

  test("a doctor with no hours gets the neutral state", async ({ page }) => {
    await resetBackend();
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await choosePatient(page, "Synthetic Patient Beta");
    await chooseDoctor(page);
    await expect(shown(page, m.scheduling.freeTimes.emptyTitle)).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
  });

  test("a failed read of free times offers to try again, keeping the rest", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await choosePatient(page, "Synthetic Patient Beta");
    await script("doctors/1/slots", 500);
    await chooseDoctor(page);
    const retry = page.getByRole("button", { name: m.shared.states.retry });
    await expect(retry).toBeVisible();
    await expect(shown(page, "Synthetic Patient Beta")).toBeVisible();

    await script("doctors/1/slots", 0);
    await retry.click();
    await expect(firstFreeTime(page)).toBeVisible();
  });

  test("needs a time, and checks the note's length", async ({ page }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await choosePatient(page, "Synthetic Patient Beta");
    await chooseDoctor(page);
    await expect(firstFreeTime(page)).toBeVisible();

    await bookButton(page).click();
    await expect(shown(page, t.booking.chooseTime)).toBeVisible();

    await pickFreeTime(page);
    await expect(shown(page, t.booking.chooseTime)).toHaveCount(0);
    await visible(page, t.booking.noteLabel).fill("x".repeat(501));
    await bookButton(page).click();
    await expect(shown(page, t.booking.noteTooLong)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/appointments\/new$/);
  });

  test("when someone takes the time first, says so and keeps everything else", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await choosePatient(page, "Synthetic Patient Beta");
    await chooseDoctor(page);
    const { date, start } = await pickFreeTime(page);
    await visible(page, t.booking.noteLabel).fill("First visit");

    await control(`clinic/take-time?date=${date}&start=${start}`);
    await bookButton(page).click();

    await expect(shown(page, "This slot is already booked.")).toBeVisible();
    await expect(
      page.getByRole("radio", { name: new RegExp(`^${date}, ${start} `) }),
    ).toHaveCount(0);
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(visible(page, t.booking.noteLabel)).toHaveValue("First visit");
    await expect(shown(page, "Synthetic Patient Beta")).toBeVisible();
    await expect(shown(page, "Synthetic Doctor")).toBeVisible();

    // And another time works, with nothing retyped.
    await pickFreeTime(page);
    await bookButton(page).click();
    await expect(page).toHaveURL(/\/en\/appointments\/\d+$/);
    await expect(shown(page, "First visit")).toBeVisible();
  });

  test("when the patient is busy, says so and links to their appointments", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await choosePatient(page, "Synthetic Patient Beta");
    await chooseDoctor(page);
    const { date, start } = await pickFreeTime(page);

    await control("clinic/second-doctor");
    await control(
      `clinic/take-time?date=${date}&start=${start}&patient=2&doctor=100`,
    );
    await bookButton(page).click();

    await expect(
      shown(page, "This patient already has an appointment at this time."),
    ).toBeVisible();
    const link = page.getByRole("link", { name: t.booking.seePatient });
    await expect(link).toHaveAttribute(
      "href",
      new RegExp(`patient_id=2&from=${date}&to=${date}$`),
    );
  });

  test("a time no longer offered is refused on the free times", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await choosePatient(page, "Synthetic Patient Beta");
    await chooseDoctor(page);
    const { date } = await pickFreeTime(page);

    await control(`clinic/time-off?start=${date}`);
    await bookButton(page).click();

    await expect(
      shown(page, "This time is not an available slot for this doctor."),
    ).toBeVisible();
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  });

  test("says when it can't tell whether a booking was saved", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await choosePatient(page, "Synthetic Patient Beta");
    await chooseDoctor(page);
    await pickFreeTime(page);

    await script("POST appointments", 503);
    await bookButton(page).click();

    await expect(shown(page, t.booking.unknownOutcome)).toBeVisible();
    await expect(
      page.getByRole("link", { name: t.booking.seeAppointments }),
    ).toHaveAttribute("href", /patient_id=2$/);
    await script("POST appointments", 0);
  });

  test("a general failure says so, and nothing was booked", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await choosePatient(page, "Synthetic Patient Beta");
    await chooseDoctor(page);
    await pickFreeTime(page);

    await script("POST appointments", 500);
    await bookButton(page).click();
    await expect(shown(page, t.booking.unknownOutcome)).toHaveCount(0);
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/appointments\/new$/);
    await script("POST appointments", 0);
  });

  test("works in Arabic, right to left", async ({ page }) => {
    const ar = messages.ar;
    await signIn(page, "receptionist", "ar");
    await page.goto("/ar/appointments/new");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await visible(page, ar.patients.fields.fullName).fill("احمد");
    await page
      .getByRole("button", { name: ar.patients.search.button, exact: true })
      .click();
    await page
      .getByRole("button", { name: ar.patients.chooser.choose })
      .first()
      .click();
    await page
      .getByRole("button", { name: ar.doctors.chooser.choose })
      .first()
      .click();
    await pressFreeTime(page);
    await page
      .getByRole("button", {
        name: ar.appointments.booking.submit,
        exact: true,
      })
      .click();

    await expect(page).toHaveURL(/\/ar\/appointments\/\d+$/);
    await expect(shown(page, "أحمد سامي تجريبي")).toBeVisible();
  });
});

test.describe("rescheduling", () => {
  test.beforeEach(workingWeek);

  test("moves to another time, with the same doctor, and frees the old one", async ({
    page,
  }) => {
    const { id, date } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);

    await page.getByRole("button", { name: t.actions.reschedule }).click();
    await expect(page.getByText(`Current time: ${date}, 09:00`)).toBeVisible();
    await expect(shown(page, t.reschedule.sameDoctor)).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: m.doctors.chooser.chooseNamed.replace(
          "{name}",
          "Synthetic Doctor",
        ),
      }),
    ).toHaveCount(0);

    const target = await pickFreeTime(page);
    await page.getByRole("button", { name: t.reschedule.submit }).click();

    await expect(shown(page, t.reschedule.moved)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/appointments/${id}$`));
    await expect(shown(page, t.details.rescheduledAt)).toBeVisible();
    await expect(page.locator("dl").getByText(target.date)).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);

    await page.getByRole("button", { name: t.actions.reschedule }).click();
    await expect(firstFreeTime(page)).toBeVisible();
  });

  test("keeping the time closes the panel and returns focus", async ({
    page,
  }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);

    const start = page.getByRole("button", { name: t.actions.reschedule });
    await start.click();
    await expect(
      page.getByRole("heading", { name: t.reschedule.heading }),
    ).toBeFocused();
    await page.getByRole("button", { name: t.reschedule.keep }).click();
    await expect(start).toBeFocused();
    await expect(page.getByRole("radio")).toHaveCount(0);
  });

  test("needs a time", async ({ page }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);
    await page.getByRole("button", { name: t.actions.reschedule }).click();
    await expect(firstFreeTime(page)).toBeVisible();
    await page.getByRole("button", { name: t.reschedule.submit }).click();
    await expect(shown(page, t.reschedule.chooseTime)).toBeVisible();
  });

  test("a time taken first is refused, and the appointment stays put", async ({
    page,
  }) => {
    const { id, date } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);
    await page.getByRole("button", { name: t.actions.reschedule }).click();
    const target = await pickFreeTime(page);

    await control(`clinic/take-time?date=${target.date}&start=${target.start}`);
    await page.getByRole("button", { name: t.reschedule.submit }).click();

    await expect(shown(page, "This slot is already booked.")).toBeVisible();
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(page.locator("dl").getByText(date)).toBeVisible();
    await expect(shown(page, t.details.rescheduledAt)).toHaveCount(0);
  });

  test("an appointment that can no longer change says so, and shows its state", async ({
    page,
  }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);
    await page.getByRole("button", { name: t.actions.reschedule }).click();
    await pickFreeTime(page);

    await control(`clinic/change-appointment?id=${id}&status=cancelled`);
    await page.getByRole("button", { name: t.reschedule.submit }).click();

    await expect(
      shown(page, "This appointment can no longer be changed."),
    ).toBeVisible();
    await expect(
      page.locator("dl").getByText(m.shared.status.appointment.cancelled),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: t.actions.reschedule }),
    ).toHaveCount(0);
  });

  test("says when it can't tell whether a move was saved, and shows the truth", async ({
    page,
  }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);
    await page.getByRole("button", { name: t.actions.reschedule }).click();
    await pickFreeTime(page);

    await script(`POST appointments/${id}/reschedule`, 503);
    await page.getByRole("button", { name: t.reschedule.submit }).click();

    await expect(shown(page, t.actions.unknownOutcome)).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await script(`POST appointments/${id}/reschedule`, 0);
  });
});

test.describe("cancelling", () => {
  test("warns, records the reason as written, and frees the time", async ({
    page,
  }) => {
    await workingWeek();
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);

    await page.getByRole("button", { name: t.actions.cancel }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText(m.shared.confirm.irreversible)).toBeVisible();
    await expect(
      dialog.getByText(m.shared.form.noMedicalDetails),
    ).toBeVisible();
    await dialog.getByLabel(t.cancel.reasonLabel).fill("المريض مسافر");
    await dialog.getByRole("button", { name: t.cancel.confirm }).click();

    await expect(shown(page, t.cancel.done)).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.locator("dl").getByText(m.shared.status.appointment.cancelled),
    ).toBeVisible();
    await expect(shown(page, "المريض مسافر")).toBeVisible();
    await expect(shown(page, t.details.statusChangedAt)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: t.details.heading }),
    ).toBeFocused();
    await expect(
      page.getByRole("button", { name: t.actions.cancel }),
    ).toHaveCount(0);
  });

  test("dismissing changes nothing, and returns focus", async ({ page }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);

    const trigger = page.getByRole("button", { name: t.actions.cancel });
    await trigger.click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: m.shared.confirm.cancel })
      .click();
    await expect(trigger).toBeFocused();
    await expect(
      page.locator("dl").getByText(m.shared.status.appointment.scheduled),
    ).toBeVisible();
    expect(await callsTo(`appointments/${id}/cancel`)).toBe(0);
  });

  test("checks the reason's length, in the dialog", async ({ page }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);

    await page.getByRole("button", { name: t.actions.cancel }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByLabel(t.cancel.reasonLabel).fill("x".repeat(256));
    await dialog.getByRole("button", { name: t.cancel.confirm }).click();

    await expect(dialog.getByText(t.cancel.reasonTooLong)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: t.cancel.confirm }),
    ).toBeInViewport();
    expect(await callsTo(`appointments/${id}/cancel`)).toBe(0);
  });

  test("a refusal moves to the page, along with the current state", async ({
    page,
  }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);

    await page.getByRole("button", { name: t.actions.cancel }).click();
    await control(`clinic/change-appointment?id=${id}&status=no_show`);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.cancel.confirm })
      .click();

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(
      shown(page, "This appointment can no longer be changed."),
    ).toBeVisible();
    await expect(
      page.locator("dl").getByText(m.shared.status.appointment.no_show),
    ).toBeVisible();
  });

  test("says when it can't tell whether a cancellation was saved", async ({
    page,
  }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);

    await script(`POST appointments/${id}/cancel`, 503);
    await page.getByRole("button", { name: t.actions.cancel }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.cancel.confirm })
      .click();

    await expect(shown(page, t.actions.unknownOutcome)).toBeVisible();
    await script(`POST appointments/${id}/cancel`, 0);
  });
});

test.describe("a no-show", () => {
  test("is offered only once the start has passed, and warns", async ({
    page,
  }) => {
    const { id } = await seed("days=-1&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);

    await expect(
      page.getByRole("button", { name: t.actions.reschedule }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: t.actions.cancel }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: t.actions.noShow }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText(m.shared.confirm.irreversible)).toBeVisible();
    await dialog.getByRole("button", { name: t.noShow.confirm }).click();

    await expect(shown(page, t.noShow.done)).toBeVisible();
    await expect(
      page.locator("dl").getByText(m.shared.status.appointment.no_show),
    ).toBeVisible();
    await expect(shown(page, t.details.statusChangedBy)).toBeVisible();
    await expect(
      page.getByRole("button", { name: t.actions.noShow }),
    ).toHaveCount(0);
  });

  test("isn't offered before the start", async ({ page }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);
    await expect(
      page.getByRole("button", { name: t.actions.reschedule }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: t.actions.noShow }),
    ).toHaveCount(0);
  });

  test("the API's refusal shows, with the current state", async ({ page }) => {
    const { id } = await seed("days=-1&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);

    await page.getByRole("button", { name: t.actions.noShow }).click();
    await control(`clinic/change-appointment?id=${id}&status=cancelled`);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.noShow.confirm })
      .click();

    await expect(
      shown(page, "This appointment can no longer be changed."),
    ).toBeVisible();
    await expect(
      page.locator("dl").getByText(m.shared.status.appointment.cancelled),
    ).toBeVisible();
  });

  for (const status of ["checked_in", "completed", "cancelled"] as const) {
    test(`${status} offers no action`, async ({ page }) => {
      const { id } = await seed(`days=-1&start=09:00&status=${status}`);
      await signIn(page, "receptionist");
      await page.goto(`/en/appointments/${id}`);
      await expect(
        page.locator("dl").getByText(m.shared.status.appointment[status]),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: t.actions.heading }),
      ).toHaveCount(0);
    });
  }
});

test.describe("outside availability", () => {
  test("is labelled, can be found, and goes once moved", async ({ page }) => {
    await workingWeek();
    const { id } = await seed("days=2&start=09:00&outside=1");
    await seed("days=2&start=10:00&patient=3");
    await signIn(page, "receptionist");
    await page.goto("/en/appointments");

    await page.getByRole("link", { name: t.views.needingMove }).click();
    await expect(page).toHaveURL(/outside_availability=1/);
    await expect(
      page.getByRole("link", { name: t.views.needingMove }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(shown(page, t.outsideLabel)).toBeVisible();

    await page.getByRole("link", { name: "09:00 – 09:20" }).click();
    await expect(shown(page, t.outsideNotice.title)).toBeVisible();

    await page.getByRole("button", { name: t.actions.reschedule }).click();
    await pickFreeTime(page);
    await page.getByRole("button", { name: t.reschedule.submit }).click();
    await expect(shown(page, t.reschedule.moved)).toBeVisible();
    await expect(shown(page, t.outsideNotice.title)).toHaveCount(0);

    await page.goto(`/en/appointments?outside_availability=1`);
    await expect(shown(page, t.empty.moveTitle)).toBeVisible();
    expect(id).toBeGreaterThan(0);
  });

  test("the view keeps the doctor and patient, and drops the dates", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto(
      "/en/appointments?from=2026-01-01&to=2026-01-02&doctor_id=1&patient_id=2&page=3",
    );
    await page.getByRole("link", { name: t.views.needingMove }).click();
    await expect(page).toHaveURL(
      /\?doctor_id=1&patient_id=2&outside_availability=1$/,
    );
  });
});

test.describe("a doctor's own appointments", () => {
  test("shows only their own, with no phone and no actions", async ({
    page,
  }) => {
    await control("clinic/second-doctor");
    const own = await seed("days=0&start=09:00&patient=2&note=First%20visit");
    await seed("days=0&start=10:00&patient=3&doctor=100");
    await signIn(page, "doctor");

    await mainNavigation(page, "en")
      .getByRole("link", { name: m.shell.nav.myAppointments })
      .click();
    await expect(page).toHaveURL(/\/en\/my\/appointments$/);
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(shown(page, "Synthetic Patient Beta")).toBeVisible();
    await expect(shown(page, "Synthetic Child Gamma")).toHaveCount(0);
    await expect(shown(page, "01000000002")).toHaveCount(0);
    await expect(shown(page, "1985-07-30")).toBeVisible();

    await page.getByRole("link", { name: "09:00 – 09:20" }).click();
    await expect(page).toHaveURL(new RegExp(`/en/my/appointments/${own.id}$`));
    await expect(shown(page, "First visit")).toBeVisible();
    await expect(shown(page, m.patients.sex.female)).toBeVisible();
    await expect(shown(page, "01000000002")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Synthetic Patient Beta" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: t.actions.reschedule }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: t.actions.cancel }),
    ).toHaveCount(0);
  });

  test("another doctor's is a neutral not-found", async ({ page }) => {
    await control("clinic/second-doctor");
    const other = await seed("days=0&start=10:00&doctor=100");
    await signIn(page, "doctor");
    await page.goto(`/en/my/appointments/${other.id}`);
    await expect(shown(page, m.shared.states.notFoundHeading)).toBeVisible();
  });

  test("filters survive a reload, and empty states say why", async ({
    page,
  }) => {
    const { date } = await seed("days=3&start=09:00&status=cancelled");
    await signIn(page, "doctor");

    await page.goto("/en/my/appointments");
    await expect(shown(page, t.own.emptyTodayTitle)).toBeVisible();

    await page.goto(
      `/en/my/appointments?from=${date}&to=${date}&status=cancelled`,
    );
    await expect(page.getByRole("row")).toHaveCount(2);
    await page.reload();
    await expect(page.getByRole("row")).toHaveCount(2);

    await page.goto(
      `/en/my/appointments?from=${date}&to=${date}&status=no_show`,
    );
    await expect(shown(page, t.own.emptyFilteredTitle)).toBeVisible();

    await page.goto("/en/my/appointments?from=2026-01-01&to=2026-12-31");
    await expect(
      shown(page, "The date range can be at most 92 days."),
    ).toBeVisible();
  });

  test("labels one outside availability", async ({ page }) => {
    const { id } = await seed("days=0&start=09:00&outside=1");
    await signIn(page, "doctor");
    await page.goto("/en/my/appointments");
    await expect(shown(page, t.outsideLabel)).toBeVisible();
    await page.goto(`/en/my/appointments/${id}`);
    await expect(shown(page, t.outsideLabel)).toBeVisible();
  });

  test("a doctor with no profile gets that state", async ({ page }) => {
    await signIn(page, "newDoctor");
    await page.goto("/en/my/appointments");
    await expect(shown(page, m.auth.noProfile.heading)).toBeVisible();
    expect(await callsTo("doctors/me/appointments")).toBe(0);
  });
});

async function tabTo(page: Page, element: ReturnType<Page["locator"]>) {
  for (let presses = 0; presses < 120; presses += 1) {
    if (await element.evaluate((node) => node === document.activeElement)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab never reached the element.");
}

for (const locale of ["ar", "en"] as const) {
  const l = messages[locale];
  const a = l.appointments;

  test.describe(`by keyboard alone, in ${locale}`, () => {
    test.beforeEach(workingWeek);

    test("booking", async ({ page }) => {
      await signIn(page, "receptionist", locale);
      await page.goto(`/${locale}/appointments/new?patient_id=2`);
      await expect(page.getByText("Synthetic Patient Beta")).toBeVisible();

      const choose = page
        .getByRole("button", { name: l.doctors.chooser.choose })
        .locator("visible=true")
        .first();
      await expect(choose).toBeVisible();
      await tabTo(page, choose);
      await page.keyboard.press("Enter");

      const time = firstFreeTime(page);
      await expect(time).toBeAttached();
      await tabTo(page, time);
      await page.keyboard.press("Space");
      await expect(time).toBeChecked();

      await tabTo(page, bookLocator(page, a.booking.submit));
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/${locale}/appointments/\\d+$`));
    });

    test("rescheduling", async ({ page }) => {
      const { id } = await seed("days=2&start=09:00");
      await signIn(page, "receptionist", locale);
      await page.goto(`/${locale}/appointments/${id}`);

      await tabTo(
        page,
        page.getByRole("button", { name: a.actions.reschedule }),
      );
      await page.keyboard.press("Enter");
      const time = firstFreeTime(page);
      await expect(time).toBeAttached();
      await tabTo(page, time);
      await page.keyboard.press("Space");
      await tabTo(
        page,
        page.getByRole("button", { name: a.reschedule.submit }),
      );
      await page.keyboard.press("Enter");

      await expect(
        page.locator("dl").getByText(a.details.rescheduledAt),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: a.details.heading }),
      ).toBeFocused();
    });

    test("cancelling", async ({ page }) => {
      const { id } = await seed("days=2&start=09:00");
      await signIn(page, "receptionist", locale);
      await page.goto(`/${locale}/appointments/${id}`);

      await tabTo(page, page.getByRole("button", { name: a.actions.cancel }));
      await page.keyboard.press("Enter");
      // Opens on the safe choice, so going on takes a deliberate move.
      await expect(
        page.getByRole("button", { name: l.shared.confirm.cancel }),
      ).toBeFocused();
      await tabTo(
        page,
        page
          .getByRole("alertdialog")
          .getByRole("button", { name: a.cancel.confirm }),
      );
      await page.keyboard.press("Enter");

      await expect(
        page.locator("dl").getByText(l.shared.status.appointment.cancelled),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: a.details.heading }),
      ).toBeFocused();
    });

    test("marking a no-show", async ({ page }) => {
      const { id } = await seed("days=-1&start=09:00");
      await signIn(page, "receptionist", locale);
      await page.goto(`/${locale}/appointments/${id}`);

      await tabTo(page, page.getByRole("button", { name: a.actions.noShow }));
      await page.keyboard.press("Enter");
      await tabTo(
        page,
        page
          .getByRole("alertdialog")
          .getByRole("button", { name: a.noShow.confirm }),
      );
      await page.keyboard.press("Enter");

      await expect(
        page.locator("dl").getByText(l.shared.status.appointment.no_show),
      ).toBeVisible();
    });
  });

  test.describe(`nothing scrolls sideways, in ${locale}`, () => {
    for (const width of [768, 390]) {
      test(`at ${width}px`, async ({ page }) => {
        await workingWeek();
        await control("clinic/second-doctor");
        const long = await seed(
          `days=2&start=09:00&patient=4&note=${"Long".repeat(120)}&reason=${"Long".repeat(60)}&status=cancelled`,
        );
        await seed("days=0&start=10:00&patient=4");
        const open = await seed("days=3&start=09:00&patient=4");
        await page.setViewportSize({ width, height: 900 });
        await signIn(page, "receptionist", locale);

        const noOverflow = async () => {
          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          );
          expect(overflow).toBeLessThanOrEqual(0);
        };

        await page.goto(`/${locale}/appointments`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await noOverflow();

        await page.goto(`/${locale}/appointments/${long.id}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await noOverflow();

        await page.goto(`/${locale}/appointments/${open.id}`);
        await page.getByRole("button", { name: a.actions.reschedule }).click();
        await expect(firstFreeTime(page)).toBeAttached();
        await noOverflow();

        await page.goto(`/${locale}/appointments/new?patient_id=4`);
        await page
          .getByRole("button", { name: l.doctors.chooser.choose })
          .locator("visible=true")
          .first()
          .click();
        await expect(firstFreeTime(page)).toBeAttached();
        await noOverflow();
      });
    }
  });
}

const bookLocator = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

test.describe("when access changes during a session", () => {
  const demote = () =>
    control(`account?email=${ACCOUNTS.receptionist}&role=doctor`);

  test("the list refuses, showing no patient details", async ({ page }) => {
    await seed("days=0&start=09:00");
    await signIn(page, "receptionist");
    await page.goto("/en/appointments");
    await expect(page.getByRole("row")).toHaveCount(2);

    await demote();
    await page.reload();
    await expect(shown(page, m.shared.states.forbiddenHeading)).toBeVisible();
    await expect(page.getByText("Synthetic Patient Beta")).toHaveCount(0);
    await expect(page.getByText("01000000002")).toHaveCount(0);
  });

  test("a change is refused, and the page removes the appointment", async ({
    page,
  }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");
    await page.goto(`/en/appointments/${id}`);
    await expect(page.locator("dl")).toContainText("Synthetic Patient Beta");

    await page.getByRole("button", { name: t.actions.cancel }).click();
    await demote();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.cancel.confirm })
      .click();

    await expect(shown(page, m.shared.states.forbiddenHeading)).toBeVisible();
    await expect(page.getByText("Synthetic Patient Beta")).toHaveCount(0);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("booking is refused at the patient search and the form", async ({
    page,
  }) => {
    await workingWeek();
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await choosePatient(page, "Synthetic Patient Beta");
    await chooseDoctor(page);
    await pickFreeTime(page);

    await demote();
    await bookButton(page).click();
    await expect(shown(page, m.shared.states.forbiddenHeading)).toBeVisible();
    await expect(page.getByText("Synthetic Patient Beta")).toHaveCount(0);
  });

  test("a session ended elsewhere leads to sign-in, from the list and a change", async ({
    page,
  }) => {
    const { id } = await seed("days=2&start=09:00");
    await signIn(page, "receptionist");

    await page.goto(`/en/appointments/${id}`);
    await page.getByRole("button", { name: t.actions.cancel }).click();
    await control(`revoke?email=${ACCOUNTS.receptionist}`);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.cancel.confirm })
      .click();
    await expect(page).toHaveURL(/\/en\/sign-in/);
  });

  test("a session ended elsewhere leads to sign-in from booking", async ({
    page,
  }) => {
    await workingWeek();
    await signIn(page, "receptionist");
    await page.goto("/en/appointments/new");
    await choosePatient(page, "Synthetic Patient Beta");
    await chooseDoctor(page);
    await pickFreeTime(page);
    await visible(page, t.booking.noteLabel).fill("Synthetic private note");

    await control(`revoke?email=${ACCOUNTS.receptionist}`);
    await bookButton(page).click();

    await expect(page).toHaveURL(/\/en\/sign-in/);
    expect(page.url()).not.toContain("patient_id");
    expect(page.url()).not.toContain("Synthetic");
    const stored = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(stored).not.toContain("Synthetic");
  });

  test("signing in again never opens a record, or carries a patient number", async ({
    page,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/appointments?patient_id=2");
    await control(`revoke?email=${ACCOUNTS.receptionist}`);
    await page.goto("/en/appointments?patient_id=2");
    await expect(page).toHaveURL(/\/en\/sign-in/);
    expect(page.url()).not.toContain("patient_id");
    expect(await openings(2)).toBe(0);
  });
});
