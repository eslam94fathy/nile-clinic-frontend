import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { ForbiddenState } from "./forbidden-state";
import { LoadingState } from "./loading-state";
import { NotFoundState } from "./not-found-state";

afterEach(cleanup);

describe.each(["en", "ar"] as const)("in %s", (locale) => {
  const text = messagesByLocale[locale].shared.states;

  it("LoadingState is announced as a status", () => {
    renderWithIntl(<LoadingState />, locale);
    expect(screen.getByRole("status").textContent).toContain(text.loading);
  });

  it("ErrorState is announced, shows the message as sent, and retries", () => {
    const retry = vi.fn();
    renderWithIntl(
      <ErrorState message="Sample failure" onRetry={retry} />,
      locale,
    );

    expect(screen.getByRole("alert").textContent).toContain("Sample failure");
    fireEvent.click(screen.getByRole("button", { name: text.retry }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("ForbiddenState is announced with fixed text", () => {
    renderWithIntl(<ForbiddenState />, locale);
    expect(screen.getByRole("alert").textContent).toContain(
      text.forbiddenHeading,
    );
  });

  it("NotFoundState is neutral", () => {
    renderWithIntl(<NotFoundState />, locale);
    expect(screen.getByRole("status").textContent).toContain(
      text.notFoundHeading,
    );
  });
});

describe("NotFoundState wording", () => {
  it("doesn't say a record exists, or doesn't, or was refused", () => {
    const { container } = renderWithIntl(<NotFoundState />);
    expect(container.textContent).not.toMatch(
      /doesn't exist|deleted|removed|permission|not allowed/i,
    );
  });
});

describe("EmptyState", () => {
  it("supports both nothing yet and no matches, with the matching action", () => {
    renderWithIntl(
      <>
        <EmptyState title="Nothing yet" action={<button>{"Add"}</button>} />
        <EmptyState
          title="No matches"
          description="Change the filters."
          action={<button>{"Reset"}</button>}
        />
      </>,
    );

    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    expect(screen.getByText("Change the filters.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
  });
});
