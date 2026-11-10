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

const m = messages.en;
const b = m.billing;
const c = m.charges;
const BETA = "Synthetic Patient Beta";
const INTERVAL = 15_000;

const clinicToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const daysBefore = (date: string, count: number) => {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - count))
    .toISOString()
    .slice(0, 10);
};

type Seeded = { id: number; visitId: number };
const seedVisit = async (options = ""): Promise<{ id: number }> =>
  (await control(`clinic/queue-entry?${options}`)) as { id: number };
const seedCharge = async (options = ""): Promise<Seeded> =>
  (await control(`clinic/charge?${options}`)) as Seeded;
const setFee = () => control("clinic/setup?fee=350.00");
const clearCalls = () => control("calls/clear");

async function openings(id: number): Promise<number> {
  const answer = (await control(`clinic/patient-openings?id=${id}`)) as {
    count: number;
  };
  return answer.count;
}

const BILLING_READS = ["visits", "charges"] as const;
async function billingReads(): Promise<number> {
  const calls = (await control("calls")) as Record<string, number>;
  return Object.entries(calls)
    .filter(([endpoint]) =>
      BILLING_READS.some(
        (read) => endpoint === read || endpoint.startsWith(`${read}/`),
      ),
    )
    .reduce((total, [, count]) => total + count, 0);
}

/** The table keeps a copy for narrow screens, so text can be there twice, with one showing. */
const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).locator("visible=true").first();
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).locator("visible=true");
const field = (scope: Page | Locator, label: string) =>
  scope.getByLabel(label, { exact: false }).locator("visible=true");
/**
 * One form on a charge's page. The payment and refund forms share field names, as do the refund and discount forms,
 * so each is found within its own section.
 */
const section = (page: Page, heading: string) =>
  page.getByRole("region", { name: heading, exact: true });
const dialog = (page: Page) => page.getByRole("alertdialog");
const confirm = (page: Page, name: string) =>
  dialog(page).getByRole("button", { name, exact: true }).click();
/**
 * Opens a charge's page and waits for it to hydrate, which is when its forms enable their buttons. Typing before then
 * lands in front of the value React then gives the field, such as "350.00" becoming "350.0010".
 */
async function openCharge(page: Page, id: number) {
  await page.goto(`/en/charges/${id}`);
  await expect(page.locator('button[type="submit"]:disabled')).toHaveCount(0);
}
/** A fact on a charge's page: the value beside its label. */
const fact = (page: Page, label: string) =>
  page
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd[1]")
    // Only what's on screen: an earlier page, such as Billing, stays mounted but hidden, with labels of its own.
    .locator("visible=true");
const unknownNotice = (page: Page) =>
  page.getByRole("status").filter({ hasText: c.outcomeUnknown });
/** By its label, as a person does: the radio itself is visually hidden inside it. */
const chooseMethod = (
  form: Locator,
  method: keyof typeof m.shared.paymentMethod,
) =>
  form
    .getByRole("group")
    .getByText(m.shared.paymentMethod[method], { exact: true })
    .click();

async function payWith(
  page: Page,
  amount: string,
  method: keyof typeof m.shared.paymentMethod,
) {
  await field(section(page, c.payment.heading), c.payment.amountLabel).fill(
    amount,
  );
  await chooseMethod(section(page, c.payment.heading), method);
  await button(page, c.payment.submit).click();
  await confirm(page, c.payment.confirm);
}

