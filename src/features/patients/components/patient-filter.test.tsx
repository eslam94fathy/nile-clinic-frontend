import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { PatientFilter } from "./patient-filter";

const findPatientById = vi.hoisted(() => vi.fn());
const readPatient = vi.hoisted(() => vi.fn());
const searchPatients = vi.hoisted(() => vi.fn());
vi.mock("../api/patients", () => ({
  findPatientById,
  readPatient,
  searchPatients,
}));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const search = vi.hoisted(() => ({ value: "from=2026-11-01&to=2026-11-07" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/charges",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const { patients: t } = messagesByLocale.en;
const HEADING = "Showing this patient's synthetic things";
const found = {
  ok: true,
  status: 200,
  data: {
    data: [
      {
        id: 5,
        full_name: "Synthetic Patient",
        sex: "female",
        date_of_birth: "1990-04-12",
        phone: "01000000001",
      },
    ],
    meta: {},
  },
};

beforeEach(() => {
  findPatientById.mockReset();
  readPatient.mockReset();
  router.push.mockReset();
  search.value = "from=2026-11-01&to=2026-11-07&status=paid&page=3";
});
afterEach(cleanup);

describe("PatientFilter", () => {
  it("offers to choose a patient when none is chosen", () => {
    renderWithIntl(<PatientFilter heading={HEADING} />);

    fireEvent.click(screen.getByRole("button", { name: t.filter.open }));
    expect(screen.getByRole("button", { name: t.filter.close })).toBeTruthy();
    expect(readPatient).not.toHaveBeenCalled();
  });

  it("shows the chosen patient under the list's own heading, read from the list only", async () => {
    findPatientById.mockResolvedValue(found);
    renderWithIntl(<PatientFilter value="5" heading={HEADING} />);

    expect(screen.getByText(HEADING)).toBeTruthy();
    await screen.findByText("Synthetic Patient");
    expect(readPatient).not.toHaveBeenCalled();
  });

  it("clears the patient, the dates, and the page, keeping the other filters", async () => {
    findPatientById.mockResolvedValue(found);
    renderWithIntl(<PatientFilter value="5" heading={HEADING} />);

    const clear = await screen.findByRole("link", { name: t.filter.clear });
    expect(clear.getAttribute("href")).toBe("/charges?status=paid");
  });

  it("says nobody is chosen for a number that can't be one, and reads nothing", () => {
    renderWithIntl(<PatientFilter value="abc" heading={HEADING} />);

    expect(screen.getByText(t.chosen.notFound)).toBeTruthy();
    expect(findPatientById).not.toHaveBeenCalled();
    expect(readPatient).not.toHaveBeenCalled();
  });
});
