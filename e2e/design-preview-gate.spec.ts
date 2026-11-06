import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { messages } from "./support/messages";
import { previewOffPort } from "./support/ports";

const sentinel = messages.en.preview.sentinel;
const off = `http://localhost:${previewOffPort}`;

function filesIn(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}

for (const locale of ["ar", "en"] as const) {
  test.describe(`preview off, in ${locale}`, () => {
    test("matches an unknown address", async ({ request }) => {
      const preview = await request.get(`${off}/${locale}/design-preview`);
      const unknown = await request.get(`${off}/${locale}/design-previewx`);
      const body = await preview.text();

      expect(preview.status()).toBe(404);
      expect(unknown.status()).toBe(404);
      expect(body.length).toBe((await unknown.text()).length);
      expect(body).not.toContain(sentinel);
      expect(body).toContain("noindex");
    });

    for (const encoded of ["design%2Dpreview", "%64esign-preview"]) {
      test(`the encoded ${encoded} is an unknown address too`, async ({
        request,
      }) => {
        const response = await request.get(`${off}/${locale}/${encoded}`);
        expect(response.status()).toBe(404);
        expect(await response.text()).not.toContain(sentinel);
      });
    }

    for (const suffix of [
      ".rsc",
      ".segments/_tree.segment.rsc",
      ".segments/_full.segment.rsc",
    ]) {
      test(`${suffix} holds no content`, async ({ request }) => {
        const response = await request.get(
          `${off}/${locale}/design-preview${suffix}`,
        );
        expect(await response.text()).not.toContain(sentinel);
      });
    }

    test("shows the ordinary not-found page", async ({ page }) => {
      await page.goto(`${off}/${locale}/design-preview`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        messages[locale].notFound.heading,
      );
    });
  });

  test(`preview on, in ${locale}`, async ({ page }) => {
    const response = await page.goto(`/${locale}/design-preview`);

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages[locale].preview.title,
    );
    await expect(page.getByText(sentinel)).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
}

test("no build output sent to browsers, or prerendered, holds the content", () => {
  const places = [".next/static", ".next/server/app/ar", ".next/server/app/en"];
  const holding = places
    .flatMap(filesIn)
    .filter((file) => readFileSync(file).includes(sentinel));

  expect(holding).toEqual([]);
});
