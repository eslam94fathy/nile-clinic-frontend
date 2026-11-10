import { cleanup, fireEvent, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { MoneyByDayChart } from "./money-by-day-chart";

afterEach(cleanup);

/** `Intl` puts a no-break space inside an amount. */
const plain = (text: string | null | undefined) =>
  (text ?? "").replace(/\s/g, " ");

const day = (date: string, net: string) => ({
  date,
  net,
  received: "0.00",
  refunded: "0.00",
});
const BY_DAY = [day("2026-11-02", "350.00"), day("2026-11-03", "-100.00")];

function columnsOf(chart: HTMLElement) {
  return [...chart.querySelectorAll<HTMLElement>("[title]")];
}

describe("MoneyByDayChart", () => {
  it("is one labelled image, with the table named as the way to read it", () => {
    renderWithIntl(
      <MoneyByDayChart from="2026-11-01" to="2026-11-03" byDay={BY_DAY} />,
    );
    const chart = screen.getByRole("img");
    expect(chart.getAttribute("aria-label")).toBe(
      "Net money by day, from 2026-11-01 to 2026-11-03. The same figures are in the table below.",
    );
  });

  it("has a column for every day, the first at the start", () => {
    renderWithIntl(
      <MoneyByDayChart from="2026-11-01" to="2026-11-03" byDay={BY_DAY} />,
    );
    const titles = columnsOf(screen.getByRole("img")).map((column) =>
      plain(column.getAttribute("title")),
    );
    expect(titles).toEqual([
      `2026-11-01: ${messagesByLocale.en.reports.money.noMovement}`,
      "2026-11-02: EGP 350.00",
      "2026-11-03: -EGP 100.00",
    ]);
  });

  it("sizes columns on their own side, with negatives hatched below the line", () => {
    renderWithIntl(
      <MoneyByDayChart from="2026-11-01" to="2026-11-03" byDay={BY_DAY} />,
    );
    const chart = screen.getByRole("img");
    const positive = chart.querySelector<HTMLElement>(".bg-chart-positive");
    const negative = chart.querySelector<HTMLElement>(".border-chart-negative");
    expect(positive?.style.height).toBe("100%");
    expect(negative?.style.height).toBe("100%");
    expect(negative?.className).toContain("repeating-linear-gradient");
  });

  it("labels its scale with the API's own amounts", () => {
    renderWithIntl(
      <MoneyByDayChart from="2026-11-01" to="2026-11-03" byDay={BY_DAY} />,
    );
    const text = plain(screen.getByRole("img").textContent);
    expect(text).toContain("EGP 350.00");
    expect(text).toContain("-EGP 100.00");
  });

  it("shows the hovered day's figure", () => {
    renderWithIntl(
      <MoneyByDayChart from="2026-11-01" to="2026-11-03" byDay={BY_DAY} />,
    );
    const [, second] = columnsOf(screen.getByRole("img"));
    fireEvent.pointerEnter(second as HTMLElement);
    expect(plain(screen.getByRole("img").textContent)).toContain(
      "2026-11-02: EGP 350.00",
    );
  });

  it("keeps the highlight on the hovered day when the period changes", () => {
    const { rerender } = renderWithIntl(
      <MoneyByDayChart from="2026-11-01" to="2026-11-03" byDay={BY_DAY} />,
    );
    const [, second] = columnsOf(screen.getByRole("img"));
    fireEvent.pointerEnter(second as HTMLElement);
    rerender(
      <NextIntlClientProvider
        locale="en"
        messages={messagesByLocale.en}
        timeZone="Africa/Cairo"
      >
        <MoneyByDayChart from="2026-10-31" to="2026-11-03" byDay={BY_DAY} />
      </NextIntlClientProvider>,
    );
    expect(plain(screen.getByRole("img").textContent)).toContain(
      "2026-11-02: EGP 350.00",
    );
  });

  it("draws nothing when there's nothing to draw", () => {
    const { container } = renderWithIntl(
      <MoneyByDayChart
        from="2026-11-01"
        to="2026-11-03"
        byDay={[day("2026-11-02", "0.00")]}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("holds a year of columns", () => {
    renderWithIntl(
      <MoneyByDayChart
        from="2028-01-01"
        to="2028-12-31"
        byDay={[day("2028-06-01", "10.00")]}
      />,
    );
    const columns = columnsOf(screen.getByRole("img"));
    expect(columns).toHaveLength(366);
    // Gaps don't shrink, so a year has none, and fits a phone.
    expect(columns[0]?.parentElement?.style.columnGap).toBe("0px");
  });
});
