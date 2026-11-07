import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { type ComponentProps, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { BookingForm } from "./booking-form";

const bookAppointment = vi.hoisted(() => vi.fn());
vi.mock("../api/appointments", () => ({ bookAppointment }));

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
  useRouter: () => router,
}));
vi.mock("@/features/auth/public", () => ({ useHydrated: () => true }));

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

// The choosers and free times have tests of their own. Here they only hand back a choice.
const patient = {
  id: 12,
  full_name: "Synthetic Patient",
  sex: "female" as const,
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
const reading = vi.hoisted(() => ({ answers: true }));
vi.mock("@/features/patients/public", () => ({
  ChosenPatient: ({
    id,
    known,
    action,
    onFound,
    onMissing,
  }: {
    id: number;
    known?: unknown;
    action: React.ReactNode;
    onFound: (found: typeof patient) => void;
    onMissing: () => void;
  }) => {
    useEffect(() => {
      if (!known && reading.answers) onFound({ ...patient, id });
      // Once, as the real one reads once.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <div>
        <span>{`Chosen patient ${id}`}</span>
        {action}
        <button onClick={onMissing}>{"Report missing"}</button>
      </div>
    );
  },
  PatientChooser: ({
    onChoose,
  }: {
    onChoose: (chosen: typeof patient) => void;
  }) => <button onClick={() => onChoose(patient)}>{"Pick patient"}</button>,
}));
vi.mock("@/features/doctors/public", () => ({
  DoctorChooser: ({
    onChoose,
  }: {
    onChoose: (chosen: typeof doctor) => void;
  }) => <button onClick={() => onChoose(doctor)}>{"Pick doctor"}</button>,
}));
const freeTimes = vi.hoisted(() => ({ signal: 0 }));
vi.mock("@/features/scheduling/public", () => ({
  FreeTimes: ({
    value,
    onChange,
    refreshSignal,
    error,
  }: {
    value: { start: string } | null;
    onChange: (time: { date: string; start: string } | null) => void;
    refreshSignal: number;
    error?: string;
  }) => {
    freeTimes.signal = refreshSignal;
    return (
      <div>
        <span>{`Time: ${value?.start ?? "none"}`}</span>
        {error ? <span>{`Time error: ${error}`}</span> : null}
        <button
          onClick={() => onChange({ date: "2026-11-08", start: "09:20" })}
        >
          {"Pick time"}
        </button>
      </div>
    );
  },
}));

const t = messagesByLocale.en.appointments.booking;

beforeEach(() => {
  bookAppointment.mockReset();
  router.push.mockReset();
  router.refresh.mockReset();
  toast.success.mockReset();
  freeTimes.signal = 0;
  reading.answers = true;
});
afterEach(cleanup);

function setUp(props: Partial<ComponentProps<typeof BookingForm>> = {}) {
  return renderWithIntl(
    <BookingForm
      today="2026-11-07"
      specialties={[]}
      carriedPatient={null}
      carriedInvalid={false}
      {...props}
    />,
  );
}

function chooseAll() {
  fireEvent.click(screen.getByRole("button", { name: "Pick patient" }));
  fireEvent.click(screen.getByRole("button", { name: "Pick doctor" }));
  fireEvent.click(screen.getByRole("button", { name: "Pick time" }));
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: t.submit }));

const refuse = (error: object) =>
  bookAppointment.mockResolvedValue({
    ok: false,
    error: { fieldErrors: {}, ...error },
  });

