import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  callsTo,
  control,
  type Locale,
  PASSWORD,
  resetBackend,
  script,
  mainNavigation,
  signIn,
  signOutButton,
} from "./support/auth";
import { messages } from "./support/messages";

test.beforeEach(resetBackend);

const NOTE = "Synthetic unsaved sentence";
const PATIENT = 2;
// Past the 5-minute limit (ADR 0020), without waiting for it.
const PAST_THE_LIMIT = "05:01";

type Reads = { opened: number; history: number; saves: number };
const reads = async () => (await control("clinic/encounter-reads")) as Reads;

async function seedDraft(content: Record<string, unknown> = {}) {
  const query = new URLSearchParams({ content: JSON.stringify(content) });
  return (
    (await control(`clinic/encounter?${query.toString()}`)) as { id: number }
  ).id;
}

const lockDialog = (page: Page, locale: Locale) =>
  page.getByRole("dialog", { name: messages[locale].auth.lock.heading });
const passwordField = (page: Page, locale: Locale) =>
  lockDialog(page, locale).getByLabel(messages[locale].auth.lock.password, {
    exact: false,
  });
const diagnosis = (page: Page, locale: Locale) =>
  page.getByLabel(messages[locale].encounters.form.diagnosis, { exact: true });

async function openDraftWithText(page: Page, locale: Locale) {
  const id = await seedDraft();
  await page.clock.install();
  await signIn(page, "doctor", locale);
  await page.goto(`/${locale}/my/encounters/${id}`);
  await diagnosis(page, locale).locator("visible=true").fill(NOTE);
  return id;
}

async function unlockWith(page: Page, locale: Locale, password: string) {
  await passwordField(page, locale).fill(password);
  await lockDialog(page, locale)
    .getByRole("button", { name: messages[locale].auth.lock.unlock })
    .click();
}

/** Focus never leaves the lock, however far Tab goes. */
async function expectFocusTrapped(page: Page) {
  for (let press = 0; press < 8; press += 1) {
    await page.keyboard.press(press % 2 === 0 ? "Tab" : "Shift+Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest("dialog") !== null,
      ),
    ).toBe(true);
  }
}

