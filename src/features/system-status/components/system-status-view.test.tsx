import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SystemStatusView } from "./system-status-view";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const labels = { checkAgain: "Check again", checking: "Checking" };

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

describe("SystemStatusView", () => {
  it("shows the status as text", () => {
    render(<SystemStatusView state="working" label="Working" />);

    expect(screen.getByText("Working")).toBeTruthy();
  });

  it("shows the check time when given", () => {
    render(
      <SystemStatusView state="working" label="Working" detail="At 10:00" />,
    );

    expect(screen.getByText("At 10:00")).toBeTruthy();
  });

  it("offers no action while checking", () => {
    render(<SystemStatusView state="checking" label="Checking" />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers no action when working, even if labels are given", () => {
    render(<SystemStatusView state="working" label="Working" retry={labels} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["unavailable", "unreachable"] as const)(
    "offers to check again when %s",
    (state) => {
      render(<SystemStatusView state={state} label="Down" retry={labels} />);

      fireEvent.click(screen.getByRole("button", { name: "Check again" }));

      expect(refresh).toHaveBeenCalledOnce();
      expect(
        screen.getByRole("button").getAttribute("aria-disabled"),
      ).not.toBeNull();
    },
  );
});