test.describe("who can reach billing", () => {
  test("a doctor has no billing navigation, and is refused each page with no billing read", async ({
    page,
  }) => {
    await seedCharge();
    await signIn(page, "doctor");
    const navigation = mainNavigation(page, "en");
    await expect(navigation).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: m.shell.nav.billing }),
    ).toHaveCount(0);
    await expect(
      navigation.getByRole("link", { name: m.shell.nav.charges }),
    ).toHaveCount(0);
    await clearCalls();

    for (const address of ["billing", "charges", "charges/1"]) {
      await page.goto(`/en/${address}`);
      await expect(shown(page, m.shared.states.forbiddenHeading)).toBeVisible();
    }
    expect(await billingReads()).toBe(0);
  });

  for (const role of ["administrator", "receptionist"] as const) {
    test(`a ${role} opens Billing and Charges from the navigation`, async ({
      page,
    }) => {
      await signIn(page, role);
      const navigation = mainNavigation(page, "en");

      await navigation.getByRole("link", { name: m.shell.nav.billing }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: b.title }),
      ).toBeVisible();

      await navigation.getByRole("link", { name: m.shell.nav.charges }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: c.title }),
      ).toBeVisible();
    });
  }
});

test.describe("a charge's page", () => {
  for (const locale of ["en", "ar"] as const) {
    test(`shows every fact and amount exactly as sent, in ${locale}`, async ({
      page,
    }) => {
      const t = messages[locale].charges.details;
      const { id } = await seedCharge(
        "payments=100,100&refunds=50&discount=50",
      );
      await signIn(page, "receptionist", locale);
      await page.goto(`/${locale}/charges/${id}`);

      for (const [label, amount] of [
        [t.fee, "350.00"],
        [t.discount, "50.00"],
        [t.amountDue, "300.00"],
        [t.amountPaid, "150.00"],
        [t.balance, "150.00"],
      ] as const) {
        await expect(fact(page, label)).toContainText(amount);
      }
      await expect(fact(page, t.discountReason)).toHaveText(
        "Synthetic hardship discount",
      );
      await expect(
        page.getByRole("table", { name: t.refundsCaption }),
      ).toContainText("Synthetic overpayment");
      await expect(
        page.getByRole("table", { name: t.paymentsCaption }).getByRole("row"),
      ).toHaveCount(3);
    });
  }

  test("a cancelled charge says so, with its reason, and that its visit is gone", async ({
    page,
  }) => {
    const { id } = await seedCharge("cancelled=1&visit_gone=1");
    await signIn(page, "administrator");
    await openCharge(page, id);

    const note = page.getByRole("note");
    await expect(note).toContainText(c.details.cancelledTitle);
    await expect(note).toContainText("Synthetic mistaken charge");
    await expect(note).toContainText(c.details.visitGone);
    await expect(
      page.getByRole("heading", { name: c.payment.heading }),
    ).toHaveCount(0);
    await expect(button(page, c.cancel.action)).toHaveCount(0);
  });

  for (const [address, reads] of [
    ["999999", 1],
    ["abc", 0],
    ["0", 0],
  ] as const) {
    test(`/charges/${address} is a neutral not found`, async ({ page }) => {
      await signIn(page, "receptionist");
      await clearCalls();
      await page.goto(`/en/charges/${address}`);

      await expect(shown(page, m.shared.states.notFoundHeading)).toBeVisible();
      await expect(
        page.getByRole("link", { name: c.details.back }),
      ).toBeVisible();
      expect(await callsTo(`charges/${address}`)).toBe(reads);
    });
  }

  test("isn't read by hovering a link to it, and hovering writes no patient opening", async ({
    page,
  }) => {
    const { id } = await seedCharge();
    await signIn(page, "receptionist");
    await page.goto("/en/charges");
    await expect(shown(page, BETA)).toBeVisible();
    await clearCalls();

    await page
      .getByRole("link", { name: c.open })
      .locator("visible=true")
      .first()
      .hover();
    await shown(page, BETA).hover();
    await page.waitForTimeout(500);
    expect(await callsTo(`charges/${id}`)).toBe(0);
    expect(await openings(2)).toBe(0);
  });
});

