import { expect, type Locator, type Page, test } from "@playwright/test";
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

async function openings(id: number): Promise<number> {
  const answer = (await control(`clinic/patient-openings?id=${id}`)) as {
    count: number;
  };
  return answer.count;
}

/** Long enough for anything that was going to read a record to have done so. */
const settle = (page: Page) => page.waitForTimeout(800);

const PATIENT_ADDRESSES = ["patients", "patients/new", "patients/5"];

test.describe("who can reach patient pages", () => {
  for (const locale of ["ar", "en"] as const) {
    test(`a doctor can't, and causes no patient request, in ${locale}`, async ({
      page,
    }) => {
      await signIn(page, "doctor", locale);
      const { forbiddenHeading } = messages[locale].shared.states;

      await expect(
        mainNavigation(page, locale).getByRole("link", {
          name: messages[locale].shell.nav.patients,
        }),
      ).toHaveCount(0);

      for (const address of PATIENT_ADDRESSES) {
        await page.goto(`/${locale}/${address}`);
        await expect(page.getByText(forbiddenHeading)).toBeVisible();
      }

      await settle(page);
      expect(await callsTo("patients")).toBe(0);
      expect(await callsTo("patients/5")).toBe(0);
    });
  }

  for (const role of ["administrator", "receptionist"] as const) {
    test(`a ${role} can, from the navigation`, async ({ page }) => {
      await signIn(page, role);

      await mainNavigation(page, "en")
        .getByRole("link", { name: messages.en.shell.nav.patients })
        .click();
      await expect(page).toHaveURL(/\/en\/patients$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        messages.en.patients.title,
      );
      await expect(
        page.getByText(messages.en.shell.placeholderHeading),
      ).toHaveCount(0);

      await page.goto("/en/patients/new");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        messages.en.patients.registerForm.title,
      );

      await page.goto("/en/patients/1");
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "أحمد",
      );
    });
  }

  for (const address of ["abc", "0", "-1", "1.5", "99999999999999999999"]) {
    test(`/patients/${address} isn't a patient, and asks nothing`, async ({
      page,
    }) => {
      await signIn(page, "receptionist");
      await page.goto(`/en/patients/${address}`);

      await expect(
        page.getByText(messages.en.shared.states.notFoundHeading),
      ).toBeVisible();
      await settle(page);
      expect(await callsTo(`patients/${address}`)).toBe(0);
    });
  }

  test("a doctor's page holds no patient content at all", async ({ page }) => {
    await signIn(page, "doctor");
    const response = await page.request.get("/en/patients/1");
    const body = await response.text();

    expect(body).toContain(messages.en.shared.states.forbiddenHeading);
    expect(body).not.toContain("أحمد");
    expect(body).not.toContain(messages.en.patients.record.reload);
  });
});

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale].patients;
  const { shared } = messages[locale];

  test.describe(`one patient's record, in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "receptionist", locale);
    });

    test("shows everything recorded, as written", async ({ page }) => {
      await page.goto(`/${locale}/patients/1`);

      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "أحمد سامي تجريبي",
      );
      await expect(
        page.getByText(t.record.numberLine.replace("{number}", "1")),
      ).toBeVisible();
      const details = page.getByRole("main");
      await expect(details).toContainText(t.sex.male);
      await expect(details).toContainText("1990-04-12");
      await expect(details).toContainText("01000000001");
      await expect(details).toContainText("29004120100001");
      await expect(details).toContainText("12 Synthetic St, Cairo");
      await expect(details).toContainText("سامي تجريبي");
      await expect(details).toContainText("01000000009");
      expect(await openings(1)).toBe(1);
    });

    test("says what wasn't recorded, in words", async ({ page }) => {
      await page.goto(`/${locale}/patients/2`);

      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Synthetic Patient Beta",
      );
      // National ID, address, and emergency contact.
      await expect(page.getByText(t.fields.notRecorded)).toHaveCount(3);
    });

    test("keeps patient details out of the tab's title", async ({ page }) => {
      await page.goto(`/${locale}/patients/1`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "أحمد",
      );

      const title = await page.title();
      expect(title).toBe(messages[locale].meta.title);
      expect(title).not.toContain("أحمد");
    });

    test("shows a neutral state for a number that doesn't exist", async ({
      page,
    }) => {
      await page.goto(`/${locale}/patients/9999`);
      await expect(page.getByText(shared.states.notFoundHeading)).toBeVisible();
    });

    test("doesn't retry on its own, and tries again when asked", async ({
      page,
    }) => {
      await script("patients/1", 500);
      await page.goto(`/${locale}/patients/1`);
      await expect(page.getByText(shared.states.errorHeading)).toBeVisible();
      await settle(page);
      expect(await callsTo("patients/1")).toBe(1);

      await script("patients/1", 0);
      await page.getByRole("button", { name: shared.states.retry }).click();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "أحمد",
      );
      expect(await callsTo("patients/1")).toBe(2);
      expect(await openings(1)).toBe(1);
    });

    test("reloads when asked, saying that it records an opening", async ({
      page,
    }) => {
      await page.goto(`/${locale}/patients/1`);
      await expect(page.getByText(t.record.reloadHint)).toBeVisible();
      await page.getByRole("button", { name: t.record.reload }).click();

      await expect.poll(() => openings(1)).toBe(2);
    });

    test("a failed reload keeps the record, and says it may be old", async ({
      page,
    }) => {
      await page.goto(`/${locale}/patients/1`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "أحمد",
      );

      await script("patients/1", 500);
      await page.getByRole("button", { name: t.record.reload }).click();

      await expect(page.getByText(t.record.outOfDate)).toBeVisible();
      await expect(page.getByRole("main")).toContainText("01000000001");
    });

    for (const [status, heading] of [
      [403, shared.states.forbiddenHeading],
      [404, shared.states.notFoundHeading],
    ] as const) {
      test(`a ${status} on reloading removes the details`, async ({ page }) => {
        await page.goto(`/${locale}/patients/1`);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          "أحمد",
        );

        await script("patients/1", status);
        await page.getByRole("button", { name: t.record.reload }).click();

        await expect(page.getByText(heading)).toBeVisible();
        await expect(page.getByRole("main")).not.toContainText("01000000001");
        await expect(page.getByRole("main")).not.toContainText("أحمد");
      });
    }
  });
}

const searchField = (page: Page, label: string) =>
  page.getByRole("textbox", { name: label, exact: true });

async function submitSearch(page: Page, locale: "ar" | "en" = "en") {
  await page
    .getByRole("button", { name: messages[locale].patients.search.button })
    .click();
}

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale].patients;
  const { shared } = messages[locale];

  test.describe(`finding a patient, in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "receptionist", locale);
      await page.goto(`/${locale}/patients`);
    });

    test("lists nobody until someone searches, even with nothing entered", async ({
      page,
    }) => {
      await expect(
        page.getByText(t.search.promptTitle, { exact: true }),
      ).toBeVisible();

      await submitSearch(page, locale);
      await expect(page.getByText(t.search.needTerm)).toBeVisible();

      await searchField(page, t.fields.fullName).fill("   ");
      await submitSearch(page, locale);

      await settle(page);
      expect(await callsTo("patients")).toBe(0);
    });

    test("finds by name, across Arabic spellings, leaving the address alone", async ({
      page,
    }) => {
      await searchField(page, t.fields.fullName).fill("احمد");
      await submitSearch(page, locale);

      const results = page.getByRole("table", { name: t.search.caption });
      await expect(
        results.getByRole("link", { name: "أحمد سامي تجريبي" }),
      ).toBeVisible();
      await expect(results).toContainText("01000000001");
      await expect(results).toContainText(t.sex.male);
      // The list is the short form: nothing from the full record.
      await expect(results).not.toContainText("29004120100001");
      await expect(page).toHaveURL(new RegExp(`/${locale}/patients$`));
    });

    test("finds by phone with Arabic digits and separators, listing all who share it", async ({
      page,
    }) => {
      await searchField(page, t.fields.phone).fill("٠١٠ ٠٠٠٠-٠٠٠٢");
      await submitSearch(page, locale);

      const results = page.getByRole("table", { name: t.search.caption });
      await expect(results).toContainText("Synthetic Patient Beta");
      await expect(results).toContainText("Synthetic Child Gamma");
    });

    test("says when nothing matches, keeping the terms and offering registering", async ({
      page,
    }) => {
      await searchField(page, t.fields.fullName).fill("Nobody Synthetic");
      await submitSearch(page, locale);

      await expect(page.getByText(t.search.emptyTitle)).toBeVisible();
      await expect(searchField(page, t.fields.fullName)).toHaveValue(
        "Nobody Synthetic",
      );
      await page
        .getByRole("main")
        .getByRole("link", { name: t.register })
        .last()
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/patients/new$`));
    });

    test("shows a refusal on its field, keeping what was typed", async ({
      page,
    }) => {
      await searchField(page, t.fields.phone).fill("12");
      await submitSearch(page, locale);

      await expect(
        page.getByText("The phone number is not valid."),
      ).toBeVisible();
      await expect(searchField(page, t.fields.phone)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(searchField(page, t.fields.phone)).toHaveValue("12");
    });

    test("an error keeps the terms, doesn't retry alone, and retries when asked", async ({
      page,
    }) => {
      await script("patients", 500);
      await searchField(page, t.fields.fullName).fill("Beta");
      await submitSearch(page, locale);

      await expect(page.getByText(shared.states.errorHeading)).toBeVisible();
      await expect(searchField(page, t.fields.fullName)).toHaveValue("Beta");
      await settle(page);
      expect(await callsTo("patients")).toBe(1);

      await script("patients", 0);
      await page.getByRole("button", { name: shared.states.retry }).click();
      await expect(
        page.getByRole("link", { name: "Synthetic Patient Beta" }),
      ).toBeVisible();
      expect(await callsTo("patients")).toBe(2);
    });

    test("reset returns to the first state", async ({ page }) => {
      await searchField(page, t.fields.fullName).fill("Beta");
      await submitSearch(page, locale);
      await expect(
        page.getByRole("link", { name: "Synthetic Patient Beta" }),
      ).toBeVisible();

      await page.getByRole("button", { name: shared.filters.reset }).click();

      await expect(searchField(page, t.fields.fullName)).toHaveValue("");
      await expect(
        page.getByText(t.search.promptTitle, { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("table")).toHaveCount(0);
    });
  });
}

test.describe("a search's terms and results", () => {
  const t = messages.en.patients;
  const TERM = "Crowd";

  test.beforeEach(async ({ page }) => {
    await control("clinic/more-patients?count=20");
    await signIn(page, "receptionist");
    await page.goto("/en/patients");
  });

  test("stay out of every address, document request, and browser storage", async ({
    page,
  }) => {
    const addresses: string[] = [];
    const requests: string[] = [];
    page.on("framenavigated", (frame) => addresses.push(frame.url()));
    page.on("request", (request) => requests.push(request.url()));

    for (const label of [t.fields.fullName, t.fields.phone]) {
      await expect(searchField(page, label)).toHaveAttribute(
        "autocomplete",
        "off",
      );
    }

    await searchField(page, t.fields.fullName).fill(TERM);
    await submitSearch(page);
    await expect(page.getByRole("table")).toContainText("Synthetic Crowd");
    await page
      .getByRole("button", { name: messages.en.shared.table.next })
      .click();
    await expect(page.getByRole("table")).toContainText("Synthetic Crowd");

    await page
      .getByRole("link", { name: /Synthetic Crowd/u })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/patients\/\d+$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/patients$/);

    expect(addresses.length).toBeGreaterThan(0);
    for (const address of addresses) expect(address).not.toContain(TERM);
    // Only the call to the API itself holds the term, which is what it's for.
    for (const request of requests) {
      if (!request.includes("/api/backend/patients?")) {
        expect(request).not.toContain(TERM);
      }
    }

    const stored = await page.evaluate(() =>
      JSON.stringify([{ ...localStorage }, { ...sessionStorage }]),
    );
    expect(stored).not.toContain(TERM);
    expect(stored).not.toContain("Synthetic");
  });

  test("page by button, with the same terms and no change of address", async ({
    page,
  }) => {
    const shared = messages.en.shared.table;
    await searchField(page, t.fields.fullName).fill(TERM);
    await submitSearch(page);
    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page.getByRole("button", { name: shared.previous }),
    ).toBeDisabled();

    await page.getByRole("button", { name: shared.next }).click();

    await expect(
      page.getByRole("button", { name: shared.previous }),
    ).toBeEnabled();
    await expect(page).toHaveURL(/\/en\/patients$/);
    await expect(searchField(page, t.fields.fullName)).toHaveValue(TERM);
  });

  test("come back with the back button, and hovering or returning reads no record", async ({
    page,
  }) => {
    await searchField(page, t.fields.phone).fill("01000000002");
    await submitSearch(page);

    const link = page.getByRole("link", { name: "Synthetic Patient Beta" });
    await link.hover();
    await settle(page);
    expect(await openings(2)).toBe(0);

    await link.click();
    await expect(page).toHaveURL(/\/en\/patients\/2$/);
    await expect.poll(() => openings(2)).toBe(1);

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/patients$/);
    await expect(searchField(page, t.fields.phone)).toHaveValue("01000000002");
    await expect(link).toBeVisible();
    expect(await callsTo("patients")).toBe(1);
    await settle(page);
    expect(await openings(2)).toBe(1);
  });

  test("clicking the same result again is a new opening, and a reload clears the search", async ({
    page,
  }) => {
    await searchField(page, t.fields.fullName).fill("Beta");
    await submitSearch(page);
    const link = page.getByRole("link", { name: "Synthetic Patient Beta" });

    await link.click();
    await expect.poll(() => openings(2)).toBe(1);
    await page.goBack();
    await link.click();
    await expect.poll(() => openings(2)).toBe(2);

    await page.goBack();
    await expect(link).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(t.search.promptTitle, { exact: true }),
    ).toBeVisible();
    await expect(searchField(page, t.fields.fullName)).toHaveValue("");
    await expect(page.getByRole("table")).toHaveCount(0);
  });
});

const formField = (page: Page, label: string) =>
  page.getByLabel(new RegExp(`^${label}`, "u")).locator("visible=true");

async function fillRequired(
  page: Page,
  locale: "ar" | "en",
  { name, phone }: { name: string; phone: string },
) {
  const f = messages[locale].patients.fields;
  await formField(page, f.fullName).fill(name);
  await formField(page, f.dateOfBirth).fill("1990-04-12");
  await formField(page, f.sex).selectOption("female");
  await formField(page, f.phone).fill(phone);
}

const submitRegister = (page: Page, locale: "ar" | "en" = "en") =>
  page
    .getByRole("button", {
      name: messages[locale].patients.registerForm.submit,
      exact: true,
    })
    .click();

/** The patient number the page moved to. */
async function movedToRecord(page: Page, locale: "ar" | "en" = "en") {
  await expect(page).toHaveURL(new RegExp(`/${locale}/patients/\\d+$`));
  return Number(page.url().split("/").pop());
}

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale].patients;
  const form = t.registerForm;

  test.describe(`registering a patient, in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "receptionist", locale);
      await page.goto(`/${locale}/patients/new`);
    });

    test("says what's wrong before sending anything", async ({ page }) => {
      await submitRegister(page, locale);

      await expect(page.getByText(t.form.nameRequired)).toBeVisible();
      await expect(page.getByText(t.form.dateRequired)).toBeVisible();
      await expect(page.getByText(t.form.sexRequired)).toBeVisible();
      await expect(page.getByText(t.form.phoneRule)).toBeVisible();
      await settle(page);
      expect(await callsTo("patients")).toBe(0);
    });

    test("shows the returned record, with no read of it", async ({ page }) => {
      await fillRequired(page, locale, {
        name: "Synthetic Newcomer",
        phone: "010 0000-0040",
      });
      await submitRegister(page, locale);

      const id = await movedToRecord(page, locale);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Synthetic Newcomer",
      );
      await expect(
        page.getByText(form.registered.replace("{number}", String(id))),
      ).toBeVisible();
      await expect(page.getByRole("main")).toContainText("01000000040");
      await settle(page);
      expect(await callsTo(`patients/${id}`)).toBe(0);
      expect(await openings(id)).toBe(0);

      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Synthetic Newcomer",
      );
      await expect.poll(() => openings(id)).toBe(1);
    });

    test("shows a repeated national ID on its field, keeping what was typed", async ({
      page,
    }) => {
      await fillRequired(page, locale, {
        name: "Synthetic Twin",
        phone: "01000000041",
      });
      await formField(page, t.fields.nationalId).fill("29004120100001");
      await submitRegister(page, locale);

      await expect(
        page.getByText("This national ID has already been taken."),
      ).toBeVisible();
      await expect(formField(page, t.fields.nationalId)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(formField(page, t.fields.fullName)).toHaveValue(
        "Synthetic Twin",
      );
      await expect(page).toHaveURL(new RegExp(`/${locale}/patients/new$`));
    });

    test("warns about a shared phone, and registers anyway when told to", async ({
      page,
    }) => {
      await fillRequired(page, locale, {
        name: "Synthetic Sibling",
        phone: "01000000002",
      });
      await submitRegister(page, locale);

      await expect(page.getByText(form.matchesTitle)).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Synthetic Patient Beta" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Synthetic Child Gamma" }),
      ).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/${locale}/patients/new$`));

      await page.getByRole("button", { name: form.registerAnyway }).click();

      const id = await movedToRecord(page, locale);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Synthetic Sibling",
      );
      // One check and one save: registering anyway doesn't check again.
      expect(await callsTo("patients")).toBe(2);
      expect(await openings(id)).toBe(0);
    });

    test("says when the check can't run, and offers both ways on", async ({
      page,
    }) => {
      await script("GET patients", 500);
      await fillRequired(page, locale, {
        name: "Synthetic Unchecked",
        phone: "01000000042",
      });
      await submitRegister(page, locale);

      await expect(page.getByText(form.checkFailedTitle)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/${locale}/patients/new$`));

      await page.getByRole("button", { name: form.tryAgain }).click();
      await expect(page.getByText(form.checkFailedTitle)).toBeVisible();

      await page.getByRole("button", { name: form.registerAnyway }).click();
      await movedToRecord(page, locale);
    });
  });
}

