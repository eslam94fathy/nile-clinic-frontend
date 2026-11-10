import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { aChoices, aMoneyCollected } from "../test-support";
import type { ReportFilters } from "../types";
import { ReportView } from "./report-view";

const readMoneyCollected = vi.hoisted(() => vi.fn());
vi.mock("../api/reports", () => ({ readMoneyCollected }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/reports/money-collected",
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

const { reports: t } = messagesByLocale.en;
const ok = (data: unknown) => ({ ok: true, status: 200, data });
const failed = (status: number, fieldErrors = {}) => ({
  ok: false,
  error: { status, fieldErrors },
});

beforeEach(() => readMoneyCollected.mockReset());
afterEach(cleanup);

/** `Intl` puts a no-break space inside an amount. */
const plain = (text: string | null | undefined) =>
  (text ?? "").replace(/\s/g, " ");

function setUp(
  filters: Partial<ReportFilters> = {},
  locale: "en" | "ar" = "en",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 1 } },
  });
  return renderWithIntl(
    <QueryClientProvider client={client}>
      <ReportView
        choices={aChoices("money-collected", filters)}
        timeZone="Africa/Cairo"
      />
    </QueryClientProvider>,
    locale,
  );
}

describe("MoneyCollectedReport", () => {
  it("reads the period once, and shows the totals exactly as sent", async () => {
    readMoneyCollected.mockResolvedValue(ok(aMoneyCollected()));
    setUp();

    const totals = await screen.findByRole("heading", {
      name: t.money.totals,
    });
    const figures = within(totals.closest("section") ?? document.body);
    expect(figures.getByText("EGP 1,234,567.89")).toBeTruthy();
    expect(readMoneyCollected).toHaveBeenCalledTimes(1);
    expect(readMoneyCollected).toHaveBeenCalledWith(
      { from: "2026-11-01", to: "2026-11-08", doctorId: null },
      "en",
    );
  });

  it("marks a negative net in words as well as its sign", async () => {
    readMoneyCollected.mockResolvedValue(ok(aMoneyCollected()));
    setUp();

    await screen.findAllByRole("table");
    const negatives = document.querySelectorAll(".sr-only");
    expect(
      [...negatives].some((node) => node.textContent?.includes(t.negative)),
    ).toBe(true);
    expect(plain(document.body.textContent)).toContain("-EGP 400.00");
  });

  it("shows the chart, labelled, and the same days in a table", async () => {
    readMoneyCollected.mockResolvedValue(ok(aMoneyCollected()));
    setUp();

    const chart = await screen.findByRole("img");
    expect(chart.getAttribute("aria-label")).toContain("2026-11-01");
    const [byDay] = screen.getAllByRole("table");
    expect(within(byDay as HTMLElement).getAllByRole("row")).toHaveLength(3);
  });

  it("shows each method with its staff, translated", async () => {
    readMoneyCollected.mockResolvedValue(ok(aMoneyCollected()));
    setUp();

    expect(
      await screen.findByRole("heading", {
        name: messagesByLocale.en.shared.paymentMethod.cash,
      }),
    ).toBeTruthy();
    expect(screen.getAllByText("Synthetic Reception").length).toBeGreaterThan(
      0,
    );
  });

  it("says only the doctor's charges count when one is chosen", async () => {
    readMoneyCollected.mockResolvedValue(ok(aMoneyCollected()));
    setUp({ doctorId: 3 });

    expect(await screen.findByText(t.money.doctorNote)).toBeTruthy();
    expect(readMoneyCollected).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: 3 }),
      "en",
    );
  });

  it("shows zero totals, then the empty state, for a period with no money", async () => {
    readMoneyCollected.mockResolvedValue(
      ok(
        aMoneyCollected({
          totals: { received: "0.00", refunded: "0.00", net: "0.00" },
          by_method: [],
          by_day: [],
        }),
      ),
    );
    setUp();

    expect(await screen.findByText(t.money.emptyTitle)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the table without a chart when every day nets to zero", async () => {
    readMoneyCollected.mockResolvedValue(
      ok(
        aMoneyCollected({
          by_day: [
            {
              date: "2026-11-02",
              received: "100.00",
              refunded: "100.00",
              net: "0.00",
            },
          ],
        }),
      ),
    );
    setUp();

    expect(await screen.findByText(t.money.noNetChange)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getAllByRole("table").length).toBeGreaterThan(0);
  });

  it("reads nothing while the period has a problem", () => {
    setUp({ rangeProblem: "too_long", isDefaultPeriod: false });

    expect(document.body.textContent).toContain(t.range.tooLong);
    expect(readMoneyCollected).not.toHaveBeenCalled();
  });

  it("says when it was read, and reads again only on Refresh", async () => {
    readMoneyCollected.mockResolvedValue(ok(aMoneyCollected()));
    setUp();
    await screen.findByRole("img");

    fireEvent.click(
      screen.getByRole("button", {
        name: messagesByLocale.en.shared.lastRead.refresh,
      }),
    );
    await waitFor(() => expect(readMoneyCollected).toHaveBeenCalledTimes(2));
    expect(document.body.textContent).toContain(
      messagesByLocale.en.shared.lastRead.label,
    );
  });

  it("keeps the figures when a reread fails, with a notice", async () => {
    readMoneyCollected.mockResolvedValueOnce(ok(aMoneyCollected()));
    readMoneyCollected.mockResolvedValue(failed(422));
    setUp();
    await screen.findByRole("img");

    fireEvent.click(
      screen.getByRole("button", {
        name: messagesByLocale.en.shared.lastRead.refresh,
      }),
    );
    expect(
      await screen.findByText(
        messagesByLocale.en.shared.lastRead.outOfDateOnDemand,
      ),
    ).toBeTruthy();
    expect(screen.getByRole("img")).toBeTruthy();
  });

  it("offers to try again when the first read fails", async () => {
    // A read with no answer is retried once by itself, as the policy allows, before the failure shows.
    readMoneyCollected
      .mockResolvedValueOnce(failed(0))
      .mockResolvedValueOnce(failed(0))
      .mockResolvedValue(ok(aMoneyCollected()));
    setUp();

    expect(await screen.findByText(t.readFailed)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: messagesByLocale.en.shared.states.retry,
      }),
    );
    expect(await screen.findByRole("img")).toBeTruthy();
  });

  it("says an unknown doctor wasn't found, with a way back to all doctors", async () => {
    readMoneyCollected.mockResolvedValue(failed(404));
    setUp({
      doctorId: 99,
      from: "2026-10-01",
      to: "2026-10-31",
      isDefaultPeriod: false,
    });

    expect(await screen.findByText(t.doctorNotFound)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: t.showAllDoctors }).getAttribute("href"),
    ).toBe("/reports/money-collected?from=2026-10-01&to=2026-10-31");
  });

  it("shows the forbidden state on a 403, and none of the figures", async () => {
    readMoneyCollected.mockResolvedValue(failed(403));
    setUp();

    expect(
      await screen.findByText(
        messagesByLocale.en.shared.states.forbiddenHeading,
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText(t.choices.from)).toBeNull();
  });

  it("puts the API's refusal on the date", async () => {
    readMoneyCollected.mockResolvedValue(
      failed(422, { to: ["Synthetic refusal on the last date."] }),
    );
    setUp();

    expect(
      await screen.findByText("Synthetic refusal on the last date."),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(t.choices.to).getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("works in Arabic", async () => {
    readMoneyCollected.mockResolvedValue(ok(aMoneyCollected()));
    setUp({}, "ar");

    expect(
      await screen.findByRole("heading", {
        name: messagesByLocale.ar.reports.money.totals,
      }),
    ).toBeTruthy();
    expect(document.body.textContent).toContain("1,234,567.89");
  });
});
