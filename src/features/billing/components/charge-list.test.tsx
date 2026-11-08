import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { aCharge } from "../test-support";
import type { ChargeFilters } from "../types";
import { ChargeList } from "./charge-list";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/charges",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/patients/public", () => ({
  PatientLink: ({ id, children }: { id: number; children: ReactNode }) => (
    <a data-patient-link={id}>{children}</a>
  ),
}));

afterEach(cleanup);

const { charges: t } = messagesByLocale.en;
const meta = {
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: 1,
  from: 1,
  to: 1,
};
const FILTERS: ChargeFilters = {
  from: "2026-11-02",
  to: "2026-11-08",
  patientId: null,
  doctorId: null,
  status: null,
  page: 1,
  rangeProblem: null,
  patientProblem: false,
};
const found = (rows: ReturnType<typeof aCharge>[]) => ({
  ok: true as const,
  status: 200,
  data: { data: rows, meta: { ...meta, total: rows.length } },
});
const table = () => within(screen.getByRole("table", { name: t.caption }));

describe("ChargeList", () => {
  it("gives each charge's facts and amounts as sent, and no reason", () => {
    renderWithIntl(
      <ChargeList
        result={found([
          aCharge({
            discount: "50.00",
            amount_due: "300.00",
            discount_reason: "Synthetic hardship discount",
          }),
        ])}
        filters={FILTERS}
        doctors={[]}
      />,
    );

    const rows = table().getAllByRole("row");
    const row = rows[1];
    if (!row) throw new Error("No row.");
    expect(within(row).getByText("2026-11-08")).toBeTruthy();
    expect(within(row).getByText("Synthetic Patient")).toBeTruthy();
    // Not the fee, 350.00, which also ends in these digits.
    expect(within(row).getByText(/(^|\D)50\.00/)).toBeTruthy();
    expect(within(row).getByText(/300\.00/)).toBeTruthy();
    expect(screen.queryByText("Synthetic hardship discount")).toBeNull();
  });

  it("links each charge, never prefetched", () => {
    renderWithIntl(
      <ChargeList result={found([aCharge()])} filters={FILTERS} doctors={[]} />,
    );

    const link = table().getByRole("link", { name: t.open });
    expect(link.getAttribute("href")).toBe("/charges/9");
    expect(link.dataset.prefetch).toBe("false");
  });

  it("says when no charges are in the range, or none match", () => {
    const { unmount } = renderWithIntl(
      <ChargeList result={found([])} filters={FILTERS} doctors={[]} />,
    );
    expect(screen.getByText(t.empty.rangeTitle)).toBeTruthy();
    unmount();

    renderWithIntl(
      <ChargeList
        result={found([])}
        filters={{ ...FILTERS, status: "unpaid" }}
        doctors={[]}
      />,
    );
    expect(screen.getByText(t.empty.filteredTitle)).toBeTruthy();
  });

  it.each([
    ["too_long", t.range.tooLong],
    ["reversed", t.range.reversed],
  ] as const)(
    "says why a %s range wasn't read, with no table",
    (problem, message) => {
      renderWithIntl(
        <ChargeList
          result={null}
          filters={{ ...FILTERS, rangeProblem: problem }}
          doctors={[]}
        />,
      );

      expect(screen.getByText(message)).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
    },
  );

  it("shows the API's refusal of the range with the filters", () => {
    renderWithIntl(
      <ChargeList
        result={{
          ok: false,
          error: {
            status: 422,
            fieldErrors: { to: ["The date range can be at most 92 days."] },
          },
        }}
        filters={FILTERS}
        doctors={[]}
      />,
    );

    expect(
      screen.getByText("The date range can be at most 92 days."),
    ).toBeTruthy();
  });

  it("shows the forbidden state on a 403", () => {
    renderWithIntl(
      <ChargeList
        result={{ ok: false, error: { status: 403, fieldErrors: {} } }}
        filters={FILTERS}
        doctors={[]}
      />,
    );

    expect(
      screen.getByText(messagesByLocale.en.shared.states.forbiddenHeading),
    ).toBeTruthy();
  });
});