test.describe("recording a payment", () => {
  test("in two parts, cash then card, until nothing is owed", async ({
    page,
  }) => {
    const { id } = await seedCharge();
    await signIn(page, "receptionist");
    await openCharge(page, id);

    await expect(
      field(section(page, c.payment.heading), c.payment.amountLabel),
    ).toHaveValue("350.00");
    await payWith(page, "150", "cash");
    await expect(fact(page, c.details.status)).toHaveText(
      m.shared.status.charge.partially_paid,
    );
    await expect(fact(page, c.details.balance)).toContainText("200.00");
    await expect(
      field(section(page, c.payment.heading), c.payment.amountLabel),
    ).toHaveValue("200.00");

    await payWith(page, "200.00", "card");
    await expect(fact(page, c.details.status)).toHaveText(
      m.shared.status.charge.paid,
    );
    await expect(fact(page, c.details.balance)).toContainText("0.00");
    await expect(
      page.getByRole("heading", { name: c.payment.heading }),
    ).toHaveCount(0);
    expect(await callsTo(`charges/${id}/payments`)).toBe(2);
    expect(new URL(page.url()).search).toBe("");
  });

  test("confirms the patient, amount, and method first, saying it can't be edited", async ({
    page,
  }) => {
    const { id } = await seedCharge();
    await signIn(page, "receptionist");
    await openCharge(page, id);
    await field(section(page, c.payment.heading), c.payment.amountLabel).fill(
      "١٠٠",
    );
    await chooseMethod(section(page, c.payment.heading), "wallet");
    await button(page, c.payment.submit).click();

    await expect(dialog(page)).toContainText(BETA);
    await expect(dialog(page)).toContainText("100.00");
    await expect(dialog(page)).toContainText(c.methodPhrase.wallet);
    await expect(dialog(page)).toContainText("can't be edited or removed");
    expect(await callsTo(`charges/${id}/payments`)).toBe(0);

    await confirm(page, c.payment.confirm);
    await expect(fact(page, c.details.amountPaid)).toContainText("100.00");
  });

  test("an amount above the balance is caught first, and the API's refusal shows when it gets through", async ({
    page,
  }) => {
    const { id } = await seedCharge();
    await signIn(page, "receptionist");
    await openCharge(page, id);
    await field(section(page, c.payment.heading), c.payment.amountLabel).fill(
      "350.01",
    );
    await chooseMethod(section(page, c.payment.heading), "cash");
    await button(page, c.payment.submit).click();

    await expect(shown(page, c.payment.aboveBalance)).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
    expect(await callsTo(`charges/${id}/payments`)).toBe(0);

    // Someone else takes part of it after this page read the charge.
    await field(section(page, c.payment.heading), c.payment.amountLabel).fill(
      "350",
    );
    await control(`clinic/change-charge?id=${id}&pay=100`);
    await button(page, c.payment.submit).click();
    await confirm(page, c.payment.confirm);
    await expect(
      shown(page, "The amount is more than the balance."),
    ).toBeVisible();
    await expect(fact(page, c.details.balance)).toContainText("250.00");
  });

  test("a method must be chosen", async ({ page }) => {
    const { id } = await seedCharge();
    await signIn(page, "receptionist");
    await openCharge(page, id);
    await button(page, c.payment.submit).click();

    await expect(shown(page, c.payment.methodRule)).toBeVisible();
    expect(await callsTo(`charges/${id}/payments`)).toBe(0);
  });

  test("a charge cancelled elsewhere gives the API's message and the charge as it now is", async ({
    page,
  }) => {
    const { id } = await seedCharge();
    await signIn(page, "receptionist");
    await openCharge(page, id);
    await control(`clinic/change-charge?id=${id}&cancel=1`);
    await chooseMethod(section(page, c.payment.heading), "cash");
    await button(page, c.payment.submit).click();
    await confirm(page, c.payment.confirm);

    await expect(page.getByRole("note")).toContainText(
      c.details.cancelledTitle,
    );
  });

  test("with no answer after it was recorded, sends once, says so, and shows the payment", async ({
    page,
  }) => {
    const { id } = await seedCharge();
    await signIn(page, "receptionist");
    await openCharge(page, id);
    await script(`charges/${id}/payments`, -2);
    await payWith(page, "120", "card");

    await expect(unknownNotice(page)).toBeVisible();
    await script(`charges/${id}/payments`, 0);
    await expect(
      page.getByRole("table", { name: c.details.paymentsCaption }),
    ).toContainText("120.00");
    expect(await callsTo(`charges/${id}/payments`)).toBe(1);
    await expect(
      field(section(page, c.payment.heading), c.payment.amountLabel),
    ).toHaveValue("120");
  });

  test("a 502 is an unknown outcome too", async ({ page }) => {
    const { id } = await seedCharge();
    await signIn(page, "receptionist");
    await openCharge(page, id);
    await script(`POST charges/${id}/payments`, 502);
    await payWith(page, "10", "cash");

    await expect(unknownNotice(page)).toBeVisible();
    expect(await callsTo(`charges/${id}/payments`)).toBe(1);
    await script(`POST charges/${id}/payments`, 0);
  });

  test("a double click on confirm sends one payment", async ({ page }) => {
    const { id } = await seedCharge();
    await signIn(page, "receptionist");
    await openCharge(page, id);
    await field(section(page, c.payment.heading), c.payment.amountLabel).fill(
      "5",
    );
    await chooseMethod(section(page, c.payment.heading), "cash");
    await button(page, c.payment.submit).click();
    await dialog(page)
      .getByRole("button", { name: c.payment.confirm, exact: true })
      .dblclick();

    await expect(fact(page, c.details.amountPaid)).toContainText("5.00");
    expect(await callsTo(`charges/${id}/payments`)).toBe(1);
  });

  test("many small payments keep every amount exact", async ({ page }) => {
    const small = Array.from({ length: 30 }, () => "0.01").join(",");
    const { id } = await seedCharge(`fee=1.00&payments=${small}`);
    await signIn(page, "receptionist");
    await openCharge(page, id);

    await expect(fact(page, c.details.amountPaid)).toContainText("0.30");
    await expect(fact(page, c.details.balance)).toContainText("0.70");
    await expect(
      field(section(page, c.payment.heading), c.payment.amountLabel),
    ).toHaveValue("0.70");
    await payWith(page, "0.70", "cash");
    await expect(fact(page, c.details.balance)).toContainText("0.00");
  });
});

