import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { aCharge } from "../test-support";
import { DiscountForm } from "./discount-form";

const setDiscount = vi.hoisted(() => vi.fn());
vi.mock("../api/billing", () => ({ setDiscount }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/public", () => ({ useHydrated: () => true }));
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { charges, shared } = messagesByLocale.en;
const t = charges.discount;
const onSucceeded = vi.fn();
const onOutcomeUnknown = vi.fn();
const onRefused = vi.fn();

beforeEach(() => {
  setDiscount.mockReset();
  router.refresh.mockReset();
  onOutcomeUnknown.mockReset();
  onRefused.mockReset();
});
afterEach(cleanup);

function setUp(discount = "0.00") {
  renderWithIntl(
    <DiscountForm
      charge={{ id: 9, discount }}
      onSucceeded={onSucceeded}
      onOutcomeUnknown={onOutcomeUnknown}
      onRefused={onRefused}
    />,
  );
}
const amountField = () =>
  screen.getByLabelText(t.amountLabel, { exact: false });
const reasonField = () =>
  screen.getByLabelText(t.reasonLabel, { exact: false });
const save = () =>
  fireEvent.click(screen.getByRole("button", { name: t.submit }));

describe("DiscountForm", () => {
  it("starts from the current discount, and says saving replaces it and zero removes it", () => {
    setUp("50.00");

    expect(amountField()).toHaveProperty("value", "50.00");
    expect(screen.getByText(t.amountHint)).toBeTruthy();
    expect(screen.getByText(shared.form.noMedicalDetails)).toBeTruthy();
  });

  it("sends zero, which removes the discount, with a reason, and asks for no confirmation", async () => {
    setDiscount.mockResolvedValue({
      ok: true,
      status: 200,
      data: aCharge(),
    });
    setUp("50.00");
    fireEvent.change(amountField(), { target: { value: "0" } });
    fireEvent.change(reasonField(), {
      target: { value: "Synthetic removal" },
    });
    save();

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(setDiscount).toHaveBeenCalledWith(
      9,
      { amount: "0", reason: "Synthetic removal" },
      "en",
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(toast.success).toHaveBeenCalledWith(t.done);
  });

  it("asks for a reason first", async () => {
    setUp();
    fireEvent.change(amountField(), { target: { value: "10" } });
    save();

    expect(await screen.findByText(t.reasonRule)).toBeTruthy();
    expect(setDiscount).not.toHaveBeenCalled();
  });

  it("puts the API's refusal of a discount that's too large on the amount", async () => {
    setDiscount.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: { amount: ["The discount is too large."] },
      },
    });
    setUp();
    fireEvent.change(amountField(), { target: { value: "349" } });
    fireEvent.change(reasonField(), { target: { value: "Synthetic" } });
    save();

    expect(await screen.findByText("The discount is too large.")).toBeTruthy();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("says to check when no answer arrives", async () => {
    setDiscount.mockResolvedValue({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
    setUp();
    fireEvent.change(amountField(), { target: { value: "10" } });
    fireEvent.change(reasonField(), { target: { value: "Synthetic" } });
    save();

    await waitFor(() => expect(onOutcomeUnknown).toHaveBeenCalledTimes(1));
    expect(setDiscount).toHaveBeenCalledTimes(1);
  });
});
