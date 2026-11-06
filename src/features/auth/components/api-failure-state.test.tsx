import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { ApiFailureState } from "./api-failure-state";

afterEach(cleanup);

const endSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session-end", () => ({ endSession }));

const { shared, auth } = messagesByLocale.en;

beforeEach(() => endSession.mockClear());

describe("ApiFailureState", () => {
  it("ends the session on 401", () => {
    renderWithIntl(
      <ApiFailureState error={{ status: 401, fieldErrors: {} }} />,
    );
    expect(endSession).toHaveBeenCalledTimes(1);
  });

  it("shows not allowed on 403", () => {
    renderWithIntl(
      <ApiFailureState error={{ status: 403, fieldErrors: {} }} />,
    );
    expect(screen.getByText(shared.states.forbiddenHeading)).toBeTruthy();
  });

  it("shows not found on 404", () => {
    renderWithIntl(
      <ApiFailureState error={{ status: 404, fieldErrors: {} }} />,
    );
    expect(screen.getByText(shared.states.notFoundHeading)).toBeTruthy();
  });

  it("shows the API's message, with a retry, on anything else", () => {
    renderWithIntl(
      <ApiFailureState
        error={{ status: 422, message: "Bad filter.", fieldErrors: {} }}
      />,
    );
    expect(screen.getByText("Bad filter.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: shared.states.retry }),
    ).toBeTruthy();
    expect(endSession).not.toHaveBeenCalled();
  });

  it("retries through the caller, when given a way, and doesn't reload", () => {
    const onRetry = vi.fn();
    renderWithIntl(
      <ApiFailureState
        error={{ status: 500, message: "Failed.", fieldErrors: {} }}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: shared.states.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers no retry on 403 or 404, whatever it's given", () => {
    renderWithIntl(
      <ApiFailureState
        error={{ status: 404, fieldErrors: {} }}
        onRetry={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: shared.states.retry }),
    ).toBeNull();
  });

  it("shows general text when nothing answered", () => {
    renderWithIntl(<ApiFailureState error={{ status: 0, fieldErrors: {} }} />);
    expect(screen.getByText(auth.errors.unavailable)).toBeTruthy();
  });
});
