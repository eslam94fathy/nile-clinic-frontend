import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import { changeCount } from "../opening";
import type { Patient } from "../types";
import { PatientEditForm } from "./patient-edit-form";

const updatePatient = vi.hoisted(() => vi.fn());
const readPatient = vi.hoisted(() => vi.fn());
vi.mock("../api/patients", () => ({ updatePatient, readPatient }));

const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const success = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success } }));

const { patients: t, shared } = messagesByLocale.en;
const f = t.fields;

const record: Patient = {
  id: 5,
  full_name: "Synthetic Patient",
  sex: "female",
  date_of_birth: "1990-04-12",
  phone: "01000000001",
  national_id: "29004120100001",
  address: "12 Synthetic St",
  emergency_contact: {
    name: "Synthetic Guardian",
    relationship: "father",
    phone: "01000000002",
  },
  created_at: "2026-02-01T10:00:00.000000Z",
  updated_at: "2026-02-01T10:00:00.000000Z",
};

const saved = (patient: Patient = record) => ({
  ok: true,
  status: 200,
  data: patient,
});
const refused = (
  status: number,
  fieldErrors: Record<string, string[]> = {},
  message?: string,
) => ({
  ok: false,
  error: { status, fieldErrors, ...(message ? { message } : {}) },
});

const onSaved = vi.fn();
const onCancel = vi.fn();
const onFailure = vi.fn();

function form(patient: Patient = record) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messagesByLocale.en}
      timeZone="Africa/Cairo"
    >
      <PatientEditForm
        record={patient}
        today="2026-11-06"
        onSaved={onSaved}
        onCancel={onCancel}
        onFailure={onFailure}
      />
    </NextIntlClientProvider>
  );
}

const input = (label: string) =>
  screen.getByLabelText<HTMLInputElement>(new RegExp(`^${label}`, "u"));
const set = (label: string, value: string) =>
  fireEvent.change(input(label), { target: { value } });

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: t.form.save }));
    await Promise.resolve();
  });
}

beforeEach(() => {
  updatePatient.mockReset();
  readPatient.mockReset();
  updatePatient.mockResolvedValue(saved());
  onSaved.mockReset();
  onCancel.mockReset();
  onFailure.mockReset();
  success.mockReset();
  refresh.mockReset();
});
afterEach(cleanup);

describe("opening the form", () => {
  it("fills in from the record given, with no read", () => {
    render(form());

    expect(input(f.fullName).value).toBe("Synthetic Patient");
    expect(input(f.dateOfBirth).value).toBe("1990-04-12");
    expect(input(f.sex).value).toBe("female");
    expect(input(f.phone).value).toBe("01000000001");
    expect(input(f.nationalId).value).toBe("29004120100001");
    expect(input(f.address).value).toBe("12 Synthetic St");
    expect(input(f.contactName).value).toBe("Synthetic Guardian");
    expect(input(f.contactRelationship).value).toBe("father");
    expect(input(f.contactPhone).value).toBe("01000000002");
    expect(readPatient).not.toHaveBeenCalled();
  });

  it("offers no way to change the patient number", () => {
    render(form());

    expect(screen.queryByLabelText(new RegExp(`^${f.number}`, "u"))).toBeNull();
  });

  it("puts focus on the first field", async () => {
    render(form());

    await waitFor(() => expect(document.activeElement).toBe(input(f.fullName)));
  });
});