test.describe("Billing", () => {
  test("lists today's visits by doctor, and keeps its filters through a reload and the back button", async ({
    page,
  }) => {
    const second = (await control("clinic/second-doctor")) as { id: number };
    await seedVisit("patient=2");
    await seedVisit(`patient=3&doctor=${second.id}`);
    await signIn(page, "receptionist");
    await page.goto("/en/billing");

    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(2);
    await expect(shown(page, BETA)).toBeVisible();
    await expect(shown(page, "Synthetic Child Gamma")).toBeVisible();

    await field(page, b.fields.chargeStatus).selectOption("none");
    await button(page, m.shared.filters.apply).click();
    await expect(page).toHaveURL(/charge_status=none/);
    await page.reload();
    await expect(field(page, b.fields.chargeStatus)).toHaveValue("none");
    await page.goBack();
    await expect(page).not.toHaveURL(/charge_status/);
  });

  test("charges a visit, opening the charge ready to pay, with focus on the payment form", async ({
    page,
  }) => {
    await setFee();
    await seedVisit("patient=2");
    await signIn(page, "receptionist");
    await page.goto("/en/billing");
    await button(page, b.charge.action).click();

    await expect(page).toHaveURL(/\/en\/charges\/\d+$/);
    await expect(
      page.getByRole("heading", { name: c.payment.heading }),
    ).toBeFocused();
    await expect(fact(page, c.details.fee)).toContainText("350.00");
    await expect(fact(page, c.details.status)).toHaveText(
      m.shared.status.charge.unpaid,
    );
    expect(await openings(2)).toBe(0);
  });

  test("shows a refusal above the list, naming the patient, and reads the list again", async ({
    page,
  }) => {
    await seedVisit("patient=2");
    await signIn(page, "receptionist");
    await page.goto("/en/billing");
    await expect(shown(page, BETA)).toBeVisible();
    await clearCalls();
    await button(page, b.charge.action).click();

    await expect(
      page.getByRole("alert").filter({ hasText: BETA }),
    ).toContainText("This doctor has no fee yet.");
    await expect.poll(() => callsTo("visits")).toBeGreaterThanOrEqual(1);
    await expect(page).toHaveURL(/\/en\/billing$/);
  });

  test("a visit charged elsewhere a moment earlier is refused, and the list then shows its charge", async ({
    page,
  }) => {
    await setFee();
    const { id } = await seedVisit("patient=2");
    await signIn(page, "receptionist");
    await page.goto("/en/billing");
    await expect(button(page, b.charge.action)).toBeVisible();
    await seedCharge(`visit=${id}`);
    await button(page, b.charge.action).click();

    await expect(
      page.getByRole("alert").filter({ hasText: BETA }),
    ).toContainText("already been charged");
    await expect(
      page.getByRole("link", { name: b.viewCharge }).locator("visible=true"),
    ).toBeVisible();
  });

  test("an unknown outcome on charging says so, and sends nothing more", async ({
    page,
  }) => {
    await setFee();
    const { id } = await seedVisit("patient=2");
    await signIn(page, "receptionist");
    await page.goto("/en/billing");
    await script(`visits/${id}/charge`, -2);
    await button(page, b.charge.action).click();

    await expect(
      page.getByRole("alert").filter({ hasText: BETA }),
    ).toContainText("can't tell");
    await script(`visits/${id}/charge`, 0);
    await expect(
      page.getByRole("link", { name: b.viewCharge }).locator("visible=true"),
    ).toBeVisible();
    expect(await callsTo(`visits/${id}/charge`)).toBe(1);
  });

  test("today reads every 15 seconds, and not while another page is open", async ({
    page,
  }) => {
    await seedVisit("patient=2");
    await signIn(page, "receptionist");
    await page.clock.install();
    await page.goto("/en/billing");
    await expect(shown(page, BETA)).toBeVisible();

    await clearCalls();
    await page.clock.fastForward(INTERVAL);
    await expect.poll(() => callsTo("visits")).toBe(1);

    await mainNavigation(page, "en")
      .getByRole("link", { name: m.shell.nav.patients })
      .click();
    await expect(page).toHaveURL(/\/en\/patients$/);
    await clearCalls();
    await page.clock.fastForward(INTERVAL * 4);
    await page.waitForTimeout(300);
    expect(await callsTo("visits")).toBe(0);
  });

  test("today keeps its list with a notice when a refresh fails", async ({
    page,
  }) => {
    await seedVisit("patient=2");
    await signIn(page, "receptionist");
    await page.clock.install();
    await page.goto("/en/billing");
    await expect(shown(page, BETA)).toBeVisible();

    await script("visits", 503);
    await page.clock.fastForward(INTERVAL);
    await expect(shown(page, m.shared.lastRead.outOfDate)).toBeVisible();
    await expect(shown(page, BETA)).toBeVisible();
    await script("visits", 0);
  });

  test("another date reads when opened and on Refresh, never by itself", async ({
    page,
  }) => {
    const earlier = daysBefore(clinicToday(), 3);
    await seedVisit(`patient=2&date=${earlier}`);
    await signIn(page, "receptionist");
    await page.clock.install();
    await page.goto(`/en/billing?date=${earlier}`);
    await expect(shown(page, BETA)).toBeVisible();

    await clearCalls();
    await page.clock.fastForward(INTERVAL * 4);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(300);
    expect(await callsTo("visits")).toBe(0);

    await button(page, m.shared.lastRead.refresh).click();
    await expect.poll(() => callsTo("visits")).toBe(1);
  });
});