test.describe("around registering", () => {
  const t = messages.en.patients;
  const form = t.registerForm;

  test.beforeEach(async ({ page }) => {
    await signIn(page, "receptionist");
  });

  test("changing the phone removes the warning, and the next submit checks", async ({
    page,
  }) => {
    await page.goto("/en/patients/new");
    await fillRequired(page, "en", {
      name: "Synthetic Changed",
      phone: "01000000002",
    });
    await submitRegister(page);
    await expect(page.getByText(form.matchesTitle)).toBeVisible();

    await formField(page, t.fields.phone).fill("01000000043");

    await expect(page.getByText(form.matchesTitle)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: form.registerAnyway }),
    ).toHaveCount(0);

    await submitRegister(page);
    await movedToRecord(page);
    // Two checks, and one save.
    expect(await callsTo("patients")).toBe(3);
  });

  test("opening a match and coming back keeps what was typed", async ({
    page,
  }) => {
    await page.goto("/en/patients/new");
    await fillRequired(page, "en", {
      name: "Synthetic Kept",
      phone: "01000000002",
    });
    await formField(page, t.fields.address).fill("7 Synthetic Lane");
    await submitRegister(page);

    await page.getByRole("link", { name: "Synthetic Patient Beta" }).click();
    await expect(page).toHaveURL(/\/en\/patients\/2$/);
    await expect.poll(() => openings(2)).toBe(1);

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/patients\/new$/);
    await expect(formField(page, t.fields.fullName)).toHaveValue(
      "Synthetic Kept",
    );
    await expect(formField(page, t.fields.address)).toHaveValue(
      "7 Synthetic Lane",
    );
    await expect(page.getByText(form.matchesTitle)).toBeVisible();
  });

  test("the form is empty when returned to, and back doesn't reach it", async ({
    page,
  }) => {
    await page.goto("/en/patients");
    await page
      .getByRole("main")
      .getByRole("link", { name: t.register })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/patients\/new$/);
    await fillRequired(page, "en", {
      name: "Synthetic Emptied",
      phone: "01000000044",
    });
    await submitRegister(page);
    await movedToRecord(page);

    // The form was replaced in history, as it isn't somewhere to go back to.
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/patients$/);

    await page
      .getByRole("main")
      .getByRole("link", { name: t.register })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/patients\/new$/);
    await expect(formField(page, t.fields.fullName)).toHaveValue("");
    await expect(formField(page, t.fields.phone)).toHaveValue("");
    await expect(formField(page, t.fields.sex)).toHaveValue("");
  });

  test("a held search gains the new patient", async ({ page }) => {
    await page.goto("/en/patients");
    await searchField(page, t.fields.fullName).fill("Synthetic Fresh");
    await submitSearch(page);
    await expect(page.getByText(t.search.emptyTitle)).toBeVisible();

    await page
      .getByRole("main")
      .getByRole("link", { name: t.register })
      .last()
      .click();
    await expect(page).toHaveURL(/\/en\/patients\/new$/);
    await fillRequired(page, "en", {
      name: "Synthetic Fresh Arrival",
      phone: "01000000045",
    });
    await submitRegister(page);
    await movedToRecord(page);

    await page.goBack();

    await expect(page).toHaveURL(/\/en\/patients$/);
    await expect(searchField(page, t.fields.fullName)).toHaveValue(
      "Synthetic Fresh",
    );
    await expect(
      page.getByRole("link", { name: "Synthetic Fresh Arrival" }),
    ).toBeVisible();
  });
});

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale].patients;
  const { shared } = messages[locale];

  test.describe(`correcting a patient's details, in ${locale}`, () => {
    const startEditing = async (page: Page, id: number) => {
      await page.goto(`/${locale}/patients/${id}`);
      await page.getByRole("button", { name: t.record.edit }).click();
    };
    const save = (page: Page) =>
      page.getByRole("button", { name: t.form.save }).click();
    const contactField = (page: Page, label: string) =>
      page.getByLabel(label, { exact: true }).locator("visible=true");

    test.beforeEach(async ({ page }) => {
      await signIn(page, "receptionist", locale);
    });

    test("fills in from the record, offers no reload, and reads nothing more", async ({
      page,
    }) => {
      await startEditing(page, 1);

      await expect(formField(page, t.fields.phone)).toHaveValue("01000000001");
      await expect(formField(page, t.fields.address)).toHaveValue(
        "12 Synthetic St, Cairo",
      );
      await expect(
        page.getByRole("button", { name: t.record.reload }),
      ).toHaveCount(0);
      await settle(page);
      expect(await callsTo("patients/1")).toBe(1);
      expect(await openings(1)).toBe(1);
    });

    test("saves a change and a clearing, showing what came back with no read", async ({
      page,
    }) => {
      await startEditing(page, 1);

      await formField(page, t.fields.phone).fill("010 0000-0050");
      await formField(page, t.fields.address).fill("");
      await save(page);

      await expect(page.getByText(t.form.saved)).toBeVisible();
      const main = page.getByRole("main");
      await expect(main).toContainText("01000000050");
      await expect(main).not.toContainText("12 Synthetic St");
      await expect(page.getByText(t.fields.notRecorded)).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "أحمد",
      );
      await settle(page);
      // The first read, and the save.
      expect(await callsTo("patients/1")).toBe(2);
      expect(await openings(1)).toBe(1);
    });

    test("sends nothing when nothing changed, and says so", async ({
      page,
    }) => {
      await startEditing(page, 1);

      await formField(page, t.fields.phone).fill("٠١٠ ٠٠٠٠-٠٠٠١");
      await save(page);

      await expect(page.getByText(shared.form.nothingToSave)).toBeVisible();
      await settle(page);
      expect(await callsTo("patients/1")).toBe(1);
      expect(await openings(1)).toBe(1);
    });

    test("emptying all of a contact clears it, and one part alone is refused", async ({
      page,
    }) => {
      await startEditing(page, 1);

      await contactField(page, t.fields.contactName).fill("");
      await save(page);
      await expect(page.getByText(t.form.contactPartRequired)).toBeVisible();
      expect(await callsTo("patients/1")).toBe(1);

      await contactField(page, t.fields.contactRelationship).fill("");
      await contactField(page, t.fields.contactPhone).fill("");
      await save(page);

      await expect(page.getByText(t.form.saved)).toBeVisible();
      await expect(page.getByText(t.fields.notRecorded)).toHaveCount(1);
      await expect(page.getByRole("main")).not.toContainText("01000000009");
    });

    test("gives quick feedback on an emptied required detail", async ({
      page,
    }) => {
      await startEditing(page, 1);

      await formField(page, t.fields.fullName).fill("  ");
      await save(page);

      await expect(page.getByText(t.form.nameRequired)).toBeVisible();
      expect(await callsTo("patients/1")).toBe(1);
    });

    test("shows a national ID held by someone else on its field, keeping the form", async ({
      page,
    }) => {
      await startEditing(page, 2);

      await formField(page, t.fields.nationalId).fill("29004120100001");
      await save(page);

      await expect(
        page.getByText("This national ID has already been taken."),
      ).toBeVisible();
      await expect(formField(page, t.fields.nationalId)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(formField(page, t.fields.nationalId)).toHaveValue(
        "29004120100001",
      );
    });

    test("cancelling returns the record untouched", async ({ page }) => {
      await startEditing(page, 1);

      await formField(page, t.fields.phone).fill("01000000051");
      await page.getByRole("button", { name: t.form.cancel }).click();

      const main = page.getByRole("main");
      await expect(main).toContainText("01000000001");
      await expect(main).not.toContainText("01000000051");
      expect(await callsTo("patients/1")).toBe(1);
      await expect(
        page.getByRole("button", { name: t.record.edit }),
      ).toBeFocused();
    });
  });
}

