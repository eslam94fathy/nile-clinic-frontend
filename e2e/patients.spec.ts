import { expect, type Page, test } from "@playwright/test";
import {
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
