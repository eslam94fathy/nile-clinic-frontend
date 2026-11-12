import { expect, type Page, test } from "@playwright/test";
import { messages } from "../support/messages";
import { liveAccounts, signInLive } from "./support";

// Each role's main screens, measured with the browser's own timings on the production build and the real API
// (Phase 13, research R10, SC-007). No library: Largest Contentful Paint and Event Timing come from the browser.
// Record pages aren't measured, as every opening writes a permanent audit entry (ADR 0005); My visits stands in.

const CONTENT_MS = 2500;
const PRESS_MS = 200;
const OPENINGS = 8;

type Role = "administrator" | "receptionist" | "doctor";

const SCREENS: { role: Role; path: string }[] = [
  { role: "receptionist", path: "dashboard" },
  { role: "receptionist", path: "patients" },
  { role: "receptionist", path: "appointments" },
  { role: "receptionist", path: "queue" },
  { role: "receptionist", path: "billing" },
  { role: "doctor", path: "dashboard" },
  { role: "doctor", path: "my/queue" },
  { role: "doctor", path: "my/visits" },
  { role: "administrator", path: "dashboard" },
  { role: "administrator", path: "reports" },
  { role: "administrator", path: "audit" },
  { role: "administrator", path: "staff" },
];

const account = (role: Role) =>
  role === "administrator"
    ? {
        email: process.env.LIVE_ADMIN_EMAIL ?? "",
        password: process.env.LIVE_ADMIN_PASSWORD ?? "",
      }
    : role === "receptionist"
      ? liveAccounts().receptionist
      : liveAccounts().doctor;

/** The 75th percentile, as SC-007 asks for at least 75% of measurements within the target. */
function p75(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.75) - 1] ?? 0;
}

/** When the largest content was painted, after the page settled. */
async function contentTime(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let latest = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) latest = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        // The browser reports the last candidate once nothing larger appears.
        setTimeout(() => resolve(latest), 500);
      }),
  );
}

/**
 * The longest event handled while pressing the theme switch, from press to the next paint. The browser reports
 * only events over 16 ms, so none reported means under that.
 */
async function pressTime(page: Page): Promise<number> {
  await page.evaluate(() => {
    const store = window as unknown as { __events: number[] };
    store.__events = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        store.__events.push(entry.duration);
    }).observe({
      type: "event",
      durationThreshold: 16,
      buffered: false,
    } as PerformanceObserverInit);
  });
  const theme = messages.en.shared.theme;
  const group = page.getByRole("group", { name: theme.label });
  await group.getByRole("button", { name: theme.dark, exact: true }).click();
  await group.getByRole("button", { name: theme.light, exact: true }).click();
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const events = (window as unknown as { __events: number[] }).__events;
    return events.length > 0 ? Math.max(...events) : 0;
  });
}

test("each role's main screens show content within 2.5 s and answer a press within 200 ms", async ({
  browser,
}) => {
  test.setTimeout(900_000);
  const rows: { screen: string; content: number; press: number }[] = [];

  for (const role of ["receptionist", "doctor", "administrator"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInLive(page, account(role));

    for (const { path } of SCREENS.filter((screen) => screen.role === role)) {
      const content: number[] = [];
      const press: number[] = [];
      for (let opening = 0; opening < OPENINGS; opening += 1) {
        await page.goto(`/en/${path}`, { waitUntil: "load" });
        await page.waitForLoadState("networkidle");
        content.push(await contentTime(page));
        press.push(await pressTime(page));
      }
      rows.push({
        screen: `${role} /${path}`,
        content: Math.round(p75(content)),
        press: Math.round(p75(press)),
      });
    }
    await context.close();
  }

  console.log("Screen | Content, p75 (ms) | Press, p75 (ms)");
  for (const { screen, content, press } of rows) {
    console.log(`${screen} | ${content} | ${press}`);
  }

  for (const { screen, content, press } of rows) {
    expect(content, `${screen}: content`).toBeLessThanOrEqual(CONTENT_MS);
    expect(press, `${screen}: press`).toBeLessThanOrEqual(PRESS_MS);
  }
});