test.describe("cancelling a charge", () => {
  test("with a reason, after which Billing offers Charge visit again", async ({
    page,
  }) => {
    await setFee();
    const { id: visitId } = await seedVisit("patient=2");
    const { id } = await seedCharge(`visit=${visitId}`);
    await signIn(page, "receptionist");
    await openCharge(page, id);
    await button(page, c.cancel.action).click();

    await expect(dialog(page)).toContainText(m.shared.confirm.irreversible);
    await expect(dialog(page)).toContainText(m.shared.form.noMedicalDetails);
    await confirm(page, c.cancel.confirm);
    await expect(dialog(page)).toContainText(c.cancel.reasonRule);

    await dialog(page)
      .getByLabel(c.cancel.reasonLabel, { exact: false })
      .fill("Synthetic mistaken charge");
    await confirm(page, c.cancel.confirm);
    await expect(page.getByRole("note")).toContainText(
      "Synthetic mistaken charge",
    );
    expect(page.url()).not.toContain("Synthetic");

    await page.goto("/en/billing");
    await expect(button(page, b.charge.action)).toBeVisible();
  });

  test("isn't offered while money is held, and is refused if money arrives meanwhile", async ({
    page,
  }) => {
    const paid = await seedCharge("payments=10");
    const unpaid = await seedCharge();
    await signIn(page, "receptionist");
    await openCharge(page, paid.id);
    await expect(
      page.getByRole("heading", { name: c.payment.heading }),
    ).toBeVisible();
    await expect(button(page, c.cancel.action)).toHaveCount(0);

    await openCharge(page, unpaid.id);
    await button(page, c.cancel.action).click();
    await control(`clinic/change-charge?id=${unpaid.id}&pay=5`);
    await dialog(page)
      .getByLabel(c.cancel.reasonLabel, { exact: false })
      .fill("Synthetic");
    await confirm(page, c.cancel.confirm);
    await expect(dialog(page)).toContainText("Money is held");
  });

  test("a reason stops at 500 characters", async ({ page }) => {
    const { id } = await seedCharge();
    await signIn(page, "receptionist");
    await openCharge(page, id);
    await button(page, c.cancel.action).click();
    const reason = dialog(page).getByLabel(c.cancel.reasonLabel, {
      exact: false,
    });
    await reason.fill("x".repeat(501));

    await expect(reason).toHaveValue("x".repeat(500));
  });

  test("undoing a charged check-in is refused, until the charge is cancelled", async ({
    page,
  }) => {
    const { id: entryId } = await seedVisit("patient=2&start=09:00");
    const { id } = await seedCharge(`visit=${entryId}`);
    await signIn(page, "receptionist");
    await page.goto("/en/queue");
    await button(page, m.queue.undo.action).click();
    await confirm(page, m.queue.undo.confirm);
    await expect(dialog(page)).toContainText("active charge");
    await dialog(page)
      .getByRole("button", { name: m.shared.confirm.cancel })
      .click();

    await control(`clinic/change-charge?id=${id}&cancel=1`);
    await button(page, m.queue.undo.action).click();
    await confirm(page, m.queue.undo.confirm);
    await expect(shown(page, BETA)).toBeHidden();
  });
});

