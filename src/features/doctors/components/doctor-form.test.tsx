import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { DoctorForm } from "./doctor-form";

afterEach(cleanup);

const createDoctor = vi.hoisted(() => vi.fn());
const updateDoctor = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../api/doctors", () => ({ createDoctor, updateDoctor }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

const t = messagesByLocale.en.doctors;
const { shared } = messagesByLocale.en;

const cardiology = {
  id: 1,
  name_en: "Synthetic Cardiology",
  name_ar: "قلب تجريبي",
  is_active: true,
};
const dermatology = {
  id: 2,
  name_en: "Synthetic Dermatology",
  name_ar: "جلدية تجريبية",
  is_active: true,
};
const retired = {
  id: 3,
  name_en: "Synthetic Retired",
  name_ar: "متوقف تجريبي",
  is_active: false,
};
const account = {
  id: 7,
  name: "Synthetic Person",
  email: "synthetic.person@example.test",
};
const doctor = {
  id: 5,
  name: "Synthetic Person",
  title: "Consultant",
  is_active: true,
  specialties: [cardiology, retired],
  registration_number: "SYN1",
  created_at: "2026-01-01T00:00:00.000000Z",
  updated_at: "2026-01-01T00:00:00.000000Z",
};

const field = (label: string) =>
  screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const check = (name: RegExp) =>
  fireEvent.click(screen.getByRole("checkbox", { name }));
const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  for (const mock of [
    createDoctor,
    updateDoctor,
    push,
    refresh,
    toastSuccess,
  ]) {
    mock.mockReset();
  }
});

describe("creating", () => {
  const setup = () =>
    renderWithIntl(
      <DoctorForm account={account} specialties={[cardiology, dermatology]} />,
    );
  const created = {
    ok: true,
    status: 201,
    data: { data: { id: 42 } },
  };

  it("sends the account, leaves out a blank number, and goes to the doctor", async () => {
    createDoctor.mockResolvedValue(created);
    setup();
    type(t.fieldTitle, "Consultant");
    check(/Cardiology/);
    press(t.create);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/doctors/42"));
    expect(createDoctor).toHaveBeenCalledWith(
      { user_id: 7, title: "Consultant", specialty_ids: [1] },
      "en",
    );
    expect(refresh).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(t.created);
  });

  it("shows the account as fixed text, with a way to choose another", () => {
    setup();
    expect(screen.getByText("synthetic.person@example.test")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: t.chooseAnother }).getAttribute("href"),
    ).toBe("/doctors/new");
  });

  it("requires a title of at most 100, and one specialty", async () => {
    setup();
    type(t.fieldTitle, "x".repeat(101));
    press(t.create);

    await screen.findByText(t.titleTooLong);
    await screen.findByText(t.specialtiesRequired);
    expect(createDoctor).not.toHaveBeenCalled();
  });

  it.each([
    ["user_id", "Already has a profile."],
    ["title", "Bad title."],
    ["registration_number", "Taken."],
    ["specialty_ids", "That one's deactivated."],
    ["specialty_ids.0", "No such specialty."],
  ])("shows a refusal on %s", async (key, message) => {
    createDoctor.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { [key]: [message] } },
    });
    setup();
    type(t.fieldTitle, "Consultant");
    check(/Cardiology/);
    press(t.create);

    expect(await screen.findByText(message)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(field(t.fieldTitle).value).toBe("Consultant");
  });

  it("shows anything else at form level", async () => {
    createDoctor.mockResolvedValue({
      ok: false,
      error: { status: 500, message: "Server trouble.", fieldErrors: {} },
    });
    setup();
    type(t.fieldTitle, "Consultant");
    check(/Cardiology/);
    press(t.create);

    expect(await screen.findByText("Server trouble.")).toBeTruthy();
  });
});

describe("editing", () => {
  const options = [cardiology, dermatology, retired];
  const setup = () =>
    renderWithIntl(<DoctorForm doctor={doctor} specialties={options} />);
  const OK = { ok: true, status: 200, data: { data: doctor } };

  it("sends nothing when nothing changed, and says so", async () => {
    setup();
    press(t.save);

    await screen.findByText(shared.form.nothingToSave);
    expect(updateDoctor).not.toHaveBeenCalled();
  });

  it("sends only what changed", async () => {
    updateDoctor.mockResolvedValue(OK);
    setup();
    type(t.fieldTitle, "Specialist");
    press(t.save);

    await waitFor(() =>
      expect(updateDoctor).toHaveBeenCalledWith(
        5,
        { title: "Specialist" },
        "en",
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/doctors/5"));
  });

  it("sends a cleared number as null", async () => {
    updateDoctor.mockResolvedValue(OK);
    setup();
    type(t.registrationNumber, "");
    press(t.save);

    await waitFor(() =>
      expect(updateDoctor).toHaveBeenCalledWith(
        5,
        { registration_number: null },
        "en",
      ),
    );
  });

  it("sends the whole set when specialties change", async () => {
    updateDoctor.mockResolvedValue(OK);
    setup();
    check(/Dermatology/);
    press(t.save);

    await waitFor(() =>
      expect(updateDoctor).toHaveBeenCalledWith(
        5,
        { specialty_ids: [1, 3, 2] },
        "en",
      ),
    );
  });

  it("shows a deactivated specialty as such, already chosen", () => {
    setup();
    const box = screen.getByRole("checkbox", {
      name: /Synthetic Retired \(deactivated\)/,
    }) as HTMLInputElement;
    expect(box.checked).toBe(true);
  });

  it("doesn't offer the account for change", () => {
    setup();
    expect(screen.queryByText(t.account)).toBeNull();
  });
});

it("uses the language's specialty name", () => {
  renderWithIntl(
    <DoctorForm account={account} specialties={[cardiology]} />,
    "ar",
  );
  expect(screen.getByRole("checkbox", { name: "قلب تجريبي" })).toBeTruthy();
});
