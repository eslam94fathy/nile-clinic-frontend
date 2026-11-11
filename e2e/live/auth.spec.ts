import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { mainNavigation, signOutButton } from "../support/auth";
import { messages } from "../support/messages";
import { adminToken, api, apiUrl, liveAccounts, signInLive } from "./support";

// Against the real API. Quickstart scenarios 1, 2, 4, 6, 8, 10, 15, 16, 17, and 19.

const nav = messages.en.shell.nav;

async function hasSessionCookie(page: Page) {
  return (await page.context().cookies()).some(
    ({ name }) => name === "nile_session",
  );
}

test.describe.configure({ mode: "serial" });

for (const locale of ["ar", "en"] as const) {
  const t = messages[locale];

  test(`a receptionist signs in and sees only their navigation, in ${locale}`, async ({
    page,
  }) => {
    await signInLive(page, liveAccounts().receptionist, locale);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Synthetic Live receptionist",
    );
    await expect(mainNavigation(page, locale).getByRole("link")).toHaveText([
      t.shell.nav.dashboard,
      t.shell.nav.patients,
      t.shell.nav.appointments,
      t.shell.nav.queue,
      t.shell.nav.billing,
      t.shell.nav.charges,
      t.shell.nav.doctors,
      t.shell.nav.fees,
    ]);

    await page.goto(`/${locale}/staff`);
    await expect(
      page.getByText(t.shared.states.forbiddenHeading),
    ).toBeVisible();
  });

  test(`a wrong password shows the API's own message, in ${locale}`, async ({
    page,
  }) => {
    const s = t.auth.signIn;
    await page.goto(`/${locale}/sign-in`);
    await page.getByLabel(s.email).fill(liveAccounts().receptionist.email);
    await page.getByLabel(s.password).fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: s.submit, exact: true }).click();

    await expect(page.getByLabel(s.email)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page).toHaveURL(new RegExp(`/${locale}/sign-in`));
    expect(await hasSessionCookie(page)).toBe(false);
  });
}

test("a doctor with a profile sees their navigation and landing page", async ({
  page,
}) => {
  await signInLive(page, liveAccounts().doctor);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Synthetic Live doctor",
  );
  await expect(mainNavigation(page, "en").getByRole("link")).toHaveText([
    nav.dashboard,
    nav.myQueue,
    nav.myAppointments,
    nav.myVisits,
    nav.mySchedule,
  ]);

  await page.goto("/en/patients");
  await expect(
    page.getByText(messages.en.shared.states.forbiddenHeading),
  ).toBeVisible();
});

test("an administrator sees their navigation", async ({ page }) => {
  const email = process.env.LIVE_ADMIN_EMAIL ?? "";
  const password = process.env.LIVE_ADMIN_PASSWORD ?? "";
  await signInLive(page, { email, password });

  await expect(mainNavigation(page, "en").getByRole("link")).toHaveText([
    nav.dashboard,
    nav.patients,
    nav.appointments,
    nav.queue,
    nav.billing,
    nav.charges,
    nav.doctors,
    nav.specialties,
    nav.fees,
    nav.staff,
    nav.reports,
    nav.audit,
  ]);

  await signOutButton(page, "en").click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  expect(await hasSessionCookie(page)).toBe(false);
});

test("the sealed cookie is useless at the API, and the token isn't in the browser", async ({
  page,
  context,
}) => {
  const sent: string[] = [];
  page.on("response", async (response) => {
    if (response.url().includes("/api/auth/sign-in")) {
      sent.push(await response.text().catch(() => ""));
    }
  });
  await signInLive(page, liveAccounts().receptionist);

  // Sanctum tokens look like `<id>|<value>`.
  expect(sent.join()).not.toMatch(/\d+\|[A-Za-z0-9]{20,}/);
  expect(sent.join()).not.toContain("token");
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "nile_session",
  );

  const cookie = (await context.cookies()).find(
    ({ name }) => name === "nile_session",
  );
  expect(cookie?.httpOnly).toBe(true);

  const response = await api("auth/me", { token: cookie?.value ?? "" });
  expect(response.status).toBe(401);
});

test("lists through the same-origin route don't reveal the private address", async ({
  page,
}) => {
  const email = process.env.LIVE_ADMIN_EMAIL ?? "";
  const password = process.env.LIVE_ADMIN_PASSWORD ?? "";
  await signInLive(page, { email, password });

  const { status, body } = await page.evaluate(async () => {
    const response = await fetch("/api/backend/staff?per_page=1", {
      headers: { Accept: "application/json" },
    });
    return { status: response.status, body: await response.text() };
  });

  expect(status).toBe(200);
  const { host } = new URL(apiUrl());
  expect(body).not.toContain(host);
  expect(JSON.parse(body).meta).toEqual(
    expect.objectContaining({
      current_page: 1,
      per_page: 1,
      last_page: expect.any(Number),
      total: expect.any(Number),
    }),
  );
  expect(JSON.parse(body).links).toBeUndefined();

  await signOutButton(page, "en").click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});

