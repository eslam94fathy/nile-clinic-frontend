import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoleProvider } from "@/features/auth/public";
import type { Role } from "@/lib/auth/permissions";
import { Can } from "./can";

afterEach(cleanup);

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function renderAs(role: Role) {
  render(
    <RoleProvider role={role}>
      <Can capability="manageDoctors">
        <p>Synthetic action</p>
      </Can>
    </RoleProvider>,
  );
}

describe("Can", () => {
  it("shows its children to a role with the capability", () => {
    renderAs("administrator");
    expect(screen.getByText("Synthetic action")).toBeTruthy();
  });

  it.each(["receptionist", "doctor"] as const)(
    "hides them from a %s",
    (role) => {
      renderAs(role);
      expect(screen.queryByText("Synthetic action")).toBeNull();
    },
  );

  it("hides them outside the shell, where no role is known", () => {
    render(
      <Can capability="ownAccount">
        <p>Synthetic action</p>
      </Can>,
    );
    expect(screen.queryByText("Synthetic action")).toBeNull();
  });
});
