import { cleanup, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { aCharge } from "../test-support";
import { ChargeView } from "./charge-view";

vi.mock("@/features/patients/public", () => ({
  PatientLink: ({ id, children }: { id: number; children: ReactNode }) => (
    <a data-patient-link={id}>{children}</a>
  ),
}));

afterEach(cleanup);

const { charges, shared } = messagesByLocale.en;
const t = charges.details;
const TZ = "Africa/Cairo";

const full = aCharge({
  status: "partially_paid",
  discount: "50.00",
  amount_due: "300.00",
  amount_paid: "150.00",
  balance: "150.00",
  discount_reason: "Synthetic hardship discount",
  discounted_by: { id: 1, name: "Synthetic Admin" },
  discounted_at: "2026-11-08T08:05:00.000000Z",
  payments: [
    {
      id: 1,
      amount: "100.00",
      method: "cash",
      received_by: { id: 2, name: "Synthetic Reception" },
      received_at: "2026-11-08T08:10:00.000000Z",
    },
    {
      id: 2,
      amount: "100.00",
      method: "card",
      received_by: { id: 2, name: "Synthetic Reception" },
      received_at: "2026-11-08T08:20:00.000000Z",
    },
  ],
  refunds: [
    {
      id: 3,
      amount: "50.00",
      method: "wallet",
      reason: "Synthetic overpayment",
      refunded_by: { id: 1, name: "Synthetic Admin" },
      refunded_at: "2026-11-08T08:30:00.000000Z",
    },
  ],
});

const valueOf = (label: string) =>
  screen.getByText(label, { selector: "dt" }).nextElementSibling;

describe("ChargeView", () => {
  it("gives every fact and amount exactly as the API sent it", () => {
    renderWithIntl(<ChargeView charge={full} timeZone={TZ} />);

    expect(valueOf(t.status)?.textContent).toBe(
      shared.status.charge.partially_paid,
    );
    expect(valueOf(t.date)?.textContent).toBe("2026-11-08");
    expect(valueOf(t.patientNumber)?.textContent).toBe("12");
    expect(valueOf(t.phone)?.textContent).toBe("01000000001");
    expect(valueOf(t.chargedBy)?.textContent).toBe("Synthetic Reception");
    for (const [label, amount] of [
      [t.fee, "350.00"],
      [t.discount, "50.00"],
      [t.amountDue, "300.00"],
      [t.amountPaid, "150.00"],
      [t.balance, "150.00"],
    ] as const) {
      expect(valueOf(label)?.textContent).toContain(amount);
    }
  });

  it("links the patient only through the link that records a click", () => {
    renderWithIntl(<ChargeView charge={full} timeZone={TZ} />);

    const link = screen.getByText("Synthetic Patient").closest("a");
    expect(link?.getAttribute("data-patient-link")).toBe("12");
  });

  it("keeps the fee beside the discount, with its reason, who, and when", () => {
    renderWithIntl(<ChargeView charge={full} timeZone={TZ} />);

    expect(valueOf(t.discountReason)?.textContent).toBe(
      "Synthetic hardship discount",
    );
    expect(valueOf(t.discountedBy)?.textContent).toBe("Synthetic Admin");
    expect(valueOf(t.fee)?.textContent).toContain("350.00");
  });

  it("lists payments, then refunds with their reasons, in the API's order", () => {
    renderWithIntl(<ChargeView charge={full} timeZone={TZ} />);

    const payments = screen.getByRole("table", { name: t.paymentsCaption });
    const rows = within(payments).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining(shared.paymentMethod.cash),
      expect.stringContaining(shared.paymentMethod.card),
    ]);

    const refunds = screen.getByRole("table", { name: t.refundsCaption });
    expect(within(refunds).getByText("Synthetic overpayment")).toBeTruthy();
    expect(within(refunds).getByText(shared.paymentMethod.wallet)).toBeTruthy();
  });

  it("says when there are no payments or refunds, and shows no discount details without one", () => {
    renderWithIntl(<ChargeView charge={aCharge()} timeZone={TZ} />);

    expect(screen.getByText(t.noPayments)).toBeTruthy();
    expect(screen.getByText(t.noRefunds)).toBeTruthy();
    expect(screen.queryByText(t.discountReason)).toBeNull();
  });

  it("says a charge is cancelled, with its reason, and that its visit is gone", () => {
    renderWithIntl(
      <ChargeView
        charge={aCharge({
          status: "cancelled",
          visit_id: null,
          cancel_reason: "Synthetic mistaken charge",
          cancelled_by: { id: 2, name: "Synthetic Reception" },
          cancelled_at: "2026-11-08T09:00:00.000000Z",
        })}
        timeZone={TZ}
      />,
    );

    const note = screen.getByRole("note");
    expect(within(note).getByText(t.cancelledTitle)).toBeTruthy();
    expect(within(note).getByText("Synthetic mistaken charge")).toBeTruthy();
    expect(within(note).getByText(t.visitGone)).toBeTruthy();
  });

  it("says nothing about a missing visit while it exists", () => {
    renderWithIntl(
      <ChargeView
        charge={aCharge({
          status: "cancelled",
          cancel_reason: "Synthetic mistaken charge",
        })}
        timeZone={TZ}
      />,
    );

    expect(screen.queryByText(t.visitGone)).toBeNull();
  });

  it("puts what the person may do above the payments", () => {
    renderWithIntl(
      <ChargeView
        charge={aCharge()}
        timeZone={TZ}
        actions={<p>Synthetic actions</p>}
      />,
    );

    const actions = screen.getByText("Synthetic actions");
    const payments = screen.getByText(t.paymentsHeading);
    expect(
      actions.compareDocumentPosition(payments) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("works in Arabic, with the same amounts", () => {
    renderWithIntl(<ChargeView charge={full} timeZone={TZ} />, "ar");

    const ar = messagesByLocale.ar.charges.details;
    expect(
      screen.getByText(ar.balance, { selector: "dt" }).nextElementSibling
        ?.textContent,
    ).toContain("150.00");
  });
});
