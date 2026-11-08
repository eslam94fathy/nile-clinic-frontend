import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { aCharge } from "../test-support";
import { PaymentForm } from "./payment-form";

const recordPayment = vi.hoisted(() => vi.fn());
vi.mock("../api/billing", () => ({ recordPayment }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/public", () => ({ useHydrated: () => true }));
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { charges, shared } = messagesByLocale.en;
const t = charges.payment;

const onSucceeded = vi.fn();
const onOutcomeUnknown = vi.fn();
const onRefused = vi.fn();

beforeEach(() => {
  recordPayment.mockReset();
  router.refresh.mockReset();
  toast.success.mockReset();
  onSucceeded.mockReset();
  onOutcomeUnknown.mockReset();
  onRefused.mockReset();
});
afterEach(cleanup);

function setUp(balance = "350.00") {
  renderWithIntl(
    <PaymentForm
      charge={aCharge({ balance })}
      onSucceeded={onSucceeded}
      onOutcomeUnknown={onOutcomeUnknown}
      onRefused={onRefused}
    />,
  );
}

const amountField = () =>
  screen.getByLabelText(t.amountLabel, { exact: false });
const chooseMethod = (method: keyof typeof shared.paymentMethod) =>
  fireEvent.click(screen.getByLabelText(shared.paymentMethod[method]));
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: t.submit }));
const dialog = () => screen.findByRole("alertdialog");
const confirm = async () =>
  fireEvent.click(
    within(await dialog()).getByRole("button", { name: t.confirm }),
  );

describe("PaymentForm", () => {
  it("starts with the whole balance and no method chosen", () => {
    setUp("150.50");

    expect(amountField()).toHaveProperty("value", "150.50");
    for (const method of ["cash", "card", "wallet"] as const) {
      expect(
        screen.getByLabelText(shared.paymentMethod[method]),
      ).toHaveProperty("checked", false);
    }
  });

  it("asks for a method, and sends nothing without one", async () => {
    setUp();
    submit();

    expect(await screen.findByText(t.methodRule)).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it("stops an amount above the balance before anything is sent", async () => {
    setUp("100.00");
    fireEvent.change(amountField(), { target: { value: "100.01" } });
    chooseMethod("cash");
    submit();

    expect(await screen.findByText(t.aboveBalance)).toBeTruthy();
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it("confirms the patient, amount, and method, saying it can't be edited", async () => {
    setUp();
    fireEvent.change(amountField(), { target: { value: "150.5" } });
    chooseMethod("card");
    submit();

    const text = (await dialog()).textContent ?? "";
    expect(text).toContain("Synthetic Patient");
    expect(text).toContain("150.50");
    expect(text).toContain(charges.methodPhrase.card);
    expect(text).toContain("can't be edited or removed");
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it("sends the amount as text, once, however often confirm is pressed", async () => {
    recordPayment.mockReturnValue(new Promise(() => {}));
    setUp();
    fireEvent.change(amountField(), { target: { value: "١٠٠" } });
    chooseMethod("wallet");
    submit();
    await confirm();
    // While it's sent, the same button says it's working, and pressing it again sends nothing.
    fireEvent.click(
      within(await dialog()).getByRole("button", {
        name: shared.confirm.working,
      }),
    );

    expect(recordPayment).toHaveBeenCalledTimes(1);
    expect(recordPayment).toHaveBeenCalledWith(
      9,
      { amount: "100", method: "wallet" },
      "en",
    );
  });

  it("says what was recorded, resets to the new balance, and reads the page again", async () => {
    recordPayment.mockResolvedValue({
      ok: true,
      status: 201,
      data: aCharge({ balance: "250.00", status: "partially_paid" }),
    });
    setUp();
    fireEvent.change(amountField(), { target: { value: "100" } });
    chooseMethod("cash");
    submit();
    await confirm();

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(toast.success.mock.calls[0]?.[0]).toContain("100.00");
    expect(toast.success.mock.calls[0]?.[0]).toContain(
      charges.methodPhrase.cash,
    );
    expect(amountField()).toHaveProperty("value", "250.00");
    expect(onSucceeded).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("puts a refusal on its field, and reads the charge again", async () => {
    recordPayment.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        message: "Synthetic refusal.",
        fieldErrors: { amount: ["The amount is more than the balance."] },
      },
    });
    setUp();
    chooseMethod("cash");
    submit();
    await confirm();

    expect(
      await screen.findByText("The amount is more than the balance."),
    ).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(onOutcomeUnknown).not.toHaveBeenCalled();
    // Kept by the page too, in case the refresh removes this form.
    expect(onRefused).toHaveBeenCalledWith([
      "The amount is more than the balance.",
    ]);
  });

  it("shows a refusal about the charge at form level", async () => {
    recordPayment.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        message: "Synthetic refusal.",
        fieldErrors: { charge: ["This charge has been cancelled."] },
      },
    });
    setUp();
    chooseMethod("cash");
    submit();
    await confirm();

    expect(
      await screen.findByText("This charge has been cancelled."),
    ).toBeTruthy();
  });

  it.each([0, 502, 504])(
    "with no usable answer (%i), sends nothing more, keeps what was typed, and says to check",
    async (status) => {
      recordPayment.mockResolvedValue({
        ok: false,
        error: { status, fieldErrors: {} },
      });
      setUp();
      fireEvent.change(amountField(), { target: { value: "120" } });
      chooseMethod("card");
      submit();
      await confirm();

      await waitFor(() => expect(onOutcomeUnknown).toHaveBeenCalledTimes(1));
      expect(recordPayment).toHaveBeenCalledTimes(1);
      expect(router.refresh).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(amountField()).toHaveProperty("value", "120");
      expect(screen.queryByText(shared.form.generalFailure)).toBeNull();
      expect(onRefused).not.toHaveBeenCalled();
    },
  );

  it("treats a 500 as a failure, not an unknown outcome", async () => {
    recordPayment.mockResolvedValue({
      ok: false,
      error: { status: 500, message: "Synthetic failure.", fieldErrors: {} },
    });
    setUp();
    chooseMethod("cash");
    submit();
    await confirm();

    expect(await screen.findByText("Synthetic failure.")).toBeTruthy();
    expect(onOutcomeUnknown).not.toHaveBeenCalled();
  });

  it("follows a balance changed by another action on the page, unless an amount was typed", () => {
    const view = (balance: string) => (
      <NextIntlClientProvider
        locale="en"
        messages={messagesByLocale.en}
        timeZone="Africa/Cairo"
      >
        <PaymentForm
          charge={aCharge({ balance })}
          onSucceeded={onSucceeded}
          onOutcomeUnknown={onOutcomeUnknown}
          onRefused={onRefused}
        />
      </NextIntlClientProvider>
    );
    const { rerender } = renderWithIntl(view("300.00"));
    rerender(view("250.00"));
    expect(amountField()).toHaveProperty("value", "250.00");

    fireEvent.change(amountField(), { target: { value: "40" } });
    rerender(view("200.00"));
    expect(amountField()).toHaveProperty("value", "40");
  });

  it("takes focus straight after a visit is charged", () => {
    renderWithIntl(
      <PaymentForm
        charge={aCharge()}
        focusOnMount
        onSucceeded={onSucceeded}
        onOutcomeUnknown={onOutcomeUnknown}
        onRefused={onRefused}
      />,
    );

    expect(document.activeElement?.textContent).toBe(t.heading);
  });
});
