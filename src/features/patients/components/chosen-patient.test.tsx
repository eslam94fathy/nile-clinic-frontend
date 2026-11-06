import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { ChosenPatient } from "./chosen-patient";

const findPatientById = vi.hoisted(() => vi.fn());
const readPatient = vi.hoisted(() => vi.fn());
vi.mock("../api/patients", () => ({ findPatientById, readPatient }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router }));
const endSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session-end", () => ({ endSession }));

const { patients: t, shared } = messagesByLocale.en;
const patient = {
  id: 5,
  full_name: "Synthetic Patient",
  sex: "female" as const,
  date_of_birth: "1990-04-12",
  phone: "01000000001",
};
const found = (...rows: (typeof patient)[]) => ({
  ok: true,
  status: 200,
  data: { data: rows, meta: {} },
});

beforeEach(() => {
  findPatientById.mockReset();
  readPatient.mockReset();
  router.refresh.mockReset();
});
afterEach(cleanup);

describe("ChosenPatient", () => {
  it("shows who it is by the list read, and never the audited one", async () => {
    findPatientById.mockResolvedValue(found(patient));
    renderWithIntl(<ChosenPatient id={5} />);

    await screen.findByText("Synthetic Patient");
    expect(screen.getByText("01000000001")).toBeTruthy();
    expect(findPatientById).toHaveBeenCalledWith(5, "en");
    expect(readPatient).not.toHaveBeenCalled();
  });

  it("reads once, even when effects repeat", async () => {
    findPatientById.mockResolvedValue(found(patient));
    renderWithIntl(
      <StrictMode>
        <ChosenPatient id={5} />
      </StrictMode>,
    );

    await screen.findByText("Synthetic Patient");
    expect(findPatientById).toHaveBeenCalledTimes(1);
  });

  it("reads nothing when the patient is already in hand", () => {
    renderWithIntl(<ChosenPatient id={5} known={patient} />);

    expect(screen.getByText("Synthetic Patient")).toBeTruthy();
    expect(findPatientById).not.toHaveBeenCalled();
  });

  it("says when nobody has that number", async () => {
    findPatientById.mockResolvedValue(found());
    renderWithIntl(<ChosenPatient id={5} />);

    expect(await screen.findByText(t.chosen.notFound)).toBeTruthy();
  });

  it("tells a screen with its own message instead", async () => {
    findPatientById.mockResolvedValue(found());
    const onMissing = vi.fn();
    renderWithIntl(<ChosenPatient id={5} onMissing={onMissing} />);

    await waitFor(() => expect(onMissing).toHaveBeenCalled());
    expect(screen.queryByText(t.chosen.notFound)).toBeNull();
  });

  it("offers to try again after a failure", async () => {
    findPatientById.mockResolvedValueOnce({
      ok: false,
      error: { status: 500, fieldErrors: {}, message: "Failed." },
    });
    findPatientById.mockResolvedValueOnce(found(patient));
    renderWithIntl(<ChosenPatient id={5} />);

    await screen.findByText("Failed.");
    fireEvent.click(screen.getByRole("button", { name: shared.states.retry }));
    await screen.findByText("Synthetic Patient");
  });

  it("removes everything on a 403, and lets the gate re-decide", async () => {
    findPatientById.mockResolvedValue({
      ok: false,
      error: { status: 403, fieldErrors: {} },
    });
    renderWithIntl(<ChosenPatient id={5} />);

    await screen.findByText(shared.states.forbiddenHeading);
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.queryByText("Synthetic Patient")).toBeNull();
  });

  it("shows the action given", () => {
    renderWithIntl(
      <ChosenPatient
        id={5}
        known={patient}
        action={<button>{"Change"}</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Change" })).toBeTruthy();
  });
});
