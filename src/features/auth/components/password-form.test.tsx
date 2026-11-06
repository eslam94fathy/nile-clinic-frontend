import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { messagesByLocale } from "@/test-support/render-with-intl";
import { renderWithIntl } from "@/test-support/render-with-intl";
import { PasswordForm } from "./password-form";

afterEach(cleanup);

const changePassword = vi.hoisted(() => vi.fn());
vi.mock("../api/change-password", () => ({ changePassword }));

const text = {
  currentPassword: "Current password",
  newPassword: "New password",
  confirmPassword: "Repeat the new password",
  passwordHint: "Between 12 and 72 characters.",
  submit: "Change password",
  working: "Changing…",
  success: "Your password was changed.",
  currentRequired: "Enter your current password.",
  lengthRule: "Use between 12 and 72 characters.",
  mismatch: "The two new passwords don't match.",
  generalFailure: "Something went wrong.",
};

const GOOD = "synthetic-password-1";
const field = (label: string | RegExp) =>
  screen.getByLabelText(label) as HTMLInputElement;

function setup() {
  renderWithIntl(<PasswordForm text={text} />, "en");
}

function fill(current: string, next: string, again: string) {
  fireEvent.change(field(/^Current password/), { target: { value: current } });
  fireEvent.change(field(/^New password/), { target: { value: next } });
  fireEvent.change(field(/^Repeat/), { target: { value: again } });
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: text.submit }));

beforeEach(() => {
  changePassword.mockReset();
});

describe("PasswordForm", () => {
  it("submits, clears the fields, and confirms", async () => {
    changePassword.mockResolvedValue({ ok: true, status: 204, data: null });
    setup();
    fill("old-password", GOOD, GOOD);
    submit();

    await screen.findByText(text.success);
    expect(changePassword).toHaveBeenCalledWith(
      {
        current_password: "old-password",
        password: GOOD,
        password_confirmation: GOOD,
      },
      "en",
    );
    expect(field(/^Current password/).value).toBe("");
    expect(field(/^New password/).value).toBe("");
    expect(field(/^Repeat/).value).toBe("");
  });

  it.each([
    ["too short", "short", "short"],
    ["too long", "x".repeat(73), "x".repeat(73)],
  ])("gives quick feedback on a new password that's %s", async (_l, a, b) => {
    setup();
    fill("old-password", a, b);
    submit();

    await screen.findByText(text.lengthRule);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it.each([12, 72])("accepts %i characters", async (length) => {
    changePassword.mockResolvedValue({ ok: true, status: 204, data: null });
    setup();
    const value = "x".repeat(length);
    fill("old-password", value, value);
    submit();

    await screen.findByText(text.success);
  });

  it("gives quick feedback when the passwords don't match", async () => {
    setup();
    fill("old-password", GOOD, `${GOOD}x`);
    submit();

    await screen.findByText(text.mismatch);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("asks for the current password", async () => {
    setup();
    fill("", GOOD, GOOD);
    submit();

    await screen.findByText(text.currentRequired);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("shows a wrong current password on its field, as sent", async () => {
    changePassword.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: { current_password: ["Wrong, says the API."] },
      },
    });
    setup();
    fill("wrong-password", GOOD, GOOD);
    submit();

    await screen.findByText("Wrong, says the API.");
    expect(field(/^Current password/).getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(screen.queryByText(text.success)).toBeNull();
  });

  it("lets the API's answer on the new password show", async () => {
    changePassword.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { password: ["Too common."] } },
    });
    setup();
    fill("old-password", GOOD, GOOD);
    submit();

    expect(await screen.findByText("Too common.")).toBeTruthy();
  });

  it("shows an error with no matching field at form level", async () => {
    changePassword.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { other: ["Other problem."] } },
    });
    setup();
    fill("old-password", GOOD, GOOD);
    submit();

    expect(await screen.findByText("Other problem.")).toBeTruthy();
  });

  it("shows general text when nothing answers", async () => {
    changePassword.mockResolvedValue({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
    setup();
    fill("old-password", GOOD, GOOD);
    submit();

    expect(await screen.findByText(text.generalFailure)).toBeTruthy();
  });

  it("shows progress, and sends one request, while pending", async () => {
    changePassword.mockReturnValue(new Promise(() => {}));
    setup();
    fill("old-password", GOOD, GOOD);
    submit();

    const button = await screen.findByRole("button", { name: text.working });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.submit(button.closest("form") as HTMLFormElement);

    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(1));
  });
});

describe("before hydration", () => {
  const html = () =>
    renderToString(
      <NextIntlClientProvider locale="en" messages={messagesByLocale.en}>
        <PasswordForm text={text} />
      </NextIntlClientProvider>,
    );

  it("can't be submitted by the browser, so nothing can reach the address", () => {
    expect(html()).toMatch(/<form[^>]*method="post"/);
    expect(html()).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });
});
