import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { AccountActions } from "./account-actions";

afterEach(cleanup);

const setStaffActive = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("../api/staff", () => ({ setStaffActive, setStaffPassword: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh }),
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const t = messagesByLocale.en.staff;

const member = {
  id: 9,
  name: "Synthetic Person",
  email: "synthetic.person@example.test",
  role: "receptionist" as const,
  is_active: true,
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: "2026-01-01T00:00:00+00:00",
};

const openDeactivate = () =>
  fireEvent.click(screen.getByRole("button", { name: t.deactivate }));

beforeEach(() => {
  setStaffActive.mockReset();
  refresh.mockClear();
});

describe("AccountActions, on someone else's account", () => {
  it("explains that deactivating ends their sessions", async () => {
    renderWithIntl(<AccountActions member={member} isSelf={false} />);
    openDeactivate();

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(t.deactivateDescription);
  });

  it("offers a password reset", () => {
    renderWithIntl(<AccountActions member={member} isSelf={false} />);
    expect(screen.getByText(t.passwordHeading)).toBeTruthy();
    expect(screen.queryByText(t.ownPassword)).toBeNull();
  });

  it("deactivates on confirmation, and refreshes", async () => {
    setStaffActive.mockResolvedValue({ ok: true, status: 200, data: null });
    renderWithIntl(<AccountActions member={member} isSelf={false} />);
    openDeactivate();
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      [...dialog.querySelectorAll("button")].find(
        (button) => button.textContent === t.deactivate,
      ) as HTMLButtonElement,
    );

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(setStaffActive).toHaveBeenCalledWith(9, false, "en");
  });

  it("shows the last-administrator refusal in the dialog", async () => {
    setStaffActive.mockResolvedValue({
      ok: false,
      error: { status: 422, message: "The last one.", fieldErrors: {} },
    });
    renderWithIntl(<AccountActions member={member} isSelf={false} />);
    openDeactivate();
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      [...dialog.querySelectorAll("button")].find(
        (button) => button.textContent === t.deactivate,
      ) as HTMLButtonElement,
    );

    await waitFor(() => expect(dialog.textContent).toContain("The last one."));
  });

  it("offers to reactivate a deactivated account, explaining the effect", async () => {
    renderWithIntl(
      <AccountActions
        member={{ ...member, is_active: false }}
        isSelf={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: t.reactivate }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(t.reactivateDescription);
  });
});

describe("AccountActions, on one's own account", () => {
  it("replaces the password reset with a link to the account page", () => {
    renderWithIntl(<AccountActions member={member} isSelf />);

    expect(screen.queryByText(t.passwordHeading)).toBeNull();
    expect(screen.getByText(t.ownPassword)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: t.ownPasswordLink })
        .getAttribute("href"),
    ).toBe("/account");
  });

  it("says that deactivating signs them out", async () => {
    renderWithIntl(<AccountActions member={member} isSelf />);
    openDeactivate();

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(t.selfDeactivateDescription);
  });
});

describe("the doctor profile offer", () => {
  const doctor = { ...member, role: "doctor" as const };

  it("appears for an active doctor account", () => {
    renderWithIntl(<AccountActions member={doctor} isSelf={false} />);

    expect(
      screen.getByRole("link", { name: t.createProfile }).getAttribute("href"),
    ).toBe("/doctors/new?account=9");
  });

  it("doesn't appear for another role", () => {
    renderWithIntl(<AccountActions member={member} isSelf={false} />);
    expect(screen.queryByRole("link", { name: t.createProfile })).toBeNull();
  });

  it("doesn't appear for a deactivated doctor account", () => {
    renderWithIntl(
      <AccountActions
        member={{ ...doctor, is_active: false }}
        isSelf={false}
      />,
    );
    expect(screen.queryByRole("link", { name: t.createProfile })).toBeNull();
  });
});
