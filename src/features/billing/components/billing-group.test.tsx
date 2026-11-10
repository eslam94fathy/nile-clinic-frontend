import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { aVisit } from "../test-support";
import type { VisitCharge } from "../types";
import { BillingGroup } from "./billing-group";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));
vi.mock("@/features/patients/public", () => ({
  PatientLink: ({ id, children }: { id: number; children: ReactNode }) => (
    <a data-patient-link={id}>{children}</a>
  ),
}));

afterEach(cleanup);

const { billing: t, shared } = messagesByLocale.en;
/** The table keeps a copy for narrow screens, which isn't a table. */
const table = () => within(screen.getByRole("table"));

function setUp(rows: VisitCharge[], charging: number | null = null) {
  const onCharge = vi.fn();
  const [first] = rows;
  renderWithIntl(
    <BillingGroup
      group={{ doctor: first?.doctor ?? aVisit().doctor, rows }}
      charging={charging}
      onCharge={onCharge}
    />,
  );
  return onCharge;
}

describe("BillingGroup", () => {
  it("heads the rows with the doctor, and names the table", () => {
    setUp([aVisit()]);

    expect(
      screen.getByRole("table", {
        name: t.caption.replace("{doctor}", "Synthetic Doctor"),
      }),
    ).toBeTruthy();
  });

  it("gives the patient, visit, and charge status, with no balance before a charge", () => {
    setUp([aVisit({ walk_in: true })]);

    const row = screen.getAllByRole("row")[1];
    if (!row) throw new Error("No row.");
    expect(within(row).getByText("Synthetic Patient")).toBeTruthy();
    expect(within(row).getByText("01000000001")).toBeTruthy();
    expect(within(row).getByText(shared.status.queue.seen)).toBeTruthy();
    expect(within(row).getByText(t.walkIn)).toBeTruthy();
    expect(within(row).getByText(shared.status.charge.none)).toBeTruthy();
    expect(within(row).getByText(shared.noValue)).toBeTruthy();
  });

  it("links the patient only through the link that records a click", () => {
    setUp([aVisit()]);

    expect(
      table().getByText("Synthetic Patient").closest("a")?.dataset.patientLink,
    ).toBe("12");
  });

  it("offers Charge visit only without an active charge, and calls back with the visit", () => {
    const onCharge = setUp([aVisit()]);

    fireEvent.click(table().getByRole("button", { name: t.charge.action }));
    expect(onCharge).toHaveBeenCalledWith(expect.objectContaining({ id: 40 }));
  });

  it("links a charged visit to its charge, with its balance, never prefetched", () => {
    setUp([
      aVisit({
        charge_status: "partially_paid",
        charge_id: 9,
        balance: "150.00",
      }),
    ]);

    const link = table().getByRole("link", { name: t.viewCharge });
    expect(link.getAttribute("href")).toBe("/charges/9");
    expect(link.dataset.prefetch).toBe("false");
    expect(table().getByText(/150\.00/)).toBeTruthy();
    expect(table().queryByRole("button", { name: t.charge.action })).toBeNull();
  });

  it("says which visit is being charged, and lets no other be charged meanwhile", () => {
    setUp([aVisit({ id: 40 }), aVisit({ id: 41 })], 40);

    expect(
      table().getByRole("button", { name: t.charge.working }),
    ).toHaveProperty("disabled", true);
    expect(
      table().getByRole("button", { name: t.charge.action }),
    ).toHaveProperty("disabled", true);
  });
});