test("a doctor with no profile sees the state, until the profile exists", async ({
  page,
}) => {
  const { newDoctor } = liveAccounts();
  await signInLive(page, newDoctor);
  await expect(
    page.getByText(messages.en.auth.noProfile.heading),
  ).toBeVisible();

  await page.goto("/en/account");
  await expect(
    page.getByRole("heading", { name: messages.en.auth.account.title }),
  ).toBeVisible();

  const token = await adminToken();
  const created = await api("doctors", {
    method: "POST",
    token,
    body: {
      user_id: newDoctor.id,
      title: "Dr",
      specialty_ids: [Number(process.env.LIVE_SPECIALTY_ID)],
    },
  });
  expect(created.status).toBe(201);
  await api("auth/sign-out", { method: "POST", token });

  await page.goto("/en/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Synthetic Live newdoctor",
  );
  await expect(page.getByText(messages.en.auth.noProfile.heading)).toHaveCount(
    0,
  );
});

test("a changed role shows on the next navigation", async ({ page }) => {
  const { disposable } = liveAccounts();
  await signInLive(page, disposable);
  const links = mainNavigation(page, "en");
  await expect(links.getByRole("link", { name: nav.staff })).toHaveCount(0);

  const token = await adminToken();
  const changed = await api(`staff/${String(disposable.id)}`, {
    method: "PATCH",
    token,
    body: { role: "administrator" },
  });
  expect(changed.status).toBe(200);

  await links.getByRole("link", { name: nav.queue }).click();
  await expect(links.getByRole("link", { name: nav.staff })).toBeVisible();

  await api(`staff/${String(disposable.id)}`, {
    method: "PATCH",
    token,
    body: { role: "receptionist" },
  });
  await api("auth/sign-out", { method: "POST", token });
});

test("changing a password keeps this session, and ends another", async ({
  browser,
  page,
}) => {
  const { passwordChange: account } = liveAccounts();
  await signInLive(page, account);
  const other = await (await browser.newContext()).newPage();
  await signInLive(other, account);

  const next = `Synthetic-${randomBytes(12).toString("hex")}`;
  const t = messages.en.auth.account;
  await page.goto("/en/account");
  await page
    .getByLabel(new RegExp(`^${t.currentPassword}`))
    .fill(account.password);
  await page.getByLabel(new RegExp(`^${t.newPassword}`)).fill(next);
  await page.getByLabel(new RegExp(`^${t.confirmPassword}`)).fill(next);
  await page.getByRole("button", { name: t.submit }).click();
  await expect(page.getByRole("status")).toContainText(t.success);

  await page.reload();
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  await other.goto("/en/dashboard");
  await expect(other).toHaveURL(/\/en\/sign-in\?ended=1/);
  expect(await hasSessionCookie(other)).toBe(false);

  const oldPassword = await api("auth/sign-in", {
    method: "POST",
    body: { email: account.email, password: account.password },
  });
  expect(oldPassword.status).toBe(422);
  const newPassword = await api("auth/sign-in", {
    method: "POST",
    body: { email: account.email, password: next },
  });
  expect(newPassword.status).toBe(200);
});

test("an administrator setting a new password ends the session", async ({
  page,
}) => {
  const { disposable } = liveAccounts();
  await signInLive(page, disposable);
  // A page that reads nothing by itself: the dashboard's own reads would find the ended session before the click.
  await page.goto("/en/account");

  const token = await adminToken();
  const password = `Synthetic-${randomBytes(12).toString("hex")}`;
  const reset = await api(`staff/${String(disposable.id)}/password`, {
    method: "PUT",
    token,
    body: { password, password_confirmation: password },
  });
  expect(reset.status).toBe(204);
  await api("auth/sign-out", { method: "POST", token });

  await mainNavigation(page, "en")
    .getByRole("link", { name: nav.queue })
    .click();

  await expect(page).toHaveURL(/\/en\/sign-in\?ended=1/);
  await expect(
    page.getByText(messages.en.auth.signIn.sessionEnded),
  ).toBeVisible();
  expect(await hasSessionCookie(page)).toBe(false);

  await signInLive(page, { email: disposable.email, password });

  const second = await adminToken();
  const deactivated = await api(`staff/${String(disposable.id)}/deactivate`, {
    method: "POST",
    token: second,
  });
  expect(deactivated.status).toBe(200);
  await api("auth/sign-out", { method: "POST", token: second });

  // Deactivated: the next load ends the session, and signing in is refused with the same message.
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/sign-in\?ended=1/);
  expect(await hasSessionCookie(page)).toBe(false);

  const s = messages.en.auth.signIn;
  await page.getByLabel(s.email).fill(disposable.email);
  await page.getByLabel(s.password).fill(password);
  await page.getByRole("button", { name: s.submit, exact: true }).click();
  await expect(page.getByLabel(s.email)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});