test.describe("discounts and refunds", () => {
  test("an administrator discounts, keeping the fee, then waives it to paid, then removes it", async ({
    page,
  }) => {
    const { id } = await seedCharge();
    await signIn(page, "administrator");
    await openCharge(page, id);

    await field(section(page, c.discount.heading), c.discount.amountLabel).fill(
      "100",
    );
    await field(section(page, c.discount.heading), c.discount.reasonLabel).fill(
      "Synthetic hardship",
    );
    await button(page, c.discount.submit).click();
    await expect(fact(page, c.details.amountDue)).toContainText("250.00");
    await expect(fact(page, c.details.fee)).toContainText("350.00");

    await field(section(page, c.discount.heading), c.discount.amountLabel).fill(
      "350",
    );
    await field(section(page, c.discount.heading), c.discount.reasonLabel).fill(
      "Synthetic waiver",
    );
    await button(page, c.discount.submit).click();
    await expect(fact(page, c.details.status)).toHaveText(
      m.shared.status.charge.paid,
    );

    await field(section(page, c.discount.heading), c.discount.amountLabel).fill(
      "0",
    );
    await field(section(page, c.discount.heading), c.discount.reasonLabel).fill(
      "Synthetic removal",
    );
    await button(page, c.discount.submit).click();
    await expect(fact(page, c.details.status)).toHaveText(
      m.shared.status.charge.unpaid,
    );
    await expect(fact(page, c.details.discount)).toContainText("0.00");
  });

  test("a discount too large is refused on the amount", async ({ page }) => {
    const { id } = await seedCharge("payments=100");
    await signIn(page, "administrator");
    await openCharge(page, id);
    await field(section(page, c.discount.heading), c.discount.amountLabel).fill(
      "300",
    );
    await field(section(page, c.discount.heading), c.discount.reasonLabel).fill(
      "Synthetic",
    );
    await button(page, c.discount.submit).click();

    await expect(
      shown(page, "The discount is more than the fee less what was paid."),
    ).toBeVisible();
  });

  test("an administrator refunds part, with the reason shown and the payment unchanged", async ({
    page,
  }) => {
    const { id } = await seedCharge("payments=350");
    await signIn(page, "administrator");
    await openCharge(page, id);

    await field(section(page, c.refund.heading), c.refund.amountLabel).fill(
      "350.01",
    );
    await chooseMethod(section(page, c.refund.heading), "cash");
    await field(section(page, c.refund.heading), c.refund.reasonLabel).fill(
      "Synthetic overpayment",
    );
    await button(page, c.refund.submit).click();
    await expect(shown(page, c.refund.abovePaid)).toBeVisible();

    await field(section(page, c.refund.heading), c.refund.amountLabel).fill(
      "50",
    );
    await button(page, c.refund.submit).click();
    await expect(dialog(page)).toContainText("can't be edited or removed");
    await confirm(page, c.refund.confirm);

    await expect(fact(page, c.details.amountPaid)).toContainText("300.00");
    await expect(fact(page, c.details.balance)).toContainText("50.00");
    await expect(
      page.getByRole("table", { name: c.details.refundsCaption }),
    ).toContainText("Synthetic overpayment");
    await expect(
      page.getByRole("table", { name: c.details.paymentsCaption }),
    ).toContainText("350.00");
  });

  test("a refund with no answer is sent once, and says so", async ({
    page,
  }) => {
    const { id } = await seedCharge("payments=100");
    await signIn(page, "administrator");
    await openCharge(page, id);
    await script(`charges/${id}/refunds`, -2);
    await field(section(page, c.refund.heading), c.refund.amountLabel).fill(
      "20",
    );
    await chooseMethod(section(page, c.refund.heading), "card");
    await field(section(page, c.refund.heading), c.refund.reasonLabel).fill(
      "Synthetic overpayment",
    );
    await button(page, c.refund.submit).click();
    await confirm(page, c.refund.confirm);

    await expect(unknownNotice(page)).toBeVisible();
    expect(await callsTo(`charges/${id}/refunds`)).toBe(1);
    await script(`charges/${id}/refunds`, 0);
  });

  test("a receptionist is offered neither, and the API refuses one forced through", async ({
    page,
  }) => {
    const { id } = await seedCharge("payments=100");
    await signIn(page, "receptionist");
    await openCharge(page, id);
    await expect(
      page.getByRole("heading", { name: c.payment.heading }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: c.discount.heading }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: c.refund.heading }),
    ).toHaveCount(0);

    const statuses = await page.evaluate(async (chargeId) => {
      const send = (path: string, method: string, body: unknown) =>
        fetch(`/api/backend/charges/${chargeId}/${path}`, {
          method,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }).then((response) => response.status);
      return [
        await send("refunds", "POST", {
          amount: "1",
          method: "cash",
          reason: "Synthetic",
        }),
        await send("discount", "PUT", { amount: "1", reason: "Synthetic" }),
      ];
    }, id);
    expect(statuses).toEqual([403, 403]);
  });

  test("an administrator demoted while the page is open is refused, and nothing changes", async ({
    page,
  }) => {
    const { id } = await seedCharge();
    await signIn(page, "administrator");
    await openCharge(page, id);
    await field(section(page, c.discount.heading), c.discount.amountLabel).fill(
      "10",
    );
    await field(section(page, c.discount.heading), c.discount.reasonLabel).fill(
      "Synthetic",
    );
    await control(
      `account?email=${encodeURIComponent(ACCOUNTS.administrator)}&role=receptionist`,
    );
    await button(page, c.discount.submit).click();

    await expect(
      page.getByRole("heading", { name: c.discount.heading }),
    ).toHaveCount(0);
    await expect(fact(page, c.details.discount)).toContainText("0.00");
  });
});

