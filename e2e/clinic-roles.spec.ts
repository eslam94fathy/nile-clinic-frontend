import { expect, test } from "@playwright/test";
import { callsTo, control, resetBackend, script, signIn } from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const m = messages.en;
const forbidden = m.shared.states.forbiddenHeading;

// Each page against each role, from the permission matrix in docs/backend-integration.md.
const PAGES = [
  { path: "staff", allowed: ["administrator"], text: m.staff.title },
  { path: "staff/new", allowed: ["administrator"], text: m.staff.createTitle },
  { path: "staff/2", allowed: ["administrator"], text: m.staff.detailsHeading },
  {
    path: "specialties",
    allowed: ["administrator"],
    text: m.specialties.title,
  },
  {
    path: "doctors",
    allowed: ["administrator", "receptionist"],
    text: m.doctors.title,
  },
  {
    path: "doctors/new",
    allowed: ["administrator"],
    text: m.doctors.chooseTitle,
  },
  {
    path: "doctors/1",
    allowed: ["administrator", "receptionist"],
    text: m.doctors.profileHeading,
  },
  {
    path: "doctors/1/edit",
    allowed: ["administrator"],
    text: m.doctors.editTitle,
  },
  {
    path: "doctors/1/schedule",
    allowed: ["administrator"],
    text: m.scheduling.appointmentMinutes,
  },
  {
    path: "fees",
    allowed: ["administrator", "receptionist"],
    text: m.fees.title,
  },
  { path: "my/schedule", allowed: ["doctor"], text: m.scheduling.myTitle },
] as const;

for (const role of ["administrator", "receptionist", "doctor"] as const) {
  test.describe(`a ${role}`, () => {
    for (const { path, allowed, text } of PAGES) {
      const may = (allowed as readonly string[]).includes(role);

      test(`${may ? "can" : "can't"} open /${path}`, async ({ page }) => {
        await signIn(page, role);

        if (may) {
          await page.goto(`/en/${path}`);
          await expect(page.getByRole("main")).toContainText(text);
          await expect(page.getByText(forbidden)).toHaveCount(0);
          return;
        }

        const response = await page.request.get(`/en/${path}`);
        const body = await response.text();
        expect(body).toContain(forbidden);
        expect(body).not.toContain(text);
      });
    }
  });
}

test.describe("what a receptionist is offered", () => {
  test.beforeEach(async ({ page }) => {
    await control("clinic/setup?doctor=1&schedule=1&fee=350.10");
    await signIn(page, "receptionist");
  });

  test("reads a doctor's whole page, with no control to change it", async ({
    page,
  }) => {
    await page.goto("/en/doctors/1");
    const main = page.getByRole("main");

    await expect(
      main.getByRole("heading", { name: m.doctors.profileHeading }),
    ).toBeVisible();
    await expect(main).toContainText("350.10");
    await expect(main).toContainText("09:00");
    await expect(main).toContainText(m.scheduling.timeOffEmptyTitle);

    await expect(
      main.getByRole("heading", { name: m.doctors.readinessHeading }),
    ).toHaveCount(0);
    await expect(main.getByRole("link", { name: m.doctors.edit })).toHaveCount(
      0,
    );
    await expect(
      main.getByRole("link", { name: m.scheduling.changeHours }),
    ).toHaveCount(0);
    await expect(main.getByRole("button", { name: m.fees.change })).toHaveCount(
      0,
    );
    await expect(
      main.getByLabel(new RegExp(`^${m.fees.amountLabel}`)),
    ).toHaveCount(0);
    await expect(
      main.getByRole("button", { name: m.scheduling.add }),
    ).toHaveCount(0);
  });

  test("isn't offered a new doctor", async ({ page }) => {
    await page.goto("/en/doctors");

    await expect(
      page.getByRole("row", { name: /Synthetic Doctor/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: m.doctors.newDoctor }),
    ).toHaveCount(0);
  });

  test("reads fees", async ({ page }) => {
    await page.goto("/en/fees");
    await expect(
      page.getByRole("row", { name: /Synthetic Doctor/ }),
    ).toContainText("350.10");
  });

  test("a forced change is refused by the API, whatever the screen shows", async ({
    page,
  }) => {
    await page.goto("/en/fees");

    const status = await page.evaluate(async () => {
      const response = await fetch("/api/backend/doctors/1/fee", {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: "1.00" }),
      });
      return response.status;
    });

    expect(status).toBe(403);
  });
});

test("a screen's belief loses to the API's 403", async ({ page }) => {
  await signIn(page, "administrator");
  await script("staff", 403);

  await page.goto("/en/staff");

  await expect(page.getByText(forbidden)).toBeVisible();
});

