import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { aCharge, SYNTHETIC_PATIENT } from "../test-support";
import { RefundForm } from "./refund-form";

const recordRefund = vi.hoisted(() => vi.fn());
vi.mock("../api/billing", () => ({ recordRefund }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/public", () => ({ useHydrated: () => true }));
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { charges, shared } = messagesByLocale.en;
const t = charges.refund;
const onSucceeded = vi.fn();
const onOutcomeUnknown = vi.fn();
const onRefused = vi.fn();

beforeEach(() => {
  recordRefund.mockReset();
  router.refresh.mockReset();
  toast.success.mockReset();
  onOutcomeUnknown.mockReset();
  onRefused.mockReset();
});
afterEach(cleanup);

function setUp() {
  renderWithIntl(
    <RefundForm
      charge={{ id: 9, amount_paid: "100.00", patient: SYNTHETIC_PATIENT }}
      onSucceeded={onSucceeded}
      onOutcomeUnknown={onOutcomeUnknown}
      onRefused={onRefused}
    />,
  );
}
const field = (label: string) => screen.getByLabelText(label, { exact: false });
function fill(amount: string, reason = "Synthetic overpayment") {
  fireEvent.change(field(t.amountLabel), { target: { value: amount } });
  fireEvent.click(screen.getByLabelText(shared.paymentMethod.cash));
  fireEvent.change(field(t.reasonLabel), { target: { value: reason } });
  fireEvent.click(screen.getByRole("button", { name: t.submit }));
}
const confirm = async () =>
  fireEvent.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: t.confirm,
    }),
  );

describe("RefundForm", () => {
  it("starts empty, with no method chosen", () => {
    setUp();

    expect(field(t.amountLabel)).toHaveProperty("value", "");
    expect(screen.getByLabelText(shared.paymentMethod.cash)).toHaveProperty(
      "checked",
      false,
    );
  });

  it("stops more than was paid before anything is sent", async () => {
    setUp();
    fill("100.01");

    expect(await screen.findByText(t.abovePaid)).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("confirms the patient, amount, and method, saying it can't be edited, then sends it once", async () => {
    recordRefund.mockResolvedValue({
      ok: true,
      status: 201,
      data: aCharge(),
    });
    setUp();
    fill("50");

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Synthetic Patient");
    expect(dialog.textContent).toContain("50.00");
    expect(dialog.textContent).toContain("can't be edited or removed");
    await confirm();

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(recordRefund).toHaveBeenCalledTimes(1);
    expect(recordRefund).toHaveBeenCalledWith(
      9,
      { amount: "50", method: "cash", reason: "Synthetic overpayment" },
      "en",
    );
    expect(toast.success.mock.calls[0]?.[0]).toContain("50.00");
  });

  it("puts the API's refusal on the amount", async () => {
    recordRefund.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: { amount: ["The amount is more than was paid."] },
      },
    });
    setUp();
    fill("10");
    await confirm();

    expect(
      await screen.findByText("The amount is more than was paid."),
    ).toBeTruthy();
  });

  it("with no answer, sends nothing more and says to check", async () => {
    recordRefund.mockResolvedValue({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
    setUp();
    fill("10");
    await confirm();

    await waitFor(() => expect(onOutcomeUnknown).toHaveBeenCalledTimes(1));
    expect(recordRefund).toHaveBeenCalledTimes(1);
    expect(field(t.amountLabel)).toHaveProperty("value", "10");
  });

  it("explains a refusal of the role as a form-level message", async () => {
    recordRefund.mockResolvedValue({
      ok: false,
      error: {
        status: 403,
        message: "You are not allowed to perform this action.",
        fieldErrors: {},
      },
    });
    setUp();
    fill("10");
    await confirm();

    expect(
      await screen.findByText("You are not allowed to perform this action."),
    ).toBeTruthy();
    // `useFormSubmit` refreshes on a `403`, so the page re-decides, once.
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
