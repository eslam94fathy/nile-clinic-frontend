import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { WalkInForm } from "./walk-in-form";

const api = vi.hoisted(() => ({ addWalkIn: vi.fn() }));
vi.mock("../api/queue", () => api);
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: (props: { href: string; children: React.ReactNode }) => (
    <a href={props.href}>{props.children}</a>
  ),
  useRouter: () => router,
}));
vi.mock("@/features/auth/public", () => ({ useHydrated: () => true }));

const patient = {
  id: 12,
  full_name: "Synthetic Patient",
  sex: "female",
  date_of_birth: "1990-04-12",
  phone: "01000000001",
};
const doctor = {
  id: 3,
  name: "Synthetic Doctor",
  title: "Consultant",
  is_active: true,
  specialties: [],
};
vi.mock("@/features/patients/public", () => ({
  PatientChooser: ({ onChoose }: { onChoose: (p: unknown) => void }) => (
    <button onClick={() => onChoose(patient)}>{"Pick patient"}</button>
  ),
  ChosenPatient: ({
    id,
    onFound,
    action,
  }: {
    id: number;
    onFound?: (p: unknown) => void;
    action?: React.ReactNode;
  }) => {
    if (onFound) queueMicrotask(() => onFound({ ...patient, id }));
    return (
      <div>
        {`Chosen ${id}`}
        {action}
      </div>
    );
  },
}));
vi.mock("@/features/doctors/public", () => ({
  DoctorChooser: ({ onChoose }: { onChoose: (d: unknown) => void }) => (
    <button onClick={() => onChoose(doctor)}>{"Pick doctor"}</button>
  ),
}));

const t = messagesByLocale.en.queue.walkInForm;

beforeEach(() => {
  api.addWalkIn.mockReset();
  toast.success.mockReset();
  router.push.mockReset();
});
afterEach(cleanup);

function setUp(carriedPatient: number | null = null, carriedInvalid = false) {
  renderWithIntl(
    <WalkInForm
      specialties={[]}
      carriedPatient={carriedPatient}
      carriedInvalid={carriedInvalid}
    />,
  );
}

const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

function choose() {
  press("Pick patient");
  press("Pick doctor");
}

describe("WalkInForm", () => {
  it("asks for a patient first, and warns before submitting", () => {
    setUp();
    expect(screen.getByText(t.choosePatientFirst)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.submit })).toBeNull();

    choose();
    expect(screen.getByText(t.permanent)).toBeTruthy();
  });

  it("sends exactly the patient and doctor, gives the number, and goes to the queue", async () => {
    api.addWalkIn.mockResolvedValue({
      ok: true,
      status: 201,
      data: { queue_number: 7 },
    });
    setUp();
    choose();
    press(t.submit);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/queue"));
    expect(api.addWalkIn).toHaveBeenCalledWith(
      { patient_id: 12, doctor_id: 3 },
      "en",
    );
    expect(toast.success).toHaveBeenCalledWith(
      t.added.replace("{number}", "7"),
    );
  });

  it("is empty when next opened, after adding", async () => {
    api.addWalkIn.mockResolvedValue({
      ok: true,
      status: 201,
      data: { queue_number: 7 },
    });
    setUp();
    choose();
    press(t.submit);

    await screen.findByText(t.choosePatientFirst);
    expect(screen.queryByText("Chosen 12")).toBeNull();
  });

  it("shows a refusal of the patient, and keeps what was chosen", async () => {
    api.addWalkIn.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { patient_id: ["Already here."] } },
    });
    setUp();
    choose();
    press(t.submit);

    await screen.findByText("Already here.");
    expect(screen.getByText("Chosen 12")).toBeTruthy();
    expect(screen.getByRole("button", { name: t.submit })).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows a refusal of the doctor", async () => {
    api.addWalkIn.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { doctor_id: ["Not active."] } },
    });
    setUp();
    choose();
    press(t.submit);

    await screen.findByText("Not active.");
  });

  it("drops nothing: a refusal under any other key shows at form level", async () => {
    api.addWalkIn.mockResolvedValue({
      ok: false,
      error: { status: 409, message: "A conflict.", fieldErrors: {} },
    });
    setUp();
    choose();
    press(t.submit);

    await screen.findByText("A conflict.");
  });

  it("says it can't tell when no answer came, with a link to the queue", async () => {
    api.addWalkIn.mockResolvedValue({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
    setUp();
    choose();
    press(t.submit);

    await screen.findByText(t.unknownOutcome);
    expect(
      screen.getByRole("link", { name: t.seeQueue }).getAttribute("href"),
    ).toBe("/queue");
    expect(api.addWalkIn).toHaveBeenCalledTimes(1);
  });

  it("starts with a carried patient", async () => {
    setUp(12);
    await screen.findByText("Chosen 12");
    expect(screen.queryByRole("button", { name: "Pick patient" })).toBeNull();
  });

  it("says so when the address can't be a patient, and offers the search", () => {
    setUp(null, true);
    expect(screen.getByRole("alert").textContent).toBe(t.patientMissing);
    expect(screen.getByRole("button", { name: "Pick patient" })).toBeTruthy();
  });
});