for (const [locale, theme] of [
  ["ar", "light"],
  ["ar", "dark"],
  ["en", "light"],
  ["en", "dark"],
] as const) {
  test(`a record locks, hides everything, and keeps the text, in ${locale}, ${theme}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (stored) => localStorage.setItem("theme", stored),
      theme,
    );
    await openDraftWithText(page, locale);
    const before = await reads();
    const signIns = await callsTo("auth/sign-in");

    await page.clock.fastForward(PAST_THE_LIMIT);

    await expect(lockDialog(page, locale)).toBeVisible();
    await expect(lockDialog(page, locale)).toContainText("Synthetic Doctor");
    await expect(diagnosis(page, locale).locator("visible=true")).toHaveCount(
      0,
    );
    await expect(passwordField(page, locale)).toBeFocused();
    await expectFocusTrapped(page);

    const { violations } = await new AxeBuilder({ page }).analyze();
    // Any WCAG A or AA violation fails, as in the accessibility sweep (SC-006).
    const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
    expect(
      violations
        .filter(
          ({ impact, tags }) =>
            impact === "serious" ||
            impact === "critical" ||
            tags.some((tag) => wcag.includes(tag)),
        )
        .map(({ id }) => id),
    ).toEqual([]);

    await unlockWith(page, locale, "synthetic-wrong-password");
    await expect(lockDialog(page, locale)).toContainText(
      locale === "ar"
        ? "بيانات الدخول هذه غير صحيحة."
        : "These credentials do not match our records.",
    );
    await expect(lockDialog(page, locale)).toBeVisible();

    await unlockWith(page, locale, PASSWORD);
    await expect(lockDialog(page, locale)).toBeHidden();
    await expect(diagnosis(page, locale).locator("visible=true")).toHaveValue(
      NOTE,
    );

    // Nothing was saved, and the record wasn't read again: only the sign-ins and the old token's sign-out.
    expect(await reads()).toEqual(before);
    expect(await callsTo("auth/sign-in")).toBe(signIns + 2);
    expect(await callsTo("auth/sign-out")).toBe(1);
  });
}

test("a patient's history locks too, and unlocks by keyboard alone", async ({
  page,
}) => {
  // A record of this doctor's for the patient, so that their history is open to them.
  await seedDraft();
  await page.clock.install();
  await signIn(page, "doctor", "en");
  await page.goto(`/en/my/patients/${PATIENT}/history`);
  await expect(
    page.getByRole("heading", { level: 1 }).locator("visible=true"),
  ).toBeVisible();

  await page.clock.fastForward(PAST_THE_LIMIT);
  await expect(lockDialog(page, "en")).toBeVisible();
  const before = await reads();

  await page.keyboard.type(PASSWORD);
  await page.keyboard.press("Enter");

  await expect(lockDialog(page, "en")).toBeHidden();
  expect((await reads()).history).toBe(before.history);
});

test("other pages never lock", async ({ page }) => {
  await page.clock.install();
  await signIn(page, "doctor", "en");

  for (const address of [
    "/en/dashboard",
    "/en/my/appointments",
    "/en/my/queue",
  ]) {
    await page.goto(address);
    await page.clock.fastForward("10:00");
    await expect(lockDialog(page, "en")).toHaveCount(0);
  }
});

test("a page whose limit passed while hidden locks before showing anything", async ({
  page,
}) => {
  await openDraftWithText(page, "en");

  // Timers don't run in a hidden tab, so only the clock moves before the page is seen again.
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
  await page.clock.setSystemTime(now + 6 * 60 * 1000);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );

  await expect(lockDialog(page, "en")).toBeVisible();
  await expect(diagnosis(page, "en").locator("visible=true")).toHaveCount(0);
});

test("signing out from the lock warns first, then signs out", async ({
  page,
}) => {
  const t = messages.en.auth.lock;
  await openDraftWithText(page, "en");
  await page.clock.fastForward(PAST_THE_LIMIT);

  await lockDialog(page, "en").getByRole("button", { name: t.signOut }).click();
  await expect(lockDialog(page, "en")).toContainText(t.signOutWarning);
  await lockDialog(page, "en")
    .getByRole("button", { name: t.keepLocked })
    .click();
  await expect(passwordField(page, "en")).toBeVisible();

  await lockDialog(page, "en").getByRole("button", { name: t.signOut }).click();
  await lockDialog(page, "en")
    .getByRole("button", { name: t.signOutConfirm })
    .click();

  await expect(page).toHaveURL(/\/en\/sign-in$/);
});

test("too many attempts: the backend's message, and still locked", async ({
  page,
}) => {
  await openDraftWithText(page, "en");
  await page.clock.fastForward(PAST_THE_LIMIT);
  await script("POST auth/sign-in", 422, "email");

  await unlockWith(page, "en", PASSWORD);

  await expect(lockDialog(page, "en")).toContainText("Scripted 422.");
  await expect(diagnosis(page, "en").locator("visible=true")).toHaveCount(0);
});

test("an open confirmation survives the lock, Escape included", async ({
  page,
}) => {
  const t = messages.en.encounters.finalize;
  const id = await seedDraft({
    chief_complaint: "Synthetic",
    diagnosis: "Synthetic finding",
  });
  await page.clock.install();
  await signIn(page, "doctor", "en");
  await page.goto(`/en/my/encounters/${id}`);
  await page
    .getByRole("button", { name: t.action, exact: true })
    .locator("visible=true")
    .click();
  const confirmation = page.getByRole("alertdialog", { name: t.title });
  await expect(confirmation).toBeVisible();

  await page.clock.fastForward(PAST_THE_LIMIT);
  await expect(lockDialog(page, "en")).toBeVisible();
  await expect(confirmation).toBeHidden();

  // Escape twice: the browser may close a modal on a repeated Escape, and Radix listens for it too.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(lockDialog(page, "en")).toBeVisible();
  await expectFocusTrapped(page);

  await unlockWith(page, "en", PASSWORD);
  await expect(lockDialog(page, "en")).toBeHidden();
  await expect(confirmation).toBeVisible();
});

test("each tab unlocks on its own, and a sign-out elsewhere still leaves", async ({
  page,
  context,
}) => {
  const first = await openDraftWithText(page, "en");
  const second = await context.newPage();
  await second.goto(`/en/my/encounters/${first}`);
  await expect(diagnosis(second, "en").locator("visible=true")).toBeVisible();

  await page.clock.fastForward(PAST_THE_LIMIT);
  await second.clock.fastForward(PAST_THE_LIMIT);
  await expect(lockDialog(page, "en")).toBeVisible();
  await expect(lockDialog(second, "en")).toBeVisible();

  await unlockWith(page, "en", PASSWORD);
  await expect(lockDialog(page, "en")).toBeHidden();
  await expect(lockDialog(second, "en")).toBeVisible();

  // The unlocked tab's fresh session serves the others too.
  const third = await context.newPage();
  await third.goto("/en/dashboard");
  await signOutButton(third, "en").click();
  await expect(second).toHaveURL(/\/en\/sign-in$/);
});

test("the back button never shows the locked record", async ({ page }) => {
  await page.clock.install();
  await signIn(page, "doctor", "en");
  const id = await seedDraft();
  await page.goto("/en/my/queue");
  await page.goto(`/en/my/encounters/${id}`);
  await diagnosis(page, "en").locator("visible=true").fill(NOTE);
  await page.clock.fastForward(PAST_THE_LIMIT);
  await expect(lockDialog(page, "en")).toBeVisible();

  await page.goBack({ waitUntil: "commit", timeout: 2_000 }).catch(() => null);

  // Either the lock stays, or the page has gone through its own leave guard: the record is never shown.
  await expect(diagnosis(page, "en").locator("visible=true")).toHaveCount(0);
});

test("reloading a locked record, or opening one in a new tab, shows only the lock and reads nothing (S1)", async ({
  page,
  context,
}) => {
  const id = await openDraftWithText(page, "en");
  await page.clock.fastForward(PAST_THE_LIMIT);
  await expect(lockDialog(page, "en")).toBeVisible();
  const before = await reads();

  // The page's own warning about unsaved text; leaving anyway.
  page.on("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await expect(lockDialog(page, "en")).toBeVisible();
  await expect(diagnosis(page, "en")).toHaveCount(0);

  const other = await context.newPage();
  for (const address of [
    `/en/my/encounters/${String(id)}`,
    `/en/my/patients/${String(PATIENT)}/history`,
  ]) {
    await other.goto(address);
    await expect(lockDialog(other, "en")).toBeVisible();
    await expect(lockDialog(other, "en")).toContainText("Synthetic Doctor");
  }
  await expect(diagnosis(other, "en")).toHaveCount(0);
  // Neither the record nor the history was read while locked.
  expect(await reads()).toEqual(before);

  // Unlocking reads it, as the person asked; afterwards, records open as before.
  await unlockWith(other, "en", PASSWORD);
  await expect(lockDialog(other, "en")).toBeHidden();
  await page.goto(`/en/my/encounters/${String(id)}`);
  await expect(diagnosis(page, "en").locator("visible=true")).toBeVisible();
  await expect(lockDialog(page, "en")).toHaveCount(0);
});

test("a record kept by Back opens without a lock after work on other pages of the tab", async ({
  page,
}) => {
  const id = await seedDraft();
  await page.clock.install();
  await signIn(page, "doctor", "en");
  await page.goto(`/en/my/encounters/${String(id)}`);
  await expect(diagnosis(page, "en").locator("visible=true")).toBeVisible();
  // Nothing typed, so leaving asks nothing.
  await mainNavigation(page, "en")
    .getByRole("link", { name: messages.en.shell.nav.myQueue })
    .click();
  await expect(page).toHaveURL(/\/en\/my\/queue$/);

  // Six minutes of work elsewhere in the same tab.
  for (let minute = 0; minute < 6; minute += 1) {
    await page.clock.fastForward("01:00");
    await page.mouse.move(10 + minute, 10);
  }
  await page.goBack();

  await expect(diagnosis(page, "en").locator("visible=true")).toBeVisible();
  await expect(lockDialog(page, "en")).toHaveCount(0);
});
