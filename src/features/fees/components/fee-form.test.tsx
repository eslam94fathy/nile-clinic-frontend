import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { FeeForm } from "./fee-form";

afterEach(cleanup);

const setFee = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../api/fees", () => ({ setFee }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

const t = messagesByLocale.en.fees;

const amount = () =>
  screen.getByLabelText(new RegExp(`^${t.amountLabel}`)) as HTMLInputElement;
const type = (value: string) =>
  fireEvent.change(amount(), { target: { value } });

beforeEach(() => {
  for (const mock of [setFee, refresh, toastSuccess]) mock.mockReset();
});

describe("FeeForm", () => {
  it("sends the amount as a string, confirms, and refreshes", async () => {
    setFee.mockResolvedValue({ ok: true, status: 200, data: null });
    renderWithIntl(<FeeForm doctorId={5} hasFee={false} />);
    type("350.10");
    fireEvent.click(screen.getByRole("button", { name: t.set }));

    await waitFor(() =>
      expect(setFee).toHaveBeenCalledWith(5, { amount: "350.10" }, "en"),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith(t.saved);
    expect(amount().value).toBe("");
  });

  it("says 'change' when a fee exists", () => {
    renderWithIntl(<FeeForm doctorId={5} hasFee />);
    expect(screen.getByRole("button", { name: t.change })).toBeTruthy();
  });

  it("says that existing charges keep their amount", () => {
    renderWithIntl(<FeeForm doctorId={5} hasFee />);
    expect(screen.getByText(t.chargesNote)).toBeTruthy();
  });

  it("gives quick feedback, with no request", async () => {
    renderWithIntl(<FeeForm doctorId={5} hasFee={false} />);
    type("0");
    fireEvent.click(screen.getByRole("button", { name: t.set }));

    await screen.findByText(t.amountRule);
    expect(setFee).not.toHaveBeenCalled();
  });

  it("shows the API's refusal on the field", async () => {
    setFee.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { amount: ["The API refuses."] } },
    });
    renderWithIntl(<FeeForm doctorId={5} hasFee={false} />);
    type("350");
    fireEvent.click(screen.getByRole("button", { name: t.set }));

    await screen.findByText("The API refuses.");
    expect(amount().getAttribute("aria-invalid")).toBe("true");
    expect(amount().value).toBe("350");
  });

  it("shows anything else at form level", async () => {
    setFee.mockResolvedValue({
      ok: false,
      error: { status: 500, message: "Server trouble.", fieldErrors: {} },
    });
    renderWithIntl(<FeeForm doctorId={5} hasFee={false} />);
    type("350");
    fireEvent.click(screen.getByRole("button", { name: t.set }));

    expect(await screen.findByText("Server trouble.")).toBeTruthy();
  });

  it("sends one request while pending", async () => {
    setFee.mockReturnValue(new Promise(() => {}));
    renderWithIntl(<FeeForm doctorId={5} hasFee={false} />);
    type("350");
    fireEvent.click(screen.getByRole("button", { name: t.set }));

    const button = await screen.findByRole("button", { name: t.saving });
    fireEvent.submit(button.closest("form") as HTMLFormElement);
    await waitFor(() => expect(setFee).toHaveBeenCalledTimes(1));
  });
});
