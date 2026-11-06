import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  control,
  PASSWORD,
  resetBackend,
  script,
  signIn,
} from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const NEW_PASSWORD = "synthetic-password-2";

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale].staff;
  const { roles, shared } = messages[locale];

  test.describe(`staff, in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "administrator", locale);
    });

    test("lists accounts, with translated roles", async ({ page }) => {
      await page.goto(`/${locale}/staff`);

      const row = page.getByRole("row", { name: /Synthetic Reception/ });
      await expect(row).toContainText(ACCOUNTS.receptionist);
      await expect(row).toContainText(roles.receptionist);
      await expect(row).toContainText(shared.status.activity.active);
    });

    test("filters survive a reload and the back button", async ({ page }) => {
      await page.goto(`/${locale}/staff`);

      await page.getByLabel(t.role, { exact: true }).selectOption("doctor");
      await page
        .getByRole("button", { name: shared.filters.apply })
        .click();
      await expect(page).toHaveURL(/role=doctor/);
      await expect(
        page.getByRole("row", { name: /Synthetic Reception/ }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("row", { name: /Synthetic Doctor/ }),
      ).toBeVisible();

      await page.reload();
      await expect(page.getByLabel(t.role, { exact: true })).toHaveValue(
        "doctor",
      );
      await expect(
        page.getByRole("row", { name: /Synthetic Reception/ }),
      ).toHaveCount(0);

      await page.goBack();
      await expect(
        page.getByRole("row", { name: /Synthetic Reception/ }),
      ).toBeVisible();
    });

    test("pages through a long list", async ({ page }) => {
      await control("clinic/more-staff?count=20");
      await page.goto(`/${locale}/staff`);

      await page
        .getByRole("navigation", { name: shared.table.pagination })
        .getByRole("link", { name: shared.table.next })
        .click();
      await expect(page).toHaveURL(/page=2/);
      await page.reload();
      await expect(page).toHaveURL(/page=2/);
      await expect(page.getByRole("row")).toHaveCount(10);
    });

    test("says when nothing matches the filters", async ({ page }) => {
      await page.goto(`/${locale}/staff?role=receptionist&is_active=0`);

      await expect(page.getByText(t.emptyFilteredTitle)).toBeVisible();
    });

    test("creates an account, and arrives at it", async ({ page }) => {
      await page.goto(`/${locale}/staff/new`);

      await page.getByLabel(new RegExp(`^${t.name}`)).fill("Synthetic Created");
      await page
        .getByLabel(new RegExp(`^${t.email}`))
        .fill("synthetic.created@example.test");
      await page
        .getByLabel(new RegExp(`^${t.role}`))
        .selectOption("receptionist");
      await page.getByLabel(new RegExp(`^${t.password}`)).fill(NEW_PASSWORD);
      await page
        .getByLabel(new RegExp(`^${t.passwordConfirmation}`))
        .fill(NEW_PASSWORD);
      await page.getByRole("button", { name: t.create }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/staff/\\d+$`));
      await expect(page.getByText(t.created)).toBeVisible();
      await expect(page.getByLabel(new RegExp(`^${t.name}`))).toHaveValue(
        "Synthetic Created",
      );
    });

    test("shows an email in use on its field, and keeps the rest", async ({
      page,
    }) => {
      await page.goto(`/${locale}/staff/new`);

      await page.getByLabel(new RegExp(`^${t.name}`)).fill("Synthetic Created");
      await page
        .getByLabel(new RegExp(`^${t.email}`))
        .fill(ACCOUNTS.receptionist);
      await page
        .getByLabel(new RegExp(`^${t.role}`))
        .selectOption("receptionist");
      await page.getByLabel(new RegExp(`^${t.password}`)).fill(NEW_PASSWORD);
      await page
        .getByLabel(new RegExp(`^${t.passwordConfirmation}`))
        .fill(NEW_PASSWORD);
      await page.getByRole("button", { name: t.create }).click();

      await expect(page.getByLabel(new RegExp(`^${t.email}`))).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(page.getByLabel(new RegExp(`^${t.name}`))).toHaveValue(
        "Synthetic Created",
      );
      await expect(page).toHaveURL(/staff\/new/);
    });

    test("edits an account", async ({ page }) => {
      await page.goto(`/${locale}/staff/2`);
      const name = page.getByLabel(new RegExp(`^${t.name}`));
      await expect(name).toHaveValue("Synthetic Reception");
      await expect(page.getByRole("button", { name: t.save })).toBeEnabled();

      await name.fill("Synthetic Changed");
      await page.getByRole("button", { name: t.save }).click();

      await expect(page.getByText(t.saved)).toBeVisible();
      await page.reload();
      await expect(page.getByLabel(new RegExp(`^${t.name}`))).toHaveValue(
        "Synthetic Changed",
      );
    });

    test("deactivating the last administrator shows the refusal", async ({
      page,
    }) => {
      await page.goto(`/${locale}/staff/1`);

      await page.getByRole("button", { name: t.deactivate }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText(t.selfDeactivateDescription);
      await dialog.getByRole("button", { name: t.deactivate }).click();

      await expect(dialog).toContainText(
        "This is the last active administrator.",
      );
    });

    test("offers no password reset on one's own account", async ({ page }) => {
      await page.goto(`/${locale}/staff/1`);

      await expect(page.getByText(t.ownPassword)).toBeVisible();
      await expect(
        page.getByRole("button", { name: t.setPassword }),
      ).toHaveCount(0);
      await page.getByRole("link", { name: t.ownPasswordLink }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/account$`));
    });
  });
}

test.describe("what an account change does to that person", () => {
  const t = messages.en.staff;

  test("deactivating ends their session, and reactivating restores sign-in only", async ({
    browser,
    page,
  }) => {
    const other = await (await browser.newContext()).newPage();
    await signIn(other, "receptionist");
    await signIn(page, "administrator");
    await page.goto("/en/staff/2");

    await page.getByRole("button", { name: t.deactivate }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.deactivate })
      .click();
    await expect(page.getByText(t.deactivated, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: t.reactivate })).toBeVisible();

    await other.goto("/en/dashboard");
    await expect(other).toHaveURL(/\/en\/sign-in\?ended=1/);

    await page.getByRole("button", { name: t.reactivate }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.reactivate })
      .click();
    await expect(
      page.getByText(t.reactivated, { exact: true }),
    ).toBeVisible();

    await signIn(other, "receptionist");
  });

  test("setting a password ends their session, and it works", async ({
    browser,
    page,
  }) => {
    const other = await (await browser.newContext()).newPage();
    await signIn(other, "receptionist");
    await signIn(page, "administrator");
    await page.goto("/en/staff/2");

    await page.getByLabel(new RegExp(`^${t.password}`)).fill(NEW_PASSWORD);
    await page
      .getByLabel(new RegExp(`^${t.passwordConfirmation}`))
      .fill(NEW_PASSWORD);
    await page.getByRole("button", { name: t.setPassword }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(t.passwordConfirmDescription);
    await dialog.getByRole("button", { name: t.setPassword }).click();

    await expect(page.getByText(t.passwordSet)).toBeVisible();
    await expect(page.getByLabel(new RegExp(`^${t.password}`))).toHaveValue("");

    await other.goto("/en/dashboard");
    await expect(other).toHaveURL(/\/en\/sign-in\?ended=1/);
    await signIn(other, "receptionist", "en", NEW_PASSWORD);
  });

  test("an administrator can be replaced, then demote themselves", async ({
    page,
  }) => {
    await control(
      `account?email=${encodeURIComponent(ACCOUNTS.receptionist)}&role=administrator`,
    );
    await signIn(page, "administrator");
    await page.goto("/en/staff/1");
    await expect(page.getByRole("button", { name: t.save })).toBeEnabled();

    await page
      .getByLabel(new RegExp(`^${t.role}`))
      .selectOption("receptionist");
    await page.getByRole("button", { name: t.save }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(t.selfDemoteDescription);
    await dialog.getByRole("button", { name: t.confirmRole }).click();

    await expect(
      page.getByText(messages.en.shared.states.forbiddenHeading),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: messages.en.shell.navigation })
        .getByRole("link", { name: messages.en.shell.nav.staff }),
    ).toHaveCount(0);
  });

  test("an administrator can deactivate themselves, and is signed out", async ({
    page,
  }) => {
    await control(
      `account?email=${encodeURIComponent(ACCOUNTS.receptionist)}&role=administrator`,
    );
    await signIn(page, "administrator");
    await page.goto("/en/staff/1");

    await page.getByRole("button", { name: t.deactivate }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.deactivate })
      .click();

    await expect(page).toHaveURL(/\/en\/sign-in\?ended=1/);
    await page
      .getByLabel(messages.en.auth.signIn.email)
      .fill(ACCOUNTS.administrator);
    await page.getByLabel(messages.en.auth.signIn.password).fill(PASSWORD);
    await page
      .getByRole("button", { name: messages.en.auth.signIn.submit, exact: true })
      .click();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });
});

test.describe("addresses and failures", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "administrator");
  });

  for (const id of ["999", "abc", "0", "-1"]) {
    test(`/staff/${id} gives the neutral not-found state`, async ({ page }) => {
      await page.goto(`/en/staff/${id}`);
      await expect(
        page.getByText(messages.en.shared.states.notFoundHeading),
      ).toBeVisible();
    });
  }

  test("an invalid filter in the address is handled", async ({ page }) => {
    await page.goto("/en/staff?role=nonsense");

    await expect(page.getByText("The role is not valid.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: messages.en.shared.states.retry }),
    ).toBeVisible();
  });

  test("a failed list shows an error with a retry", async ({ page }) => {
    await script("staff", 500);
    await page.goto("/en/staff");

    await expect(page.getByText("Scripted 500.")).toBeVisible();
    await script("staff", 0);
    await page
      .getByRole("button", { name: messages.en.shared.states.retry })
      .click();
    await expect(
      page.getByRole("row", { name: /Synthetic Reception/ }),
    ).toBeVisible();
  });

  test("a new doctor account goes on to its profile", async ({ page }) => {
    const t = messages.en.staff;
    await page.goto("/en/staff/new?role=doctor");

    await page.getByLabel(new RegExp(`^${t.name}`)).fill("Synthetic Created");
    await page
      .getByLabel(new RegExp(`^${t.email}`))
      .fill("synthetic.created@example.test");
    await page.getByLabel(new RegExp(`^${t.password}`)).fill(NEW_PASSWORD);
    await page
      .getByLabel(new RegExp(`^${t.passwordConfirmation}`))
      .fill(NEW_PASSWORD);
    await page.getByRole("button", { name: t.create }).click();

    await expect(page).toHaveURL(/\/en\/doctors\/new\?account=\d+$/);
    await expect(page.getByText(t.createdDoctor)).toBeVisible();
  });
});
