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
import { aCharge } from "../test-support";
import { CancelCharge } from "./cancel-charge";

const cancelCharge = vi.hoisted(() => vi.fn());
vi.mock("../api/billing", () => ({ cancelCharge }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/auth/public", () => ({ useHydrated: () => true }));
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { charges, shared } = messagesByLocale.en;
const t = charges.cancel;
const onSucceeded = vi.fn();
const onOutcomeUnknown = vi.fn();
const onRefused = vi.fn();

beforeEach(() => {
  cancelCharge.mockReset();
  router.refresh.mockReset();
  onSucceeded.mockReset();
  onOutcomeUnknown.mockReset();
  onRefused.mockReset();
});
afterEach(cleanup);

async function open() {
  renderWithIntl(
    <CancelCharge
      chargeId={9}
      onSucceeded={onSucceeded}
      onOutcomeUnknown={onOutcomeUnknown}
      onRefused={onRefused}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: t.action }));
  return screen.findByRole("alertdialog");
}
const reasonField = (dialog: HTMLElement) =>
  within(dialog).getByLabelText(t.reasonLabel, { exact: false });
const confirm = (dialog: HTMLElement) =>
  fireEvent.click(within(dialog).getByRole("button", { name: t.confirm }));

describe("CancelCharge", () => {
  it("says it can't be undone, that the visit can be charged again, and not to enter medical details", async () => {
    const dialog = await open();

    expect(dialog.textContent).toContain(t.description);
    expect(dialog.textContent).toContain(shared.confirm.irreversible);
    expect(dialog.textContent).toContain(shared.form.noMedicalDetails);
    expect(reasonField(dialog).getAttribute("maxlength")).toBe("500");
    expect(reasonField(dialog).getAttribute("dir")).toBe("auto");
  });

  it("asks for a reason, and sends nothing without one", async () => {
    const dialog = await open();
    confirm(dialog);

    expect(await within(dialog).findByText(t.reasonRule)).toBeTruthy();
    expect(cancelCharge).not.toHaveBeenCalled();
  });

  it("sends the reason once, and reads the page again", async () => {
    cancelCharge.mockResolvedValue({
      ok: true,
      status: 200,
      data: aCharge({ status: "cancelled" }),
    });
    const dialog = await open();
    fireEvent.change(reasonField(dialog), {
      target: { value: "Synthetic mistaken charge" },
    });
    confirm(dialog);

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(cancelCharge).toHaveBeenCalledTimes(1);
    expect(cancelCharge).toHaveBeenCalledWith(
      9,
      { reason: "Synthetic mistaken charge" },
      "en",
    );
    expect(toast.success).toHaveBeenCalledWith(t.done);
    expect(onSucceeded).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("keeps the dialog with the API's message when money is held, and reads the charge again", async () => {
    cancelCharge.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: { charge: ["Money is held on this charge."] },
      },
    });
    const dialog = await open();
    fireEvent.change(reasonField(dialog), { target: { value: "Synthetic" } });
    confirm(dialog);

    expect(
      await within(dialog).findByText("Money is held on this charge."),
    ).toBeTruthy();
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(onRefused).toHaveBeenCalledWith(["Money is held on this charge."]);
  });

  it("puts a refusal about the reason on its field", async () => {
    cancelCharge.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { reason: ["Synthetic too long."] } },
    });
    const dialog = await open();
    fireEvent.change(reasonField(dialog), { target: { value: "Synthetic" } });
    confirm(dialog);

    expect(await within(dialog).findByText("Synthetic too long.")).toBeTruthy();
  });

  it("closes and says to check, with no usable answer, sending nothing more", async () => {
    cancelCharge.mockResolvedValue({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
    const dialog = await open();
    fireEvent.change(reasonField(dialog), { target: { value: "Synthetic" } });
    confirm(dialog);

    await waitFor(() => expect(onOutcomeUnknown).toHaveBeenCalledTimes(1));
    expect(cancelCharge).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
