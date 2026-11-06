import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import SignedInError from "./error";

afterEach(cleanup);

describe("the signed-in error page", () => {
  it("offers a retry", () => {
    const retry = vi.fn();
    renderWithIntl(<SignedInError retry={retry} />);

    expect(
      screen.getByText(messagesByLocale.en.error.description),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: messagesByLocale.en.shared.states.retry,
      }),
    );

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("adds no second main landmark inside the frame", () => {
    renderWithIntl(<SignedInError retry={vi.fn()} />);

    expect(screen.queryByRole("main")).toBeNull();
  });
});
