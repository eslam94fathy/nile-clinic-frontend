import { act, cleanup, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/permissions";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { aCharge } from "../test-support";
import type { Charge } from "../types";
import { ChargeActions } from "./charge-actions";

const role = vi.hoisted(() => ({ value: "receptionist" as Role | null }));
vi.mock("@/features/auth/public", () => ({
  useRole: () => role.value,
  useHydrated: () => true,
}));
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router }));

// Each action is tested on its own. Here, only which are offered, and the notice they share.
const handlers = vi.hoisted(() => ({
  unknown: undefined as (() => void) | undefined,
  succeeded: undefined as (() => void) | undefined,
  refused: {} as Record<string, (messages: string[]) => void>,
}));
function stub(name: string) {
  function Stub({
    onOutcomeUnknown,
    onSucceeded,
    onRefused,
  }: {
    onOutcomeUnknown: () => void;
    onSucceeded: () => void;
    onRefused: (messages: string[]) => void;
  }): ReactNode {
    handlers.unknown = onOutcomeUnknown;
    handlers.succeeded = onSucceeded;
    handlers.refused[name] = onRefused;
    return <p>{name}</p>;
  }
  return Stub;
}
vi.mock("./payment-form", () => ({ PaymentForm: stub("payment") }));
vi.mock("./refund-form", () => ({ RefundForm: stub("refund") }));
vi.mock("./discount-form", () => ({ DiscountForm: stub("discount") }));
vi.mock("./cancel-charge", () => ({ CancelCharge: stub("cancel") }));

const { charges } = messagesByLocale.en;

beforeEach(() => {
  router.refresh.mockReset();
  role.value = "receptionist";
});
afterEach(cleanup);

const offeredNames = () =>
  ["payment", "refund", "discount", "cancel"].filter((name) =>
    screen.queryByText(name),
  );

function setUp(charge: Charge, justCharged = false) {
  return renderWithIntl(
    <ChargeActions charge={charge} justCharged={justCharged} />,
  );
}

describe("ChargeActions", () => {
  it("offers a receptionist payment and cancelling on an unpaid charge", () => {
    setUp(aCharge());
    expect(offeredNames()).toEqual(["payment", "cancel"]);
  });

  it("offers an administrator refunds and discounts too, as money allows", () => {
    role.value = "administrator";
    setUp(
      aCharge({
        status: "partially_paid",
        amount_paid: "100.00",
        balance: "250.00",
      }),
    );
    expect(offeredNames()).toEqual(["payment", "refund", "discount"]);
  });

  it("says nothing more can be done when nothing is offered", () => {
    setUp(aCharge({ status: "paid", amount_paid: "350.00", balance: "0.00" }));
    expect(offeredNames()).toEqual([]);
    expect(screen.getByText(charges.details.nothingOffered)).toBeTruthy();
  });

  it("offers nothing, and says nothing extra, on a cancelled charge", () => {
    role.value = "administrator";
    setUp(aCharge({ status: "cancelled" }));
    expect(offeredNames()).toEqual([]);
    expect(screen.queryByText(charges.details.nothingOffered)).toBeNull();
  });

  it("shows the unknown-outcome notice when an action reports one, and clears it on a success", () => {
    setUp(aCharge());
    expect(screen.queryByText(charges.outcomeUnknown)).toBeNull();

    act(() => handlers.unknown?.());
    expect(screen.getByRole("status").textContent).toBe(charges.outcomeUnknown);

    act(() => handlers.succeeded?.());
    expect(screen.queryByText(charges.outcomeUnknown)).toBeNull();
  });

  it("keeps a refusal when the refresh it caused removed that form, and not otherwise", () => {
    const { rerender } = renderWithIntl(
      <ChargeActions charge={aCharge()} justCharged={false} />,
    );
    act(() =>
      handlers.refused.payment?.(["Synthetic: more than the balance."]),
    );
    // The form is still offered, and shows the refusal itself.
    expect(screen.queryByText("Synthetic: more than the balance.")).toBeNull();

    // Someone else paid the rest, so the page now offers no payment.
    rerender(
      <NextIntlClientProvider
        locale="en"
        messages={messagesByLocale.en}
        timeZone="Africa/Cairo"
      >
        <ChargeActions
          charge={aCharge({
            status: "paid",
            amount_paid: "350.00",
            balance: "0.00",
          })}
          justCharged={false}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Synthetic: more than the balance.")).toBeTruthy();
  });

  it("removes the just-charged flag from the address without reading the charge again", () => {
    window.history.replaceState(null, "", "/en/charges/9?charged=1");
    const replace = vi.spyOn(window.history, "replaceState");
    setUp(aCharge(), true);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(window.location.pathname + window.location.search).toBe(
      "/en/charges/9",
    );
    expect(router.refresh).not.toHaveBeenCalled();
    replace.mockRestore();
  });

  it("leaves the address alone otherwise", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    setUp(aCharge());

    expect(replace).not.toHaveBeenCalled();
    replace.mockRestore();
  });
});
