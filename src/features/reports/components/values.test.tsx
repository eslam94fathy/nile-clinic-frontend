import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import {
  AverageMinutes,
  CountNeedingAttention,
  formatRate,
  NeedsAttention,
  NoShowRate,
  SignedMoney,
} from "./values";

afterEach(cleanup);

const LOCALES = ["en", "ar"] as const;
const notAvailable = {
  en: messagesByLocale.en.reports.notAvailable,
  ar: messagesByLocale.ar.reports.notAvailable,
};
const digitsOf = (text: string) => text.replace(/[^\d.]/g, "");

describe("formatRate", () => {
  it.each(LOCALES)(
    "gives back every value from 0.0 to 100.0, with one decimal, in %s",
    (locale) => {
      for (let tenths = 0; tenths <= 1000; tenths += 1) {
        const value = tenths / 10;
        const formatted = formatRate(value, locale);
        expect(digitsOf(formatted)).toBe(value.toFixed(1));
        expect(formatted).toMatch(/%/);
      }
    },
  );
});

describe("NoShowRate", () => {
  it.each(LOCALES)("is not available, never zero, for null in %s", (locale) => {
    const { container } = renderWithIntl(<NoShowRate value={null} />, locale);
    expect(container.textContent).toBe(notAvailable[locale]);
    expect(container.textContent).not.toMatch(/0/);
  });

  it("shows zero as zero", () => {
    const { container } = renderWithIntl(<NoShowRate value={0} />, "en");
    expect(container.textContent).toBe("0.0%");
  });

  it("uses Western digits in Arabic", () => {
    const { container } = renderWithIntl(<NoShowRate value={12.5} />, "ar");
    expect(container.textContent).toContain("12.5");
  });
});

describe("AverageMinutes", () => {
  it("gives whole minutes with the visits they cover", () => {
    const { container } = renderWithIntl(
      <AverageMinutes value={12} visits={40} />,
      "en",
    );
    expect(container.textContent).toBe("12 minutes, over 40 visits");
  });

  it("shows zero minutes as zero", () => {
    const { container } = renderWithIntl(
      <AverageMinutes value={0} visits={3} />,
      "en",
    );
    expect(container.textContent).toBe("0 minutes, over 3 visits");
  });

  it.each(LOCALES)("is not available for null in %s", (locale) => {
    const { container } = renderWithIntl(
      <AverageMinutes value={null} visits={0} />,
      locale,
    );
    expect(container.textContent).toContain(notAvailable[locale]);
    expect(container.textContent).not.toMatch(/minute|دقيقة|دقائق/);
  });

  it("names one visit in Arabic in words", () => {
    const { container } = renderWithIntl(
      <AverageMinutes value={5} visits={1} />,
      "ar",
    );
    expect(container.textContent).toContain("زيارة واحدة");
    expect(container.textContent).toContain("5");
  });
});

describe("SignedMoney", () => {
  it.each(LOCALES)("writes and says a negative amount in %s", (locale) => {
    const { container } = renderWithIntl(
      <SignedMoney value="-50.00" />,
      locale,
    );
    expect(container.textContent).toMatch(/-/);
    expect(container.textContent).toContain("50.00");
    expect(container.querySelector(".sr-only")?.textContent).toContain(
      messagesByLocale[locale].reports.negative,
    );
  });

  it("adds nothing to a positive amount", () => {
    const { container } = renderWithIntl(<SignedMoney value="50.00" />, "en");
    expect(container.querySelector(".sr-only")).toBeNull();
  });

  it("keeps an amount above a million exact", () => {
    const { container } = renderWithIntl(
      <SignedMoney value="1234567.89" />,
      "en",
    );
    expect(container.textContent).toContain("1,234,567.89");
  });
});

describe("NeedsAttention", () => {
  it("says so in words above zero, and shows nothing at zero", () => {
    const shown = renderWithIntl(<NeedsAttention count={2} />, "en");
    expect(shown.container.textContent).toBe(
      messagesByLocale.en.reports.needsAttention,
    );
    shown.unmount();

    const hidden = renderWithIntl(<NeedsAttention count={0} />, "en");
    expect(hidden.container.textContent).toBe("");
  });

  it("goes beside the count", () => {
    const { container } = renderWithIntl(
      <CountNeedingAttention value={3} />,
      "en",
    );
    expect(container.textContent).toBe(
      `3${messagesByLocale.en.reports.needsAttention}`,
    );
  });
});