describe("what gets sent", () => {
  it("sends only what changed", async () => {
    render(form());

    set(f.phone, "010 0000-0009");
    await save();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updatePatient).toHaveBeenCalledExactlyOnceWith(
      5,
      { phone: "01000000009" },
      "en",
    );
  });

  it("sends nothing, and says so, if nothing changed", async () => {
    render(form());

    await save();

    await screen.findByText(shared.form.nothingToSave);
    expect(updatePatient).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("treats a value that normalises to the same one as no change", async () => {
    render(form());

    set(f.phone, "٠١٠ ٠٠٠٠-٠٠٠١");
    set(f.fullName, "  Synthetic Patient  ");
    await save();

    await screen.findByText(shared.form.nothingToSave);
    expect(updatePatient).not.toHaveBeenCalled();
  });

  it("sends an emptied optional detail as cleared", async () => {
    render(form());

    set(f.address, "");
    set(f.nationalId, "");
    await save();

    await waitFor(() => expect(updatePatient).toHaveBeenCalled());
    expect(updatePatient).toHaveBeenCalledWith(
      5,
      { address: null, national_id: null },
      "en",
    );
  });

  it("clears the contact when all three parts are emptied", async () => {
    render(form());

    set(f.contactName, "");
    set(f.contactRelationship, "");
    set(f.contactPhone, "");
    await save();

    await waitFor(() => expect(updatePatient).toHaveBeenCalled());
    expect(updatePatient).toHaveBeenCalledWith(
      5,
      { emergency_contact: null },
      "en",
    );
  });

  it("sends the whole contact when one part changed", async () => {
    render(form());

    set(f.contactRelationship, "uncle");
    await save();

    await waitFor(() => expect(updatePatient).toHaveBeenCalled());
    expect(updatePatient).toHaveBeenCalledWith(
      5,
      {
        emergency_contact: {
          name: "Synthetic Guardian",
          relationship: "uncle",
          phone: "01000000002",
        },
      },
      "en",
    );
  });

  it("compares with the latest record, when a new read arrived underneath", async () => {
    const view = render(form());

    view.rerender(form({ ...record, address: "9 Newer St" }));
    set(f.address, "9 Newer St");
    await save();

    await screen.findByText(shared.form.nothingToSave);
    expect(updatePatient).not.toHaveBeenCalled();
  });

  it("keeps what was typed when a new read arrives underneath", () => {
    const view = render(form());

    set(f.address, "Typed by a person");
    view.rerender(form({ ...record, address: "9 Newer St" }));

    expect(input(f.address).value).toBe("Typed by a person");
  });
});

describe("quick feedback", () => {
  it("appears for an emptied required detail, sending nothing", async () => {
    render(form());

    set(f.fullName, "   ");
    set(f.phone, "");
    await save();

    await screen.findByText(t.form.nameRequired);
    expect(screen.getByText(t.form.phoneRule)).toBeTruthy();
    expect(updatePatient).not.toHaveBeenCalled();
  });

  it("requires all of a contact, or none", async () => {
    render(form());

    set(f.contactPhone, "");
    await save();

    await screen.findByText(t.form.contactPartRequired);
    expect(updatePatient).not.toHaveBeenCalled();
  });
});

describe("when the API refuses", () => {
  it("shows each key on its field, keeping what was typed", async () => {
    updatePatient.mockResolvedValue(
      refused(422, {
        national_id: ["That ID is taken."],
        "emergency_contact.phone": ["Contact phone refused."],
      }),
    );
    render(form());

    set(f.nationalId, "29004120100009");
    await save();

    await screen.findByText("That ID is taken.");
    expect(input(f.nationalId).getAttribute("aria-invalid")).toBe("true");
    expect(input(f.nationalId).value).toBe("29004120100009");
    expect(input(f.contactPhone).getAttribute("aria-invalid")).toBe("true");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows emergency_contact and fields at form level", async () => {
    updatePatient.mockResolvedValue(
      refused(422, {
        emergency_contact: ["Contact refused."],
        fields: ["Send something."],
      }),
    );
    render(form());

    set(f.address, "New St");
    await save();

    await screen.findByText("Contact refused.");
    expect(screen.getByText("Send something.")).toBeTruthy();
  });

  it("tells the reader about a failure, which decides what to do", async () => {
    const failure = refused(403);
    updatePatient.mockResolvedValue(failure);
    render(form());

    set(f.address, "New St");
    await save();

    await waitFor(() =>
      expect(onFailure).toHaveBeenCalledExactlyOnceWith(failure.error),
    );
    expect(onSaved).not.toHaveBeenCalled();
    expect(readPatient).not.toHaveBeenCalled();
  });
});

describe("after saving", () => {
  it("hands back the returned record, confirms, and notes the change", async () => {
    const returned = { ...record, phone: "01000000009" };
    updatePatient.mockResolvedValue(saved(returned));
    const changes = changeCount();
    render(form());

    set(f.phone, "01000000009");
    await save();

    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledExactlyOnceWith(returned),
    );
    expect(changeCount()).toBe(changes + 1);
    expect(success).toHaveBeenCalledExactlyOnceWith(t.form.saved);
    expect(refresh).not.toHaveBeenCalled();
    expect(readPatient).not.toHaveBeenCalled();
  });
});

describe("cancelling", () => {
  it("sends nothing, and says so to the reader", () => {
    render(form());

    set(f.phone, "01000000009");
    fireEvent.click(screen.getByRole("button", { name: t.form.cancel }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(updatePatient).not.toHaveBeenCalled();
  });
});

describe("double submission", () => {
  it("is blocked, with progress shown", async () => {
    updatePatient.mockReturnValue(new Promise(() => undefined));
    render(form());

    set(f.phone, "01000000009");
    await save();
    const button = await screen.findByRole<HTMLButtonElement>("button", {
      name: t.form.saving,
    });
    expect(button.disabled).toBe(true);
    await act(async () => {
      fireEvent.submit(input(f.phone).closest("form") as HTMLFormElement);
      await Promise.resolve();
    });

    expect(updatePatient).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: t.form.cancel })
        .disabled,
    ).toBe(true);
  });
});
