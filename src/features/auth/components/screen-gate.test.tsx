import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { RoleProvider } from "./role-context";
import { ScreenGate } from "./screen-gate";

afterEach(cleanup);

const getCurrentUser = vi.hoisted(() => vi.fn());
const getDoctorProfileStatus = vi.hoisted(() => vi.fn());
const endSession = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("../api/current-user", () => ({ getCurrentUser }));
vi.mock("../api/doctor-profile", () => ({ getDoctorProfileStatus }));
vi.mock("@/lib/auth/session-end", () => ({ endSession }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { shared, auth } = messagesByLocale.en;
const CONTENT = "Synthetic page content";

function signedInAs(role: string) {
  getCurrentUser.mockResolvedValue({
    kind: "signed-in",
    user: { role, name: "Synthetic Person" },
  });
}

async function gate(path: "dashboard" | "staff" | "my/queue" | "account") {
  renderWithIntl(
    await ScreenGate({
      locale: "en",
      path,
      children: <p>{CONTENT}</p>,
    }),
  );
}

beforeEach(() => {
  endSession.mockClear();
  refresh.mockClear();
  getDoctorProfileStatus.mockReset();
  getDoctorProfileStatus.mockResolvedValue("present");
});

describe("ScreenGate", () => {
  it("shows the content to a role that may open it", async () => {
    signedInAs("administrator");
    await gate("staff");

    expect(screen.getByText(CONTENT)).toBeTruthy();
    expect(endSession).not.toHaveBeenCalled();
  });

  it("shows not allowed, without the content, to another role", async () => {
    signedInAs("receptionist");
    await gate("staff");

    expect(screen.getByText(shared.states.forbiddenHeading)).toBeTruthy();
    expect(screen.queryByText(CONTENT)).toBeNull();
  });

  it("starts the session end with no session", async () => {
    getCurrentUser.mockResolvedValue({ kind: "no-session" });
    await gate("dashboard");

    expect(endSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(CONTENT)).toBeNull();
  });

  it("shows a retry, and stays signed in, when the API fails", async () => {
    getCurrentUser.mockResolvedValue({ kind: "unavailable" });
    await gate("dashboard");

    expect(screen.getByText(auth.errors.unavailable)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: shared.states.retry }),
    ).toBeTruthy();
    expect(screen.queryByText(CONTENT)).toBeNull();
    expect(endSession).not.toHaveBeenCalled();
  });

  it("refreshes the shell when the role has changed", async () => {
    signedInAs("doctor");
    const tree = await ScreenGate({
      locale: "en",
      path: "account",
      children: <p>{CONTENT}</p>,
    });

    renderWithIntl(<RoleProvider role="receptionist">{tree}</RoleProvider>);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("doesn't refresh when the role is the same", async () => {
    signedInAs("doctor");
    const tree = await ScreenGate({
      locale: "en",
      path: "account",
      children: <p>{CONTENT}</p>,
    });

    renderWithIntl(<RoleProvider role="doctor">{tree}</RoleProvider>);

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("the capability prop", () => {
  const narrowed = () =>
    ScreenGate({
      locale: "en",
      path: "doctors",
      capability: "manageDoctors",
      children: <p>{CONTENT}</p>,
    });

  it("lets a role with the capability through", async () => {
    signedInAs("administrator");
    renderWithIntl(await narrowed());

    expect(screen.getByText(CONTENT)).toBeTruthy();
  });

  it("refuses a role the route allows but the capability doesn't", async () => {
    signedInAs("receptionist");
    renderWithIntl(await narrowed());

    expect(screen.getByText(shared.states.forbiddenHeading)).toBeTruthy();
    expect(screen.queryByText(CONTENT)).toBeNull();
  });
});

describe("a doctor's profile", () => {
  it.each(["dashboard", "my/queue"] as const)(
    "shows the no-profile state on %s when it's missing",
    async (path) => {
      signedInAs("doctor");
      getDoctorProfileStatus.mockResolvedValue("missing");
      await gate(path);

      expect(screen.getByText(auth.noProfile.heading)).toBeTruthy();
      expect(screen.queryByText(CONTENT)).toBeNull();
    },
  );

  it("keeps the account page working", async () => {
    signedInAs("doctor");
    getDoctorProfileStatus.mockResolvedValue("missing");
    await gate("account");

    expect(screen.getByText(CONTENT)).toBeTruthy();
    expect(getDoctorProfileStatus).not.toHaveBeenCalled();
  });

  it("shows the content when the profile is present", async () => {
    signedInAs("doctor");
    await gate("dashboard");
    expect(screen.getByText(CONTENT)).toBeTruthy();
  });

  it("shows a retry, not the no-profile state, when the check fails", async () => {
    signedInAs("doctor");
    getDoctorProfileStatus.mockResolvedValue("unknown");
    await gate("dashboard");

    expect(screen.getByText(auth.errors.unavailable)).toBeTruthy();
    expect(screen.queryByText(auth.noProfile.heading)).toBeNull();
  });

  it("lets the API's 403 win over the role map", async () => {
    signedInAs("doctor");
    getDoctorProfileStatus.mockResolvedValue("forbidden");
    await gate("my/queue");

    expect(screen.getByText(shared.states.forbiddenHeading)).toBeTruthy();
    expect(screen.queryByText(CONTENT)).toBeNull();
  });

  it("ends the session on 401", async () => {
    signedInAs("doctor");
    getDoctorProfileStatus.mockResolvedValue("no-session");
    await gate("dashboard");

    expect(endSession).toHaveBeenCalledTimes(1);
  });

  it.each(["administrator", "receptionist"])(
    "isn't checked for a %s",
    async (role) => {
      signedInAs(role);
      await gate("dashboard");

      expect(getDoctorProfileStatus).not.toHaveBeenCalled();
    },
  );
});