test.describe("around editing", () => {
  const t = messages.en.patients;

  test.beforeEach(async ({ page }) => {
    await signIn(page, "receptionist");
  });

  test("held results show the new name, and no held record is read", async ({
    page,
  }) => {
    await page.goto("/en/patients");
    await searchField(page, t.fields.phone).fill("01000000002");
    await submitSearch(page);

    await page.getByRole("link", { name: "Synthetic Child Gamma" }).click();
    await expect(page).toHaveURL(/\/en\/patients\/3$/);
    await expect.poll(() => openings(3)).toBe(1);
    await page.goBack();

    await page.getByRole("link", { name: "Synthetic Patient Beta" }).click();
    await expect(page).toHaveURL(/\/en\/patients\/2$/);
    await expect.poll(() => openings(2)).toBe(1);
    await page.getByRole("button", { name: t.record.edit }).click();
    await formField(page, t.fields.fullName).fill("Synthetic Patient Renamed");
    await page.getByRole("button", { name: t.form.save }).click();
    await expect(page.getByText(t.form.saved)).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/patients$/);
    await expect(
      page.getByRole("link", { name: "Synthetic Patient Renamed" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Synthetic Patient Beta" }),
    ).toHaveCount(0);

    await settle(page);
    expect(await openings(2)).toBe(1);
    expect(await openings(3)).toBe(1);
  });

  test("a record just registered, which had no read, can be edited", async ({
    page,
  }) => {
    await page.goto("/en/patients/new");
    await fillRequired(page, "en", {
      name: "Synthetic Fresh Edit",
      phone: "01000000052",
    });
    await submitRegister(page);
    const id = await movedToRecord(page);

    await page.getByRole("button", { name: t.record.edit }).click();
    await expect(formField(page, t.fields.fullName)).toHaveValue(
      "Synthetic Fresh Edit",
    );
    await formField(page, t.fields.address).fill("3 Synthetic Road");
    await page.getByRole("button", { name: t.form.save }).click();

    await expect(page.getByText(t.form.saved)).toBeVisible();
    await expect(page.getByRole("main")).toContainText("3 Synthetic Road");
    await settle(page);
    expect(await openings(id)).toBe(0);
  });
});

async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let presses = 0; presses < 80; presses += 1) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab never reached the element.");
}

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale].patients;
  const field = (page: Page, label: string) =>
    page.getByLabel(new RegExp(`^${label}`, "u")).locator("visible=true");

  test.describe(`by keyboard alone, in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "receptionist", locale);
    });

    test("finding a patient, opening them, and correcting a detail", async ({
      page,
    }) => {
      await page.goto(`/${locale}/patients`);
      await tabTo(page, searchField(page, t.fields.fullName));
      await page.keyboard.type("Beta");
      await page.keyboard.press("Enter");

      const link = page.getByRole("link", { name: "Synthetic Patient Beta" });
      await tabTo(page, link);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/${locale}/patients/2$`));

      const edit = page.getByRole("button", { name: t.record.edit });
      await tabTo(page, edit);
      await page.keyboard.press("Enter");
      await expect(field(page, t.fields.fullName)).toBeFocused();

      await tabTo(page, field(page, t.fields.address));
      await page.keyboard.type("5 Synthetic Way");
      await tabTo(page, page.getByRole("button", { name: t.form.save }));
      await page.keyboard.press("Enter");

      await expect(page.getByText(t.form.saved)).toBeVisible();
      await expect(page.getByRole("main")).toContainText("5 Synthetic Way");
      await expect(edit).toBeFocused();
    });

    test("paging through results keeps your place", async ({ page }) => {
      await control("clinic/more-patients?count=20");
      await page.goto(`/${locale}/patients`);
      await tabTo(page, searchField(page, t.fields.fullName));
      await page.keyboard.type("Crowd");
      await page.keyboard.press("Enter");

      const next = page.getByRole("button", {
        name: messages[locale].shared.table.next,
      });
      await tabTo(page, next);
      await page.keyboard.press("Enter");

      await expect(
        page.getByRole("button", {
          name: messages[locale].shared.table.previous,
        }),
      ).toBeEnabled();
      // Focus is on the results, so the next Tab goes on from there, not from the top of the page.
      await page.keyboard.press("Tab");
      await expect(
        page.locator(":focus").locator("xpath=ancestor-or-self::main"),
      ).toHaveCount(1);
    });

    test("registering, through a warning", async ({ page }) => {
      await page.goto(`/${locale}/patients/new`);
      const submit = page.getByRole("button", {
        name: t.registerForm.submit,
        exact: true,
      });
      await expect(submit).toBeEnabled();

      await tabTo(page, field(page, t.fields.fullName));
      await page.keyboard.type("Synthetic Keyboard");
      await tabTo(page, field(page, t.fields.dateOfBirth));
      await page.keyboard.type("04121990");
      await tabTo(page, field(page, t.fields.sex));
      await page.keyboard.press("ArrowDown");
      await tabTo(page, field(page, t.fields.phone));
      await page.keyboard.type("01000000002");
      await tabTo(page, submit);
      await page.keyboard.press("Enter");

      await expect(page.getByText(t.registerForm.matchesTitle)).toBeVisible();
      await tabTo(
        page,
        page.getByRole("button", { name: t.registerForm.registerAnyway }),
      );
      await page.keyboard.press("Enter");

      await movedToRecord(page, locale);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Synthetic Keyboard",
      );
    });
  });
}

