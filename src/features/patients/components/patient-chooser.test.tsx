import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { PatientChooser } from "./patient-chooser";

const searchPatients = vi.hoisted(() => vi.fn());
const readPatient = vi.hoisted(() => vi.fn());
vi.mock("../api/patients", () => ({ searchPatients, readPatient }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
  usePathname: () => "/appointments/new",
  useRouter: () => router,
}));

const { patients: t } = messagesByLocale.en;
const patient = {
  id: 5,
  full_name: "Synthetic Patient",
  sex: "female" as const,
  date_of_birth: "1990-04-12",
  phone: "01000000001",
};
const page = (...rows: (typeof patient)[]) => ({
  ok: true,
  status: 200,
  data: {
    data: rows,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 15,
      total: rows.length,
      from: rows.length ? 1 : null,
      to: rows.length || null,
    },
  },
});

beforeEach(() => {
  searchPatients.mockReset();
  readPatient.mockReset();
  router.push.mockReset();
});
afterEach(cleanup);

async function search(term: string) {
  fireEvent.change(screen.getByLabelText(t.fields.fullName), {
    target: { value: term },
  });
  fireEvent.click(screen.getByRole("button", { name: t.search.button }));
  await screen.findByRole("table");
}

describe("PatientChooser", () => {
  it("asks for nothing until someone searches", () => {
    renderWithIntl(<PatientChooser onChoose={() => {}} />);
    expect(searchPatients).not.toHaveBeenCalled();
    expect(screen.getByText(t.search.promptDescription)).toBeTruthy();
  });

  it("needs a term, as an empty search would list everyone", () => {
    renderWithIntl(<PatientChooser onChoose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: t.search.button }));
    expect(screen.getByText(t.search.needTerm)).toBeTruthy();
    expect(searchPatients).not.toHaveBeenCalled();
  });

  it("lists matches with no link to a record, and hands back the choice", async () => {
    searchPatients.mockResolvedValue(page(patient));
    const onChoose = vi.fn();
    renderWithIntl(<PatientChooser onChoose={onChoose} />);
    await search("Synthetic");

    expect(
      screen.queryByRole("link", { name: "Synthetic Patient" }),
    ).toBeNull();
    fireEvent.click(
      screen.getAllByRole("button", {
        name: t.chooser.chooseNamed.replace("{name}", "Synthetic Patient"),
      })[0] as HTMLElement,
    );

    expect(onChoose).toHaveBeenCalledWith(patient);
    expect(readPatient).not.toHaveBeenCalled();
  });

  it("offers to register when nobody matches", async () => {
    searchPatients.mockResolvedValue(page());
    renderWithIntl(<PatientChooser onChoose={() => {}} />);
    fireEvent.change(screen.getByLabelText(t.fields.fullName), {
      target: { value: "Nobody" },
    });
    fireEvent.click(screen.getByRole("button", { name: t.search.button }));

    const register = await screen.findByRole("link", { name: t.register });
    expect(register.getAttribute("href")).toBe("/patients/new");
    expect(register.getAttribute("data-prefetch")).toBe("false");
  });

  it("converts Arabic digits, and asks the browser not to remember", async () => {
    searchPatients.mockResolvedValue(page(patient));
    renderWithIntl(<PatientChooser onChoose={() => {}} />);

    const field = screen.getByLabelText(t.fields.number);
    expect(field.getAttribute("autocomplete")).toBe("off");
    fireEvent.change(field, { target: { value: "٥" } });
    fireEvent.click(screen.getByRole("button", { name: t.search.button }));
    await screen.findByRole("table");

    expect(searchPatients.mock.calls[0]?.[0]).toMatchObject({ id: "5" });
  });

  it("shows the API's refusal on its field", async () => {
    searchPatients.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: { phone: ["The phone number is not valid."] },
      },
    });
    renderWithIntl(<PatientChooser onChoose={() => {}} />);
    fireEvent.change(screen.getByLabelText(t.fields.phone), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: t.search.button }));

    expect(
      await screen.findByText("The phone number is not valid."),
    ).toBeTruthy();
  });
});