test.describe("pages opened before a change", () => {
  // The permanent form of the spike in research R1. Earlier pages stay mounted but hidden.
  test.beforeEach(async ({ page }) => {
    await signIn(page, "administrator");
  });

  test("show it, whether reached by a link or by the back button", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: m.shell.navigation });
    await page.goto("/en/fees");
    await expect(
      page.getByRole("row", { name: /Synthetic Doctor/ }),
    ).toContainText(m.fees.notSet);

    await page
      .getByRole("row", { name: /Synthetic Doctor/ })
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(/\/doctors\/1$/);
    await expect(
      page.getByRole("button", { name: m.fees.set, exact: true }),
    ).toBeEnabled();
    await page.getByLabel(new RegExp(`^${m.fees.amountLabel}`)).fill("350.10");
    await page.getByRole("button", { name: m.fees.set, exact: true }).click();
    await expect(page.getByText(m.fees.saved)).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/fees$/);
    await expect(
      page.getByRole("row", { name: /Synthetic Doctor/ }),
    ).toContainText("350.10");

    await page
      .getByRole("row", { name: /Synthetic Doctor/ })
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(/\/doctors\/1$/);
    await expect(
      page.getByRole("button", { name: m.fees.change, exact: true }),
    ).toBeEnabled();
    await page.getByLabel(new RegExp(`^${m.fees.amountLabel}`)).fill("400");
    await page
      .getByRole("button", { name: m.fees.change, exact: true })
      .click();
    await expect(page.locator('[id^="doctor-fee-"]')).toContainText("400.00");

    await nav.getByRole("link", { name: m.shell.nav.fees }).click();
    await expect(page).toHaveURL(/\/fees$/);
    await expect(
      page.getByRole("row", { name: /Synthetic Doctor/ }),
    ).toContainText("400.00");
  });

  test("show a new record, after a form that moved to another page", async ({
    page,
  }) => {
    const t = m.staff;
    await page.goto("/en/staff");
    await expect(
      page.getByRole("row", { name: /Synthetic Reception/ }),
    ).toBeVisible();
    await page.getByRole("link", { name: t.newAccount }).click();
    await expect(page).toHaveURL(/\/staff\/new$/);

    await page
      .getByLabel(new RegExp(`^${t.name}`))
      .locator("visible=true")
      .fill("Synthetic Created");
    await page
      .getByLabel(new RegExp(`^${t.email}`))
      .locator("visible=true")
      .fill("synthetic.created@example.test");
    await page
      .getByLabel(new RegExp(`^${t.role}`))
      .locator("visible=true")
      .selectOption("receptionist");
    await page
      .getByLabel(new RegExp(`^${t.password}`))
      .locator("visible=true")
      .fill("synthetic-password-2");
    await page
      .getByLabel(new RegExp(`^${t.passwordConfirmation}`))
      .locator("visible=true")
      .fill("synthetic-password-2");
    await page.getByRole("button", { name: t.create }).click();
    await expect(page).toHaveURL(/\/staff\/\d+$/);

    await page.getByRole("link", { name: t.backToList }).click();
    await expect(page).toHaveURL(/\/staff$/);
    await expect(
      page.getByRole("row", { name: /Synthetic Created/ }),
    ).toBeVisible();

    // The hidden form it came from keeps nothing, least of all the password.
    await page.getByRole("link", { name: t.newAccount }).click();
    await expect(page).toHaveURL(/\/staff\/new$/);
    await expect(
      page.getByLabel(new RegExp(`^${t.password}`)).locator("visible=true"),
    ).toHaveValue("");
    await expect(
      page.getByLabel(new RegExp(`^${t.name}`)).locator("visible=true"),
    ).toHaveValue("");
  });
});

test("no new page makes an audited read", async ({ page }) => {
  await control("clinic/setup?doctor=1&schedule=1&fee=350.10");
  await signIn(page, "administrator");
  for (const path of [
    "staff",
    "staff/new",
    "staff/2",
    "specialties",
    "doctors",
    "doctors/new",
    "doctors/1",
    "doctors/1/edit",
    "doctors/1/schedule",
    "fees",
  ]) {
    await page.goto(`/en/${path}`);
    await expect(page.getByRole("main")).toBeVisible();
  }

  const calls = (await control("calls")) as Record<string, number>;
  const audited = Object.keys(calls).filter(
    (endpoint) =>
      endpoint.startsWith("patients") ||
      endpoint.startsWith("audit-entries") ||
      endpoint.includes("/encounters"),
  );
  expect(audited).toEqual([]);
  expect(await callsTo("doctors/1/fee")).toBeGreaterThan(0);
});