test.describe("Charges", () => {
  test("shows the last 7 days by default, newest first, and filters by status", async ({
    page,
  }) => {
    const today = clinicToday();
    await seedCharge(`date=${today}&patient=2`);
    await seedCharge(`date=${daysBefore(today, 6)}&patient=3&payments=350`);
    await seedCharge(`date=${daysBefore(today, 10)}&patient=1`);
    await signIn(page, "receptionist");
    await page.goto("/en/charges");

    const rows = page.getByRole("table", { name: c.caption }).getByRole("row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText(today);
    await expect(rows.nth(2)).toContainText(daysBefore(today, 6));

    await field(page, c.fields.status).selectOption("paid");
    await button(page, m.shared.filters.apply).click();
    await expect(page).toHaveURL(/status=paid/);
    await expect(rows).toHaveCount(2);
    await page.reload();
    await expect(rows).toHaveCount(2);
  });

  test("one date alone means that day", async ({ page }) => {
    const earlier = daysBefore(clinicToday(), 20);
    await seedCharge(`date=${earlier}`);
    await signIn(page, "receptionist");
    await page.goto(`/en/charges?from=${earlier}`);

    await expect(
      page.getByRole("table", { name: c.caption }).getByRole("row"),
    ).toHaveCount(2);
  });

  for (const [label, from, to, message] of [
    ["93 days", "2026-01-01", "2026-04-03", c.range.tooLong],
    ["a reversed range", "2026-02-02", "2026-02-01", c.range.reversed],
  ] as const) {
    test(`${label} is caught with no read`, async ({ page }) => {
      await signIn(page, "receptionist");
      await clearCalls();
      await page.goto(`/en/charges?from=${from}&to=${to}`);

      await expect(shown(page, message)).toBeVisible();
      await expect(page.getByRole("table", { name: c.caption })).toHaveCount(0);
      expect(await callsTo("charges")).toBe(0);
    });
  }

  test("a patient's page opens their charges, with no further opening", async ({
    page,
  }) => {
    await seedCharge("patient=2");
    await seedCharge("patient=3");
    await signIn(page, "receptionist");
    await page.goto("/en/patients/2");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(BETA);
    const before = await openings(2);

    // Within the page, as the navigation has a link of the same name.
    await page
      .getByRole("main")
      .getByRole("link", { name: m.patients.recordLinks.charges })
      .click();
    await expect(page).toHaveURL(/\/en\/charges\?patient_id=2$/);
    await expect(shown(page, c.patientFilterHeading)).toBeVisible();
    await expect(
      page.getByRole("table", { name: c.caption }).getByRole("row"),
    ).toHaveCount(2);
    expect(await openings(2)).toBe(before);
  });

  test("choosing a patient puts only their number in the address, and nothing in storage", async ({
    page,
  }) => {
    await seedCharge("patient=2");
    await signIn(page, "receptionist");
    await page.goto("/en/charges");
    await button(page, m.patients.filter.open).click();
    await field(page, m.patients.fields.fullName).fill(BETA);
    await button(page, m.patients.search.button).click();
    await page
      .getByRole("button", {
        name: m.patients.chooser.chooseNamed.replace("{name}", BETA),
      })
      .click();

    await expect(page).toHaveURL(/\/en\/charges\?patient_id=2$/);
    expect(page.url()).not.toContain("Beta");
    const stored = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(stored).not.toContain("Beta");
    expect(stored).not.toContain("01000000002");
    expect(await openings(2)).toBe(0);
  });
});