describe("BookingForm", () => {
  it("offers each part only once the part before is done", () => {
    setUp();

    expect(screen.getByText(t.chooseDoctorFirst)).toBeTruthy();
    expect(screen.getByText(t.chooseTimeFirst)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pick doctor" })).toBeNull();
    expect(screen.queryByRole("button", { name: t.submit })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Pick patient" }));
    expect(screen.getByRole("button", { name: "Pick doctor" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.submit })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Pick doctor" }));
    expect(screen.getByRole("button", { name: t.submit })).toBeTruthy();
  });

  it("starts with a carried patient", () => {
    setUp({ carriedPatient: 12 });
    expect(screen.getByText("Chosen patient 12")).toBeTruthy();
  });

  it("says when a carried value can't be anyone, and offers the search", () => {
    setUp({ carriedInvalid: true });
    expect(screen.getByRole("alert").textContent).toBe(t.patientMissing);
    expect(screen.getByRole("button", { name: "Pick patient" })).toBeTruthy();
  });

  it("falls back to the search when a carried number finds nobody", () => {
    setUp({ carriedPatient: 12 });
    fireEvent.click(screen.getByRole("button", { name: "Report missing" }));
    expect(screen.getByText(t.patientMissing)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pick patient" })).toBeTruthy();
  });

  it("books what was chosen, trimming the note, and moves to the appointment", async () => {
    bookAppointment.mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: 7 },
    });
    setUp();
    chooseAll();
    fireEvent.change(screen.getByLabelText(t.noteLabel), {
      target: { value: "  First visit " },
    });
    submit();

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/appointments/7"),
    );
    expect(bookAppointment).toHaveBeenCalledWith(
      {
        patient_id: 12,
        doctor_id: 3,
        date: "2026-11-08",
        start: "09:20",
        note: "First visit",
      },
      "en",
    );
    expect(toast.success).toHaveBeenCalledWith(t.booked);
    expect(router.refresh).toHaveBeenCalled();
    // Empty when next visited, as this page stays held.
    expect(screen.getByRole("button", { name: "Pick patient" })).toBeTruthy();
    expect(screen.queryByText("Chosen patient 12")).toBeNull();
  });

  it("goes back to the carried patient after a booking", async () => {
    bookAppointment.mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: 7 },
    });
    setUp({ carriedPatient: 12 });
    fireEvent.click(screen.getByRole("button", { name: "Pick doctor" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick time" }));
    submit();

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(screen.getByText("Chosen patient 12")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pick doctor" })).toBeTruthy();
  });

  it("leaves an empty note out", async () => {
    bookAppointment.mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: 7 },
    });
    setUp();
    chooseAll();
    submit();

    await waitFor(() => expect(bookAppointment).toHaveBeenCalled());
    expect(bookAppointment.mock.calls[0]?.[0]).not.toHaveProperty("note");
  });

  it("needs a time", async () => {
    setUp();
    fireEvent.click(screen.getByRole("button", { name: "Pick patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick doctor" }));
    submit();

    expect(await screen.findByText(`Time error: ${t.chooseTime}`)).toBeTruthy();
    expect(bookAppointment).not.toHaveBeenCalled();
  });

  it("checks the note's length before sending", async () => {
    setUp();
    chooseAll();
    fireEvent.change(screen.getByLabelText(t.noteLabel), {
      target: { value: "x".repeat(501) },
    });
    submit();

    expect(await screen.findByText(t.noteTooLong)).toBeTruthy();
    expect(bookAppointment).not.toHaveBeenCalled();
  });

  it("shows the note's hint, and asks the browser not to remember", () => {
    setUp();
    chooseAll();

    expect(
      screen.getByText(messagesByLocale.en.shared.form.noMedicalDetails),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(t.noteLabel).getAttribute("autocomplete"),
    ).toBe("off");
  });

  it("on a taken time: shows why, reads again, clears the time, keeps the rest", async () => {
    refuse({
      status: 409,
      reason: "slot_booked",
      message: "This slot is already booked.",
    });
    setUp();
    chooseAll();
    fireEvent.change(screen.getByLabelText(t.noteLabel), {
      target: { value: "First visit" },
    });
    submit();

    expect(
      await screen.findByText("This slot is already booked."),
    ).toBeTruthy();
    expect(screen.getByText("Time: none")).toBeTruthy();
    expect(freeTimes.signal).toBe(1);
    expect(screen.getByText("Chosen patient 12")).toBeTruthy();
    expect(screen.getByText("Synthetic Doctor")).toBeTruthy();
    expect(screen.getByLabelText<HTMLTextAreaElement>(t.noteLabel).value).toBe(
      "First visit",
    );
    expect(screen.queryByRole("link", { name: t.seePatient })).toBeNull();
  });

  it("on a busy patient: also links to their appointments that day", async () => {
    refuse({
      status: 409,
      reason: "patient_busy",
      message: "This patient already has an appointment at this time.",
    });
    setUp();
    chooseAll();
    submit();

    const link = await screen.findByRole("link", { name: t.seePatient });
    expect(link.getAttribute("href")).toBe(
      "/appointments?patient_id=12&from=2026-11-08&to=2026-11-08",
    );
    expect(link.getAttribute("data-prefetch")).toBe("false");
    expect(freeTimes.signal).toBe(1);
  });

  it("on a refused time: shows it on the free times, and reads again", async () => {
    refuse({
      status: 422,
      fieldErrors: { start: ["This time is not an available slot."] },
    });
    setUp();
    chooseAll();
    submit();

    expect(
      await screen.findByText(
        "Time error: This time is not an available slot.",
      ),
    ).toBeTruthy();
    expect(freeTimes.signal).toBe(1);
  });

  it("on a refused patient or doctor: shows it there, and keeps the time", async () => {
    refuse({
      status: 422,
      fieldErrors: {
        patient_id: ["No patient was found."],
        doctor_id: ["No doctor was found."],
      },
    });
    setUp();
    chooseAll();
    submit();

    expect(await screen.findByText("No patient was found.")).toBeTruthy();
    expect(screen.getByText("No doctor was found.")).toBeTruthy();
    expect(screen.getByText("Time: 09:20")).toBeTruthy();
    expect(freeTimes.signal).toBe(0);
  });

  it("shows a refusal with no field at form level", async () => {
    refuse({ status: 422, fieldErrors: { other: ["Something else."] } });
    setUp();
    chooseAll();
    submit();

    expect(await screen.findByText("Something else.")).toBeTruthy();
  });

  for (const status of [0, 502, 503]) {
    it(`says it can't tell on status ${status}, and links to the patient's appointments`, async () => {
      refuse({ status });
      setUp();
      chooseAll();
      submit();

      expect(await screen.findByText(t.unknownOutcome)).toBeTruthy();
      expect(
        screen
          .getByRole("link", { name: t.seeAppointments })
          .getAttribute("href"),
      ).toBe("/appointments?patient_id=12");
      expect(
        screen.queryByText(messagesByLocale.en.shared.form.generalFailure),
      ).toBeNull();
    });
  }

  it("treats a 500 as not saved, with no such claim", async () => {
    refuse({ status: 500, message: "Something went wrong." });
    setUp();
    chooseAll();
    submit();

    expect(await screen.findByText("Something went wrong.")).toBeTruthy();
    expect(screen.queryByText(t.unknownOutcome)).toBeNull();
  });

  it("sends one request, however many presses", async () => {
    let answer: (value: unknown) => void = () => {};
    bookAppointment.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    setUp();
    chooseAll();
    submit();
    const working = await screen.findByRole("button", { name: t.submitting });
    expect(working.hasAttribute("disabled")).toBe(true);
    fireEvent.click(working);
    expect(bookAppointment).toHaveBeenCalledTimes(1);

    answer({ ok: true, status: 201, data: { id: 7 } });
    await waitFor(() => expect(router.push).toHaveBeenCalled());
  });

  it("changing the doctor clears the time", () => {
    setUp();
    chooseAll();
    expect(screen.getByText("Time: 09:20")).toBeTruthy();

    const change = screen.getAllByRole("button", { name: t.change });
    fireEvent.click(change[change.length - 1] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Pick doctor" }));
    expect(screen.getByText("Time: none")).toBeTruthy();
  });
});

