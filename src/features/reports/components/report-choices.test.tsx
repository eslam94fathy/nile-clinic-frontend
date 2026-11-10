import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { aChoices } from "../test-support";
import { ReportChoices } from "./report-choices";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/reports/billing",
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);
const t = messagesByLocale.en.reports;

describe("ReportChoices", () => {
  it("offers the period and every doctor, labelling inactive ones", () => {
    renderWithIntl(<ReportChoices {...aChoices("billing")} />);

    expect(
      (screen.getByLabelText(t.choices.from) as HTMLInputElement).value,
    ).toBe("2026-11-01");
    expect(
      (screen.getByLabelText(t.choices.to) as HTMLInputElement).value,
    ).toBe("2026-11-08");
    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual([
      t.choices.allDoctors,
      "Synthetic Doctor",
      "Synthetic Retired (inactive)",
    ]);
  });

  it("offers the shortcuts as links that set both dates, keep the doctor, and drop the page", () => {
    renderWithIntl(
      <ReportChoices {...aChoices("billing", { doctorId: 3, page: 4 })} />,
    );

    const lastMonth = screen.getByRole("link", {
      name: t.choices.shortcuts.lastMonth,
    });
    expect(lastMonth.getAttribute("href")).toBe(
      "/reports/billing?from=2026-10-01&to=2026-10-31&doctor_id=3",
    );
    expect(
      screen
        .getByRole("link", { name: t.choices.shortcuts.thisMonth })
        .getAttribute("aria-current"),
    ).toBe("true");
    expect(lastMonth.getAttribute("aria-current")).toBeNull();
  });

  it.each([
    ["missing_from", t.choices.from, t.range.missingFrom],
    ["missing_to", t.choices.to, t.range.missingTo],
    ["reversed", t.choices.to, t.range.reversed],
    ["too_long", t.choices.to, t.range.tooLong],
  ] as const)(
    "shows %s on the date it concerns",
    (rangeProblem, field, message) => {
      renderWithIntl(
        <ReportChoices
          {...aChoices("times", { rangeProblem, isDefaultPeriod: false })}
        />,
      );
      const input = screen.getByLabelText(field);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(document.body.textContent).toContain(message);
    },
  );

  it("fills the dates with the default period, but leaves a missing date empty beside its error", () => {
    renderWithIntl(<ReportChoices {...aChoices("times")} />);
    expect(
      (screen.getByLabelText(t.choices.to) as HTMLInputElement).value,
    ).toBe("2026-11-08");
    cleanup();

    renderWithIntl(
      <ReportChoices
        {...aChoices("times", {
          rangeProblem: "missing_to",
          isDefaultPeriod: false,
        })}
      />,
    );
    expect(
      (screen.getByLabelText(t.choices.to) as HTMLInputElement).value,
    ).toBe("");
  });

  it("shows the API's refusal on its field, and anything else for the form", () => {
    renderWithIntl(
      <ReportChoices
        {...aChoices("times")}
        refusal={{
          status: 422,
          message: "Refused.",
          fieldErrors: {
            to: ["Synthetic refusal on the last date."],
            page: ["Synthetic refusal on the page."],
          },
        }}
      />,
    );
    expect(
      screen.getByLabelText(t.choices.to).getAttribute("aria-invalid"),
    ).toBe("true");
    expect(
      screen
        .getAllByRole("alert")
        .some((alert) =>
          alert.textContent?.includes("Synthetic refusal on the page."),
        ),
    ).toBe(true);
  });

  it("works without the doctors, keeping a chosen one", () => {
    renderWithIntl(
      <ReportChoices
        {...aChoices("billing", { doctorId: 9 }, { doctors: null })}
      />,
    );
    expect(document.body.textContent).toContain(t.choices.doctorsUnavailable);
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
});