test.describe("when the API refuses part way through", () => {
  const t = messages.en.patients;
  const { forbiddenHeading, notFoundHeading } = messages.en.shared.states;
  const field = (page: Page, label: string) =>
    page.getByLabel(new RegExp(`^${label}`, "u")).locator("visible=true");
  const noLongerReception = () =>
    control(`account?email=${ACCOUNTS.receptionist}&role=doctor`);
  const sessionEnds = () => control(`revoke?email=${ACCOUNTS.receptionist}`);

  test.beforeEach(async ({ page }) => {
    await signIn(page, "receptionist");
  });

  async function withResults(page: Page) {
    await page.goto("/en/patients");
    await searchField(page, t.fields.phone).fill("01000000002");
    await submitSearch(page);
    await expect(
      page.getByRole("link", { name: "Synthetic Patient Beta" }),
    ).toBeVisible();
  }

  async function withFilledForm(page: Page) {
    await page.goto("/en/patients/new");
    await fillRequired(page, "en", {
      name: "Synthetic Refused",
      phone: "01000000060",
    });
  }

  async function withRecord(page: Page) {
    await page.goto("/en/patients/2");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Synthetic Patient Beta",
    );
  }

  async function withEdit(page: Page) {
    await withRecord(page);
    await page.getByRole("button", { name: t.record.edit }).click();
    await field(page, t.fields.address).fill("6 Synthetic Close");
  }

  const expectNoDetails = async (page: Page) => {
    const main = page.getByRole("main");
    await expect(main).not.toContainText("Synthetic Patient Beta");
    await expect(main).not.toContainText("01000000002");
    await expect(main).not.toContainText("Synthetic Refused");
  };

  test("a role changed mid-session: searching", async ({ page }) => {
    await withResults(page);
    await noLongerReception();
    await submitSearch(page);

    await expect(page.getByText(forbiddenHeading)).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    // What was typed is patient detail too.
    await expect(searchField(page, t.fields.phone)).toHaveCount(0);
    await expect(
      mainNavigation(page, "en").getByRole("link", {
        name: messages.en.shell.nav.patients,
      }),
    ).toHaveCount(0);
    await expectNoDetails(page);
  });

  test("a role changed mid-session: the duplicate check", async ({ page }) => {
    await withFilledForm(page);
    await noLongerReception();
    await submitRegister(page);

    await expect(page.getByText(forbiddenHeading)).toBeVisible();
    await expect(page.getByText(t.registerForm.checkFailedTitle)).toHaveCount(
      0,
    );
    expect(await callsTo("patients")).toBe(1);
    await expect(field(page, t.fields.fullName)).toHaveCount(0);
    await expectNoDetails(page);
  });

  test("a role changed mid-session: registering anyway", async ({ page }) => {
    await page.goto("/en/patients/new");
    await fillRequired(page, "en", {
      name: "Synthetic Refused",
      phone: "01000000002",
    });
    await submitRegister(page);
    await expect(page.getByText(t.registerForm.matchesTitle)).toBeVisible();

    await noLongerReception();
    await page
      .getByRole("button", { name: t.registerForm.registerAnyway })
      .click();

    await expect(page.getByText(forbiddenHeading)).toBeVisible();
    await expectNoDetails(page);
  });

  test("a role changed mid-session: opening a result", async ({ page }) => {
    await withResults(page);
    await noLongerReception();
    const result = page.getByRole("link", { name: "Synthetic Patient Beta" });
    await result.click();

    await expect(page.getByText(forbiddenHeading)).toBeVisible();
    // The search page is held, hidden, so `getByRole` is what says nothing of it is on screen.
    await expect(result).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);
    expect(await openings(2)).toBe(0);
  });

  test("a role changed mid-session: going back to held results doesn't show them", async ({
    page,
  }) => {
    await withResults(page);
    const result = page.getByRole("link", { name: "Synthetic Patient Beta" });
    await noLongerReception();
    await result.click();
    await expect(page.getByText(forbiddenHeading)).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(/\/en\/patients$/);
    await expect(page.getByText(forbiddenHeading)).toBeVisible();
    await expect(result).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);
    expect(await openings(2)).toBe(0);
  });

  test("a role changed mid-session: reloading details", async ({ page }) => {
    await withRecord(page);
    await noLongerReception();
    await page.getByRole("button", { name: t.record.reload }).click();

    await expect(page.getByText(forbiddenHeading)).toBeVisible();
    await expectNoDetails(page);
    await expect(
      mainNavigation(page, "en").getByRole("link", {
        name: messages.en.shell.nav.patients,
      }),
    ).toHaveCount(0);
  });

  test("a role changed mid-session: saving", async ({ page }) => {
    await withEdit(page);
    await noLongerReception();
    await page.getByRole("button", { name: t.form.save }).click();

    await expect(page.getByText(forbiddenHeading)).toBeVisible();
    await expectNoDetails(page);
    await expect(page.getByRole("main")).not.toContainText("6 Synthetic Close");
  });

  test("a patient removed while being edited gives the neutral state", async ({
    page,
  }) => {
    await withEdit(page);
    await script("PATCH patients/2", 404);
    await page.getByRole("button", { name: t.form.save }).click();

    await expect(page.getByText(notFoundHeading)).toBeVisible();
    await expectNoDetails(page);
  });

  const endsTheSession = async (page: Page) => {
    await expect(page).toHaveURL(/\/en\/sign-in\?ended=1/);
    await expect(page.locator("body")).not.toContainText("Synthetic");
  };

  test("a session ended elsewhere: searching", async ({ page }) => {
    await withResults(page);
    await sessionEnds();
    await submitSearch(page);
    await endsTheSession(page);
  });

  test("a session ended elsewhere: the duplicate check", async ({ page }) => {
    await withFilledForm(page);
    await sessionEnds();
    await submitRegister(page);
    await endsTheSession(page);
  });

  test("a session ended elsewhere: opening a result", async ({ page }) => {
    await withResults(page);
    await sessionEnds();
    await page.getByRole("link", { name: "Synthetic Patient Beta" }).click();
    await endsTheSession(page);
  });

  test("a session ended elsewhere: reloading details", async ({ page }) => {
    await withRecord(page);
    await sessionEnds();
    await page.getByRole("button", { name: t.record.reload }).click();
    await endsTheSession(page);
  });

  test("a session ended elsewhere: saving", async ({ page }) => {
    await withEdit(page);
    await sessionEnds();
    await page.getByRole("button", { name: t.form.save }).click();
    await endsTheSession(page);
  });
});

