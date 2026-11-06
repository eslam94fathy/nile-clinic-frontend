import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { messagesByLocale } from "@/test-support/render-with-intl";
import { renderWithIntl } from "@/test-support/render-with-intl";
import { SignInForm } from "./sign-in-form";

afterEach(cleanup);

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../api/sign-in", () => ({ signIn }));

const text = {
  email: "Email",
  password: "Password",
  submit: "Sign in",
  working: "Signing in…",
  emailRequired: "Enter your email.",
  passwordRequired: "Enter your password.",
  generalFailure: "Something went wrong.",
};

const assign = vi.fn();

function setup(search = "") {
  vi.stubGlobal("location", { search, assign });
  renderWithIntl(<SignInForm text={text} />, "ar");
}

function fill() {
  fireEvent.change(screen.getByLabelText(/Email/), {
    target: { value: "synthetic@example.test" },
  });
  fireEvent.change(screen.getByLabelText(/Password/), {
    target: { value: "synthetic-password" },
  });
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: text.submit }));

beforeEach(() => {
  signIn.mockReset();
  assign.mockClear();
});

describe("SignInForm", () => {
  it("submits and goes to the landing page, in its language", async () => {
    signIn.mockResolvedValue({ ok: true, status: 200, data: {} });
    setup();
    fill();
    submit();

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/ar/dashboard"));
    expect(signIn).toHaveBeenCalledWith(
      { email: "synthetic@example.test", password: "synthetic-password" },
      "ar",
    );
  });

  it("goes back to a safe return address", async () => {
    signIn.mockResolvedValue({ ok: true, status: 200, data: {} });
    setup("?return=%2Fqueue");
    fill();
    submit();

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/ar/queue"));
  });

  it.each(["%2F%2Fevil.test", "https%3A%2F%2Fevil.test", "%2Fpatients%2F5"])(
    "ignores the return address %s",
    async (value) => {
      signIn.mockResolvedValue({ ok: true, status: 200, data: {} });
      setup(`?return=${value}`);
      fill();
      submit();

      await waitFor(() => expect(assign).toHaveBeenCalledWith("/ar/dashboard"));
    },
  );

  it("asks for both fields without calling the API", async () => {
    setup();
    submit();

    await screen.findByText(text.emailRequired);
    expect(screen.getByText(text.passwordRequired)).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows the API's refusal on the email field, as sent", async () => {
    signIn.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        message: "Refused by the API.",
        fieldErrors: { email: ["Refused by the API."] },
      },
    });
    setup();
    fill();
    submit();

    await screen.findByText("Refused by the API.");
    expect(screen.getByLabelText(/Email/).getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it("shows an error with no matching field at form level", async () => {
    signIn.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { other: ["Other problem."] } },
    });
    setup();
    fill();
    submit();

    expect(await screen.findByText("Other problem.")).toBeTruthy();
  });

  it("shows the general message when the application's server answers", async () => {
    signIn.mockResolvedValue({
      ok: false,
      error: { status: 502, message: "General failure.", fieldErrors: {} },
    });
    setup();
    fill();
    submit();

    expect(await screen.findByText("General failure.")).toBeTruthy();
  });

  it("shows its own general text when nothing answers", async () => {
    signIn.mockResolvedValue({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
    setup();
    fill();
    submit();

    expect(await screen.findByText(text.generalFailure)).toBeTruthy();
  });

  it("shows progress, and sends one attempt, while pending", async () => {
    signIn.mockReturnValue(new Promise(() => {}));
    setup();
    fill();
    submit();

    const button = await screen.findByRole("button", { name: text.working });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    fireEvent.submit(button.closest("form") as HTMLFormElement);

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
  });

  it("can be tried again after a refusal", async () => {
    signIn.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { email: ["No."] } },
    });
    setup();
    fill();
    submit();

    expect(
      await screen.findByRole("button", { name: text.submit }),
    ).toBeTruthy();
  });
});

describe("before hydration", () => {
  const html = () =>
    renderToString(
      <NextIntlClientProvider locale="en" messages={messagesByLocale.en}>
        <SignInForm text={text} />
      </NextIntlClientProvider>,
    );

  it("can't be submitted by the browser, so nothing can reach the address", () => {
    expect(html()).toMatch(/<form[^>]*method="post"/);
    expect(html()).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });
});
