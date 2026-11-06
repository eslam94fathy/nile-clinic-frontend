import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "./support/messages";

async function seriousIssues(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.html).join(", ")}`);
}

const locales = ["ar", "en"] as const;
const themes = ["light", "dark"] as const;

for (const locale of locales) {
  for (const theme of themes) {
    test.describe(`${locale}, ${theme}`, () => {
      test.use({ colorScheme: theme });

      test("the preview has no serious accessibility issues", async ({
        page,
      }) => {
        await page.goto(`/${locale}/design-preview`);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          messages[locale].preview.title,
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("so does the open dialog", async ({ page }) => {
        await page.goto(`/${locale}/design-preview`);
        await page
          .getByRole("button", {
            name: messages[locale].preview.actions.open,
            exact: true,
          })
          .click();
        await expect(page.getByRole("alertdialog")).toBeVisible();

        expect(await seriousIssues(page)).toEqual([]);
      });

      test("Phase 1's pages have none either", async ({ page }) => {
        for (const path of [`/${locale}`, `/${locale}/missing`]) {
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          expect(await seriousIssues(page)).toEqual([]);
        }
      });
    });
  }
}

// Visits every focusable element with the keyboard, reporting what it finds at each.
async function tabThrough(page: Page) {
  const reached: {
    label: string;
    hasFocusStyle: boolean;
    width: number;
    height: number;
    coveredByNotice: boolean;
  }[] = [];

  await page.locator("body").evaluate((body) => {
    body.focus();
  });

  for (let press = 0; press < 80; press += 1) {
    await page.keyboard.press("Tab");
    const element = await page.evaluate(async () => {
      // Buttons transition every property, so the ring only exists from the next frames onward.
      await new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
      const active = document.activeElement;
      if (!active || active === document.body) return null;

      const style = getComputedStyle(active);
      const box = active.getBoundingClientRect();
      const toast = document.querySelector("[data-sonner-toast]");
      const notice = toast?.getBoundingClientRect();
      const overlaps =
        !!notice &&
        box.left < notice.right &&
        box.right > notice.left &&
        box.top < notice.bottom &&
        box.bottom > notice.top;

      // Tailwind always sets transparent placeholder rings, so "not none" would prove nothing. A real
      // ring is an opaque color with a spread.
      const hasRing = [
        ...style.boxShadow.matchAll(
          /(rgba?\(([^)]*)\)) (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/g,
        ),
      ].some(([, , color = "", , , , spread = "0"]) => {
        const alpha = color.split(",")[3];
        return (
          (alpha === undefined || Number(alpha) === 1) && Number(spread) > 0
        );
      });
      const hasOutline =
        style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;

      return {
        label: active.outerHTML.slice(0, 80),
        // A date input's calendar button sits inside the input, so the input itself isn't matched by
        // :focus there. The browser draws that button's own focus ring.
        hasFocusStyle: hasRing || hasOutline || !active.matches(":focus"),
        width: box.width,
        height: box.height,
        coveredByNotice: overlaps && !toast?.contains(active),
      };
    });
    if (!element) break;
    reached.push(element);
  }
  return reached;
}

for (const locale of locales) {
  test.describe(`keyboard in ${locale}`, () => {
    // Measures the finished focus ring, rather than a frame of its transition.
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("reaches every control, with visible focus and a large enough target", async ({
      page,
    }) => {
      await page.goto(`/${locale}/design-preview`);
      await page.waitForLoadState("networkidle");

      const reached = await tabThrough(page);
      const buttons = await page.getByRole("button").count();

      expect(reached.length).toBeGreaterThanOrEqual(buttons - 4);
      expect(reached.filter((item) => !item.hasFocusStyle)).toEqual([]);
      expect(
        reached.filter((item) => item.width < 24 || item.height < 24),
      ).toEqual([]);
    });

    test("a notice never covers what has focus", async ({ page }) => {
      await page.goto(`/${locale}/design-preview`);
      await page.waitForLoadState("networkidle");
      const text = messages[locale].preview.actions;
      await page.getByRole("button", { name: text.showSuccess }).click();
      await expect(page.getByText(text.success)).toBeVisible();

      const reached = await tabThrough(page);
      expect(reached.filter((item) => item.coveredByNotice)).toEqual([]);
    });
  });

  test.describe(`layout in ${locale}`, () => {
    for (const width of [768, 1024, 1280, 1920]) {
      test(`no sideways scrolling at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}/design-preview`);
        await page.waitForLoadState("networkidle");

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);

        // A phone number split across lines is easy to misread.
        const phones = await page
          .locator('[data-slot="table"] bdi[dir="ltr"]')
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getClientRects().length),
          );
        expect(phones.length).toBeGreaterThan(0);
        expect(phones.filter((lines) => lines > 1)).toEqual([]);

        // Fields line up, even when one of them has a hint.
        const fieldTops = await page
          .getByRole("form")
          .locator("input, select")
          .evaluateAll((nodes) =>
            nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
          );
        if (width >= 1024) expect(new Set(fieldTops).size).toBe(1);

        await expect(
          page.getByRole("table", {
            name: messages[locale].preview.list.caption,
          }),
        ).toBeVisible();
      });
    }

    test("narrow screens get cards instead of the table", async ({ page }) => {
      await page.setViewportSize({ width: 600, height: 900 });
      await page.goto(`/${locale}/design-preview`);
      await page.waitForLoadState("networkidle");
      const caption = messages[locale].preview.list.caption;

      await expect(page.getByRole("table", { name: caption })).toHaveCount(0);
      await expect(page.getByRole("list", { name: caption })).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });

  test(`filters in ${locale} use the address, except the private one`, async ({
    page,
  }) => {
    const list = messages[locale].preview.list;
    const filters = messages[locale].shared.filters;
    await page.goto(`/${locale}/design-preview?page=2`);

    await page.getByLabel(list.filterDate).fill("2026-11-08");
    await page.getByLabel(list.filterSearch).fill("Test Patient Alpha");
    await page.getByRole("button", { name: filters.apply }).click();

    await expect(page).toHaveURL(/date=2026-11-08/);
    // Keyboard users stay where they were.
    await expect(
      page.getByRole("button", { name: filters.apply }),
    ).toBeFocused();
    expect(page.url()).not.toContain("Patient");
    expect(page.url()).not.toContain("page=2");
    await expect(
      page.getByRole("status").getByText("Test Patient Alpha"),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByLabel(list.filterDate)).toHaveValue("2026-11-08");
  });
}