test.describe("a long name and address", () => {
  for (const width of [768, 390]) {
    test(`wrap at ${width}px, in both directions`, async ({ page }) => {
      await signIn(page, "receptionist");
      await page.setViewportSize({ width, height: 900 });

      for (const locale of ["en", "ar"]) {
        await page.goto(`/${locale}/patients/4`);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          "Synthetic-Long",
        );
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      }
    });
  }
});

test("server-rendered tables still render, after paging gained buttons", async ({
  page,
}) => {
  await signIn(page, "administrator");
  await page.goto("/en/fees");

  await expect(
    page.getByRole("navigation", { name: messages.en.shared.table.pagination }),
  ).toBeVisible();
  await expect(page.getByText(messages.en.error.heading)).toHaveCount(0);
});

test.describe("what doesn't open a record", () => {
  test("tab focus, reconnecting, and returning from elsewhere", async ({
    page,
    context,
  }) => {
    await signIn(page, "receptionist");
    await page.goto("/en/patients/1");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("أحمد");
    await expect.poll(() => openings(1)).toBe(1);

    const other = await context.newPage();
    await other.bringToFront();
    await page.bringToFront();
    await other.close();
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("online"));
    });
    await settle(page);
    expect(await openings(1)).toBe(1);

    await mainNavigation(page, "en")
      .getByRole("link", { name: messages.en.shell.nav.fees })
      .click();
    await expect(page).toHaveURL(/\/en\/fees$/);
    await settle(page);
    expect(await openings(1)).toBe(1);

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/patients\/1$/);
    await expect(
      page.getByRole("button", { name: messages.en.patients.record.reload }),
    ).toBeVisible();
    await settle(page);
    expect(await openings(1)).toBe(1);
  });
});
