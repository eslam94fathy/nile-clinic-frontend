import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { aCharge, aVisit } from "../test-support";
import type { BillingFilters } from "../types";
import { BillingList } from "./billing-list";

const readVisits = vi.hoisted(() => vi.fn());
const chargeVisit = vi.hoisted(() => vi.fn());
vi.mock("../api/billing", () => ({ readVisits, chargeVisit }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/billing",
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));
vi.mock("@/features/patients/public", () => ({
  PatientLink: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { billing: t } = messagesByLocale.en;
/** The table keeps a copy for narrow screens, which isn't a table. */
const inTable = async () => within(await screen.findByRole("table"));
const meta = {
  current_page: 1,
  last_page: 1,
  per_page: 100,
  total: 1,
  from: 1,
  to: 1,
};
const page = (...visits: ReturnType<typeof aVisit>[]) => ({
  ok: true,
  status: 200,
  data: { data: visits, meta: { ...meta, total: visits.length } },
});
const TODAY: BillingFilters = {
  date: "2026-11-08",
  isToday: true,
  doctorId: null,
  chargeStatus: null,
  page: 1,
};

beforeEach(() => {
  readVisits.mockReset();
  chargeVisit.mockReset();
  router.push.mockReset();
  toast.success.mockReset();
});
afterEach(cleanup);

function setUp(filters: BillingFilters = TODAY) {
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 1 } },
  });
  renderWithIntl(
    <QueryClientProvider client={client}>
      <BillingList filters={filters} doctors={[]} timeZone="Africa/Cairo" />
    </QueryClientProvider>,
  );
}

describe("BillingList", () => {
  it("reads the date's visits with the filters, and lists them", async () => {
    readVisits.mockResolvedValue(page(aVisit()));
    setUp({ ...TODAY, doctorId: 3, chargeStatus: "none" });

    expect((await inTable()).getByText("Synthetic Patient")).toBeTruthy();
    expect(readVisits).toHaveBeenCalledWith(
      { date: "2026-11-08", doctorId: 3, chargeStatus: "none", page: 1 },
      "en",
    );
  });

  it("says nobody arrived on the date, offering today's queue", async () => {
    readVisits.mockResolvedValue(page());
    setUp();

    expect(await screen.findByText(t.empty.dateTitle)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.seeQueue })).toBeTruthy();
  });

  it("says nobody matches when narrowed, with no queue link", async () => {
    readVisits.mockResolvedValue(page());
    setUp({ ...TODAY, chargeStatus: "paid" });

    expect(await screen.findByText(t.empty.filteredTitle)).toBeTruthy();
    expect(screen.queryByRole("link", { name: t.seeQueue })).toBeNull();
  });

  it("offers to try again when the first read fails", async () => {
    readVisits.mockResolvedValue({
      ok: false,
      error: { status: 500, message: "Synthetic failure.", fieldErrors: {} },
    });
    setUp();

    expect(await screen.findByText("Synthetic failure.")).toBeTruthy();
  });

  it("charges with no amount, then opens the charge ready to pay", async () => {
    readVisits.mockResolvedValue(page(aVisit()));
    chargeVisit.mockResolvedValue({
      ok: true,
      status: 201,
      data: aCharge({ id: 77 }),
    });
    setUp();
    fireEvent.click(
      (await inTable()).getByRole("button", { name: t.charge.action }),
    );

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/charges/77?charged=1"),
    );
    expect(chargeVisit).toHaveBeenCalledWith(40, "en");
    expect(toast.success.mock.calls[0]?.[0]).toContain("350.00");
  });

  it("shows a refusal above the list naming the patient, and reads the list again", async () => {
    readVisits.mockResolvedValue(page(aVisit()));
    chargeVisit.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: { visit: ["This doctor has no fee yet."] },
      },
    });
    setUp();
    fireEvent.click(
      (await inTable()).getByRole("button", { name: t.charge.action }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      t.charge.refused.replace("{name}", "Synthetic Patient"),
    );
    expect(alert.textContent).toContain("This doctor has no fee yet.");
    await waitFor(() => expect(readVisits).toHaveBeenCalledTimes(2));
    expect(chargeVisit).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("says it may have been charged when no answer arrives, sending nothing more", async () => {
    readVisits.mockResolvedValue(page(aVisit()));
    chargeVisit.mockResolvedValue({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
    setUp();
    fireEvent.click(
      (await inTable()).getByRole("button", { name: t.charge.action }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      t.charge.unknownOutcome.replace("{name}", "Synthetic Patient"),
    );
    expect(chargeVisit).toHaveBeenCalledTimes(1);
  });

  it("sends one charge for repeated clicks", async () => {
    readVisits.mockResolvedValue(page(aVisit()));
    chargeVisit.mockReturnValue(new Promise(() => {}));
    setUp();
    const button = (await inTable()).getByRole("button", {
      name: t.charge.action,
    });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(chargeVisit).toHaveBeenCalledTimes(1);
  });

  it("stops and clears the list on a 403", async () => {
    readVisits.mockResolvedValue({
      ok: false,
      error: { status: 403, fieldErrors: {} },
    });
    setUp();

    expect(
      await screen.findByText(
        messagesByLocale.en.shared.states.forbiddenHeading,
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Synthetic Patient")).toBeNull();
  });
});
