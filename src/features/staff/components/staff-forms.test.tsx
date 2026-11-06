import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { SetPasswordForm } from "./set-password-form";
import { StaffCreateForm } from "./staff-create-form";
import { StaffEditForm } from "./staff-edit-form";

afterEach(cleanup);

const createStaffMember = vi.hoisted(() => vi.fn());
const updateStaffMember = vi.hoisted(() => vi.fn());
const setStaffPassword = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../api/staff", () => ({
  createStaffMember,
  updateStaffMember,
  setStaffPassword,
}));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

const t = messagesByLocale.en.staff;
const { shared, roles } = messagesByLocale.en;
const GOOD = "synthetic-password-1";

const field = (label: string) =>
  screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

const member = {
  id: 9,
  name: "Synthetic Person",
  email: "synthetic.person@example.test",
  role: "doctor" as const,
  is_active: true,
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: "2026-01-01T00:00:00+00:00",
};

beforeEach(() => {
  for (const mock of [
    createStaffMember,
    updateStaffMember,
    setStaffPassword,
    push,
    refresh,
    toastSuccess,
  ]) {
    mock.mockReset();
  }
});

describe("StaffCreateForm", () => {
  function fill(role = "receptionist", password = GOOD, again = password) {
    type(t.name, "Synthetic New");
    type(t.email, "synthetic.new@example.test");
    type(t.role, role);
    type(t.password, password);
    type(t.passwordConfirmation, again);
  }

  const created = (role: string) => ({
    ok: true,
    status: 201,
    data: { data: { ...member, id: 12, role } },
  });

  it("sends the values, and goes to the new account", async () => {
    createStaffMember.mockResolvedValue(created("receptionist"));
    renderWithIntl(<StaffCreateForm />);
    fill();
    press(t.create);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/12"));
    expect(createStaffMember).toHaveBeenCalledWith(
      {
        name: "Synthetic New",
        email: "synthetic.new@example.test",
        role: "receptionist",
        password: GOOD,
        password_confirmation: GOOD,
      },
      "en",
    );
    expect(toastSuccess).toHaveBeenCalledWith(t.created);
    // Visited pages stay mounted, so the typed password mustn't stay behind in this one.
    await waitFor(() => expect(field(t.password).value).toBe(""));
    expect(field(t.passwordConfirmation).value).toBe("");
  });

  it("sends a new doctor account on to its profile", async () => {
    createStaffMember.mockResolvedValue(created("doctor"));
    renderWithIntl(<StaffCreateForm />);
    fill("doctor");
    press(t.create);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/doctors/new?account=12"),
    );
    expect(toastSuccess).toHaveBeenCalledWith(t.createdDoctor);
  });

  it("can preselect a role", () => {
    renderWithIntl(<StaffCreateForm defaultRole="doctor" />);
    expect(field(t.role).value).toBe("doctor");
  });

  it.each([
    ["11 characters", "x".repeat(11), t.lengthRule],
    ["73 characters", "x".repeat(73), t.lengthRule],
  ])("refuses %s", async (_label, password, message) => {
    renderWithIntl(<StaffCreateForm />);
    fill("receptionist", password);
    press(t.create);

    await screen.findByText(message);
    expect(createStaffMember).not.toHaveBeenCalled();
  });

  it("refuses a confirmation that doesn't match", async () => {
    renderWithIntl(<StaffCreateForm />);
    fill("receptionist", GOOD, `${GOOD}x`);
    press(t.create);

    await screen.findByText(t.mismatch);
    expect(createStaffMember).not.toHaveBeenCalled();
  });

  it("requires name, email, and role", async () => {
    renderWithIntl(<StaffCreateForm />);
    type(t.password, GOOD);
    type(t.passwordConfirmation, GOOD);
    press(t.create);

    await screen.findByText(t.nameRequired);
    await screen.findByText(t.emailRequired);
    await screen.findByText(t.roleRequired);
    expect(createStaffMember).not.toHaveBeenCalled();
  });

  it("puts the API's refusal on its field, and keeps what was typed", async () => {
    createStaffMember.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { email: ["Already in use."] } },
    });
    renderWithIntl(<StaffCreateForm />);
    fill();
    press(t.create);

    await screen.findByText("Already in use.");
    expect(field(t.email).getAttribute("aria-invalid")).toBe("true");
    expect(field(t.name).value).toBe("Synthetic New");
    expect(push).not.toHaveBeenCalled();
  });

  it("uses a POST form, so that a password can't reach the address", () => {
    const { container } = renderWithIntl(<StaffCreateForm />);
    expect(container.querySelector("form")?.getAttribute("method")).toBe(
      "post",
    );
  });

  it("sends one request while pending", async () => {
    createStaffMember.mockReturnValue(new Promise(() => {}));
    renderWithIntl(<StaffCreateForm />);
    fill();
    press(t.create);

    const button = await screen.findByRole("button", { name: t.creating });
    fireEvent.submit(button.closest("form") as HTMLFormElement);
    await waitFor(() => expect(createStaffMember).toHaveBeenCalledTimes(1));
  });
});

