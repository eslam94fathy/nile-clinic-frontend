import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import ErrorPage from "./error";

vi.mock("@/components/shared/public-header", () => ({
  PublicHeader: () => null,
}));

afterEach(cleanup);

it.each([
  ["ar", ar],
  ["en", en],
] as const)(
  "shows a translated error with a retry, in %s",
  (locale, messages) => {
    const retry = vi.fn();
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ErrorPage retry={retry} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("heading").textContent).toBe(
      messages.error.heading,
    );

    fireEvent.click(screen.getByRole("button", { name: messages.error.retry }));

    expect(retry).toHaveBeenCalledOnce();
  },
);
