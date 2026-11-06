import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { SpecialtyForm } from "./specialty-form";

afterEach(cleanup);

const createSpecialty = vi.hoisted(() => vi.fn());
const renameSpecialty = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../api/specialties", () => ({ createSpecialty, renameSpecialty }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

const t = messagesByLocale.en.specialties;
const { shared } = messagesByLocale.en;

const field = (label: string) =>
  screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const submit = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

const OK = { ok: true, status: 200, data: null };

beforeEach(() => {
  createSpecialty.mockReset();
  renameSpecialty.mockReset();
  refresh.mockClear();
  toastSuccess.mockClear();
});

describe("adding", () => {
  const setup = () => renderWithIntl(<SpecialtyForm />);

  it("sends both names, confirms, clears, and refreshes", async () => {
    createSpecialty.mockResolvedValue(OK);
    setup();
    type(t.nameEn, "Synthetic Field");
    type(t.nameAr, "مجال تجريبي");
    submit(t.add);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(t.added));
    expect(createSpecialty).toHaveBeenCalledWith(
      { name_en: "Synthetic Field", name_ar: "مجال تجريبي" },
      "en",
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(field(t.nameEn).value).toBe("");
  });

  it("requires both names", async () => {
    setup();
    submit(t.add);

    expect((await screen.findAllByText(t.nameRequired)).length).toBe(2);
    expect(createSpecialty).not.toHaveBeenCalled();
  });

  it("allows at most 100 characters", async () => {
    setup();
    type(t.nameEn, "x".repeat(101));
    type(t.nameAr, "ok");
    submit(t.add);

    await screen.findByText(t.nameTooLong);
    expect(createSpecialty).not.toHaveBeenCalled();
  });

  it("shows the API's refusal on its name field", async () => {
    createSpecialty.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { name_ar: ["Already used."] } },
    });
    setup();
    type(t.nameEn, "A");
    type(t.nameAr, "ب");
    submit(t.add);

    await screen.findByText("Already used.");
    expect(field(t.nameAr).getAttribute("aria-invalid")).toBe("true");
    expect(field(t.nameEn).value).toBe("A");
  });

  it("shows an error with no matching field at form level", async () => {
    createSpecialty.mockResolvedValue({
      ok: false,
      error: { status: 500, message: "Server trouble.", fieldErrors: {} },
    });
    setup();
    type(t.nameEn, "A");
    type(t.nameAr, "ب");
    submit(t.add);

    expect(await screen.findByText("Server trouble.")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes on 403, so that the page can re-decide", async () => {
    createSpecialty.mockResolvedValue({
      ok: false,
      error: { status: 403, message: "Not allowed.", fieldErrors: {} },
    });
    setup();
    type(t.nameEn, "A");
    type(t.nameAr, "ب");
    submit(t.add);

    await screen.findByText("Not allowed.");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("sends one request while pending, and shows progress", async () => {
    createSpecialty.mockReturnValue(new Promise(() => {}));
    setup();
    type(t.nameEn, "A");
    type(t.nameAr, "ب");
    submit(t.add);

    const button = await screen.findByRole("button", { name: t.adding });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.submit(button.closest("form") as HTMLFormElement);
    await waitFor(() => expect(createSpecialty).toHaveBeenCalledTimes(1));
  });
});

describe("renaming", () => {
  const specialty = {
    id: 7,
    name_en: "Synthetic Old",
    name_ar: "قديم تجريبي",
    is_active: true,
  };
  const onDone = vi.fn();
  const setup = () =>
    renderWithIntl(<SpecialtyForm specialty={specialty} onDone={onDone} />);

  beforeEach(() => onDone.mockClear());

  it("sends only the name that changed", async () => {
    renameSpecialty.mockResolvedValue(OK);
    setup();
    type(t.nameEn, "Synthetic New");
    submit(t.save);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(t.renamed));
    expect(renameSpecialty).toHaveBeenCalledWith(
      7,
      { name_en: "Synthetic New" },
      "en",
    );
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when nothing changed, and says so", async () => {
    setup();
    submit(t.save);

    await screen.findByText(shared.form.nothingToSave);
    expect(renameSpecialty).not.toHaveBeenCalled();
  });

  it("can be cancelled", () => {
    setup();
    submit(t.cancel);

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(renameSpecialty).not.toHaveBeenCalled();
  });
});