describe("BookingForm, keeping attempts with the right person", () => {
  const change = (which: 0 | 1) =>
    fireEvent.click(screen.getAllByRole("button", { name: t.change })[which]!);

  it("offers no further step until a carried patient is known", () => {
    reading.answers = false;
    setUp({ carriedPatient: 12 });

    expect(screen.getByText("Chosen patient 12")).toBeTruthy();
    expect(screen.getByText(t.chooseDoctorFirst)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pick doctor" })).toBeNull();
  });

  it("still knows a carried patient after booking, as the page stays held", async () => {
    bookAppointment.mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: 7 },
    });
    setUp({ carriedPatient: 12 });
    fireEvent.click(screen.getByRole("button", { name: "Pick doctor" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick time" }));
    submit();

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Pick doctor" })).toBeTruthy();
  });

  it.each([
    ["the patient", 0 as const, "Pick patient"],
    ["the doctor", 1 as const, "Pick doctor"],
  ])(
    "changing %s drops an unknown outcome, and its link",
    async (_, which, pick) => {
      refuse({ status: 502 });
      setUp();
      chooseAll();
      submit();
      await screen.findByText(t.unknownOutcome);

      change(which);
      fireEvent.click(screen.getByRole("button", { name: pick }));

      expect(screen.queryByText(t.unknownOutcome)).toBeNull();
      expect(
        screen.queryByRole("link", { name: t.seeAppointments }),
      ).toBeNull();
    },
  );

  it("changing the patient drops a refusal about the last one", async () => {
    refuse({
      status: 409,
      reason: "patient_busy",
      message: "This patient already has an appointment at this time.",
    });
    setUp();
    chooseAll();
    submit();
    await screen.findByRole("link", { name: t.seePatient });

    change(0);
    fireEvent.click(screen.getByRole("button", { name: "Pick patient" }));

    expect(
      screen.queryByText(
        "This patient already has an appointment at this time.",
      ),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: t.seePatient })).toBeNull();
  });

  it("moves focus to the next step, as the button pressed is gone", () => {
    setUp();
    const focused = () => document.activeElement?.textContent;

    fireEvent.click(screen.getByRole("button", { name: "Pick patient" }));
    expect(focused()).toBe(t.doctorStep);

    fireEvent.click(screen.getByRole("button", { name: "Pick doctor" }));
    expect(focused()).toBe(t.timeStep);

    change(1);
    expect(focused()).toBe(t.doctorStep);

    change(0);
    expect(focused()).toBe(t.patientStep);
  });
});