describe("StaffEditForm", () => {
  const OK = { ok: true, status: 200, data: { data: member } };

  it("sends only what changed", async () => {
    updateStaffMember.mockResolvedValue(OK);
    renderWithIntl(<StaffEditForm member={member} isSelf={false} />);
    type(t.name, "Synthetic Renamed");
    press(t.save);

    await waitFor(() =>
      expect(updateStaffMember).toHaveBeenCalledWith(
        9,
        { name: "Synthetic Renamed" },
        "en",
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith(t.saved);
  });

  it("sends nothing when nothing changed, and says so", async () => {
    renderWithIntl(<StaffEditForm member={member} isSelf={false} />);
    press(t.save);

    await screen.findByText(shared.form.nothingToSave);
    expect(updateStaffMember).not.toHaveBeenCalled();
  });

  it("warns before moving a doctor to another role", async () => {
    updateStaffMember.mockResolvedValue(OK);
    renderWithIntl(<StaffEditForm member={member} isSelf={false} />);
    type(t.role, "receptionist");
    press(t.save);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(t.leavesDoctorDescription);
    expect(updateStaffMember).not.toHaveBeenCalled();

    press(t.confirmRole);
    await waitFor(() =>
      expect(updateStaffMember).toHaveBeenCalledWith(
        9,
        { role: "receptionist" },
        "en",
      ),
    );
  });

  it("doesn't warn when another change leaves the role alone", async () => {
    updateStaffMember.mockResolvedValue(OK);
    renderWithIntl(<StaffEditForm member={member} isSelf={false} />);
    type(t.email, "synthetic.other@example.test");
    press(t.save);

    await waitFor(() => expect(updateStaffMember).toHaveBeenCalled());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("warns an administrator who is demoting themselves", async () => {
    renderWithIntl(
      <StaffEditForm member={{ ...member, role: "administrator" }} isSelf />,
    );
    type(t.role, "receptionist");
    press(t.save);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(t.selfDemoteDescription);
  });

  it("shows the last-administrator refusal at form level", async () => {
    updateStaffMember.mockResolvedValue({
      ok: false,
      error: { status: 422, message: "The last one.", fieldErrors: {} },
    });
    renderWithIntl(
      <StaffEditForm member={{ ...member, role: "administrator" }} isSelf />,
    );
    type(t.role, "receptionist");
    press(t.save);
    await screen.findByRole("alertdialog");
    press(t.confirmRole);

    expect(await screen.findByText("The last one.")).toBeTruthy();
  });

  it("offers each role, translated", () => {
    renderWithIntl(<StaffEditForm member={member} isSelf={false} />);
    expect(screen.getByRole("option", { name: roles.doctor })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: roles.administrator }),
    ).toBeTruthy();
  });
});

describe("SetPasswordForm", () => {
  function setup() {
    renderWithIntl(<SetPasswordForm id={9} name="Synthetic Person" />);
  }
  function fill(password = GOOD, again = password) {
    type(t.password, password);
    type(t.passwordConfirmation, again);
  }
  const openConfirm = () => press(t.setPassword);
  const confirmInDialog = async () => {
    const dialog = await screen.findByRole("alertdialog");
    const button = [...dialog.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === t.setPassword,
    );
    if (button) fireEvent.click(button);
  };

  it("asks first, saying that sessions end", async () => {
    setup();
    fill();
    openConfirm();

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(t.passwordConfirmDescription);
    expect(setStaffPassword).not.toHaveBeenCalled();
  });

  it("sets the password, then clears the fields", async () => {
    setStaffPassword.mockResolvedValue({ ok: true, status: 204, data: null });
    setup();
    fill();
    openConfirm();
    await confirmInDialog();

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(t.passwordSet),
    );
    expect(setStaffPassword).toHaveBeenCalledWith(
      9,
      { password: GOOD, password_confirmation: GOOD },
      "en",
    );
    await waitFor(() => expect(field(t.password).value).toBe(""));
    expect(field(t.passwordConfirmation).value).toBe("");
  });

  it("forgets a password waiting for confirmation on leaving the page", async () => {
    const page = (mode: "visible" | "hidden") => (
      <NextIntlClientProvider
        locale="en"
        messages={messagesByLocale.en}
        timeZone="Africa/Cairo"
      >
        <Activity mode={mode}>
          <SetPasswordForm id={9} name="Synthetic Person" />
        </Activity>
      </NextIntlClientProvider>
    );
    const { rerender } = render(page("visible"));
    fill();
    openConfirm();
    await screen.findByRole("alertdialog");

    rerender(page("hidden"));
    rerender(page("visible"));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(field(t.password).value).toBe("");
  });

  it("gives quick feedback with no dialog", async () => {
    setup();
    fill("short");
    openConfirm();

    await screen.findByText(t.lengthRule);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("shows the API's refusal on the field", async () => {
    setStaffPassword.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { password: ["Too common."] } },
    });
    setup();
    fill();
    openConfirm();
    await confirmInDialog();

    expect(await screen.findByText("Too common.")).toBeTruthy();
  });
});
