import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { THIS_MONTH } from "../test-support";
import { ReportTabs } from "./report-tabs";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));

afterEach(cleanup);
const tabs = messagesByLocale.en.reports.tabs;

describe("ReportTabs", () => {
  it("lists the four reports in order, marking the current one", () => {
    renderWithIntl(<ReportTabs current="billing" filters={THIS_MONTH} />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      tabs["money-collected"],
      tabs.billing,
      tabs.activity,
      tabs.times,
    ]);
    expect(
      screen
        .getByRole("link", { name: tabs.billing })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: tabs.times })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("calls the billing report Charges by doctor", () => {
    expect(tabs.billing).toBe("Charges by doctor");
  });

  it("leaves the default period out of the address, so it keeps moving", () => {
    renderWithIntl(
      <ReportTabs current="billing" filters={{ ...THIS_MONTH, page: 3 }} />,
    );
    expect(
      screen.getByRole("link", { name: tabs.times }).getAttribute("href"),
    ).toBe("/reports/times");
  });

  it("carries a chosen period and doctor, and never the page", () => {
    renderWithIntl(
      <ReportTabs
        current="billing"
        filters={{
          ...THIS_MONTH,
          from: "2026-10-01",
          to: "2026-10-31",
          doctorId: 3,
          page: 2,
          isDefaultPeriod: false,
        }}
      />,
    );
    expect(
      screen.getByRole("link", { name: tabs.activity }).getAttribute("href"),
    ).toBe("/reports/activity?from=2026-10-01&to=2026-10-31&doctor_id=3");
  });

  it("carries only the date given when the other is missing, rather than choosing one day", () => {
    renderWithIntl(
      <ReportTabs
        current="billing"
        filters={{
          ...THIS_MONTH,
          from: "2026-11-05",
          to: "2026-11-05",
          rangeProblem: "missing_to",
          isDefaultPeriod: false,
        }}
      />,
    );
    expect(
      screen.getByRole("link", { name: tabs.activity }).getAttribute("href"),
    ).toBe("/reports/activity?from=2026-11-05");
  });

  it("follows the language", () => {
    renderWithIntl(<ReportTabs current="times" filters={THIS_MONTH} />, "ar");
    expect(
      screen.getByRole("link", {
        name: messagesByLocale.ar.reports.tabs.billing,
      }),
    ).toBeTruthy();
  });
});
