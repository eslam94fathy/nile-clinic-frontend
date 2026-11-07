import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasUnsaved,
  holdUnsaved,
  resetUnsavedForTests,
} from "@/lib/unsaved-changes";
import { SignOutButton } from "./sign-out-button";

const signOut = vi.hoisted(() => vi.fn());
const leaveAfterSignOut = vi.hoisted(() => vi.fn());
vi.mock("../api/sign-out", () => ({ signOut }));
vi.mock("@/lib/auth/session-end", () => ({ leaveAfterSignOut }));

const press = () => {
  render(
    <SignOutButton
      label="Sign out"
      workingLabel="Signing out"
      failureLabel="Failed"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
};

beforeEach(() => {
  signOut.mockReset().mockResolvedValue(true);
  leaveAfterSignOut.mockReset();
});

afterEach(() => {
  cleanup();
  resetUnsavedForTests();
});

describe("SignOutButton", () => {
  it("signs straight out with nothing to lose", async () => {
    press();
    await waitFor(() => expect(leaveAfterSignOut).toHaveBeenCalledOnce());
  });

  it("keeps what's unsaved if signing out fails, as the person is still here", async () => {
    signOut.mockResolvedValue(false);
    const discard = vi.fn();
    const ask = vi.fn((leave: () => void) => leave());
    holdUnsaved({ discard, ask, sessionEnded: vi.fn() });

    press();
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(discard).not.toHaveBeenCalled();
    expect(leaveAfterSignOut).not.toHaveBeenCalled();
    expect(hasUnsaved()).toBe(true);
  });

  it("asks first when something would be lost, and signs out only on leaving", async () => {
    const ask = vi.fn();
    holdUnsaved({ discard: vi.fn(), ask, sessionEnded: vi.fn() });

    press();
    expect(ask).toHaveBeenCalledOnce();
    expect(signOut).not.toHaveBeenCalled();

    const leave = ask.mock.calls[0]?.[0] as () => void;
    leave();
    await waitFor(() => expect(leaveAfterSignOut).toHaveBeenCalledOnce());
  });
});
