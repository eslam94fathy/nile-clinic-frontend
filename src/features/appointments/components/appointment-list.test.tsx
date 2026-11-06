import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import type { AppointmentSummary } from "../types";
import { AppointmentDetails } from "./appointment-details";
import { AppointmentList } from "./appointment-list";
import { AppointmentViewLinks } from "./appointment-view-links";
import { OwnAppointmentDetails } from "./own-appointment-details";
import { OwnAppointmentList } from "./own-appointment-list";

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
  usePathname: () => "/appointments",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/patients/public", () => ({
  PatientLink: ({
    id,
    children,
  }: {
    id: number;
    children: React.ReactNode;
  }) => <a href={`/patients/${id}`}>{children}</a>,
}));

afterEach(cleanup);

const t = messagesByLocale.en.appointments;
const { status } = messagesByLocale.en.shared;

const row: AppointmentSummary = {
  id: 7,
  date: "2026-11-08",
  start: "09:20",
  end: "24:00",
  status: "scheduled",
  outside_availability: false,
  doctor: { id: 3, name: "Synthetic Doctor", title: "Consultant" },
  patient: { id: 12, full_name: "Synthetic Patient", phone: "01000000001" },
};
const meta = (total: number) => ({
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total,
  from: total ? 1 : null,
  to: total || null,
});
const found = (...rows: AppointmentSummary[]) => ({
  ok: true as const,
  status: 200,
  data: { data: rows, meta: meta(rows.length) },
});
const range = { from: "2026-11-07", to: "2026-11-07" };

function list(
  result: ComponentProps<typeof AppointmentList>["result"],
  filters = {},
) {
  return renderWithIntl(
    <AppointmentList
      result={result}
      filters={filters}
      range={range}
      doctors={[
        {
          id: 3,
          name: "Synthetic Doctor",
          title: "Consultant",
          is_active: true,
        },
        {
          id: 4,
          name: "Synthetic Former",
          title: "Consultant",
          is_active: false,
        },
      ]}
    />,
  );
}

describe("AppointmentList", () => {
  it("shows a row's fields, with times as sent, linking without prefetch", () => {
    list(found(row));

    const table = within(screen.getByRole("table"));
    expect(table.getByText("Synthetic Patient")).toBeTruthy();
    expect(table.getByText("01000000001")).toBeTruthy();
    expect(table.getByText(status.appointment.scheduled)).toBeTruthy();
    const link = table.getByRole("link");
    expect(link.textContent).toBe("09:20 – 24:00");
    expect(link.getAttribute("href")).toBe("/appointments/7");
    expect(link.getAttribute("data-prefetch")).toBe("false");
  });

  it("labels one outside availability in words", () => {
    list(found({ ...row, outside_availability: true }));
    expect(
      within(screen.getByRole("table")).getByText(t.outsideLabel),
    ).toBeTruthy();
  });

  it("shows the range being read, even with none in the address", () => {
    list(found(row));
    expect(screen.getByLabelText<HTMLInputElement>(t.fields.from).value).toBe(
      range.from,
    );
  });

  it("marks inactive doctors in the filter", () => {
    list(found(row));
    expect(
      screen.getByRole("option", {
        name: t.filters.inactiveDoctor.replace("{name}", "Synthetic Former"),
      }),
    ).toBeTruthy();
  });

  it("says nothing is booked today, offering to book", () => {
    list(found());
    expect(screen.getByText(t.empty.todayTitle)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: t.book }).getAttribute("href"),
    ).toBe("/appointments/new");
  });

  it("says nothing matches, offering to book that patient", () => {
    list(found(), { patient_id: "12" });
    expect(screen.getByText(t.empty.filteredTitle)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: t.book }).getAttribute("href"),
    ).toBe("/appointments/new?patient_id=12");
  });

  it("says nothing needs moving", () => {
    list(found(), { outside_availability: "1" });
    expect(screen.getByText(t.empty.moveTitle)).toBeTruthy();
    expect(screen.queryByRole("link", { name: t.book })).toBeNull();
  });

  it("shows a refusal on its filter, keeping the bar", () => {
    list({
      ok: false,
      error: { status: 422, fieldErrors: { to: ["Too long."] } },
    });
    expect(screen.getByText("Too long.")).toBeTruthy();
    expect(
      screen.getByLabelText(t.fields.to).getAttribute("aria-invalid"),
    ).toBe("true");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows a refusal with no filter of its own at form level", () => {
    list({
      ok: false,
      error: { status: 422, fieldErrors: { patient_id: ["Not valid."] } },
    });
    expect(screen.getByRole("alert").textContent).toBe("Not valid.");
  });

  it("drops no refusal, even with no keys", () => {
    list({
      ok: false,
      error: { status: 422, fieldErrors: {}, message: "Refused." },
    });
    expect(screen.getByRole("alert").textContent).toBe("Refused.");
  });

  it("shows only the forbidden state on a 403", () => {
    list({ ok: false, error: { status: 403, fieldErrors: {} } });
    expect(
      screen.getByText(messagesByLocale.en.shared.states.forbiddenHeading),
    ).toBeTruthy();
    expect(screen.queryByLabelText(t.fields.from)).toBeNull();
  });
});

describe("AppointmentViewLinks", () => {
  it("drops the dates and keeps the doctor and patient", () => {
    renderWithIntl(
      <AppointmentViewLinks
        filters={{
          from: "2026-01-01",
          to: "2026-01-02",
          doctor_id: "3",
          patient_id: "12",
          status: "scheduled",
        }}
      />,
    );

    expect(
      screen
        .getByRole("link", { name: t.views.needingMove })
        .getAttribute("href"),
    ).toBe("/appointments?doctor_id=3&patient_id=12&outside_availability=1");
    expect(
      screen.getByRole("link", { name: t.views.all }).getAttribute("href"),
    ).toBe("/appointments?doctor_id=3&patient_id=12");
  });

  it("marks where the person is, and never asks for the opposite", () => {
    renderWithIntl(
      <AppointmentViewLinks filters={{ outside_availability: "1" }} />,
    );

    expect(
      screen
        .getByRole("link", { name: t.views.needingMove })
        .getAttribute("aria-current"),
    ).toBe("page");
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toContain("outside_availability=0");
    }
  });
});

const appointment = {
  ...row,
  note: null,
  booked_by: { id: 1, name: "Synthetic Staff" },
  booked_at: "2026-11-05T14:22:31.000000Z",
  rescheduled_by: null,
  rescheduled_at: null,
  status_changed_by: null,
  status_changed_at: null,
  cancellation_reason: null,
};

describe("AppointmentDetails", () => {
  const details = (changes = {}) =>
    renderWithIntl(
      <AppointmentDetails
        appointment={{ ...appointment, ...changes }}
        timeZone="Africa/Cairo"
      />,
    );

  it("shows times as sent, and instants in the clinic's zone", () => {
    details();
    expect(screen.getByText("24:00")).toBeTruthy();
    // 14:22 UTC is 16:22 in Cairo.
    expect(document.body.textContent).toContain("4:22");
  });

  it("says what wasn't recorded", () => {
    details({ booked_by: null });
    expect(screen.getAllByText(t.details.notRecorded)).toHaveLength(2);
  });

  it("leaves out history that didn't happen", () => {
    details();
    expect(screen.queryByText(t.details.rescheduledAt)).toBeNull();
    expect(screen.queryByText(t.details.statusChangedAt)).toBeNull();
    expect(screen.queryByText(t.details.cancellationReason)).toBeNull();
  });

  it("shows history that did, with the reason as written", () => {
    details({
      status: "cancelled",
      rescheduled_by: { id: 1, name: "Synthetic Mover" },
      rescheduled_at: "2026-11-05T14:22:31+00:00",
      status_changed_by: { id: 2, name: "Synthetic Canceller" },
      status_changed_at: "2026-11-05T14:22:31.000000Z",
      cancellation_reason: "المريض مسافر",
    });
    expect(screen.getByText("Synthetic Mover")).toBeTruthy();
    expect(screen.getByText("Synthetic Canceller")).toBeTruthy();
    expect(screen.getByText("المريض مسافر").getAttribute("dir")).toBe("auto");
  });

  it("links the patient only through the record's own link", () => {
    details();
    expect(
      screen
        .getByRole("link", { name: "Synthetic Patient" })
        .getAttribute("href"),
    ).toBe("/patients/12");
  });
});

const ownRow = {
  id: 7,
  date: "2026-11-08",
  start: "09:20",
  end: "09:40",
  status: "scheduled" as const,
  outside_availability: true,
  patient: {
    id: 12,
    full_name: "Synthetic Patient",
    sex: "female" as const,
    date_of_birth: "1990-04-12",
  },
};

describe("a doctor's views", () => {
  it("list what's sent, with no phone, patient link, or action", () => {
    renderWithIntl(
      <OwnAppointmentList
        result={{
          ok: true,
          status: 200,
          data: { data: [ownRow], meta: meta(1) },
        }}
        filters={{}}
        range={range}
      />,
    );

    const table = within(screen.getByRole("table"));
    expect(table.getByText("Synthetic Patient")).toBeTruthy();
    expect(table.getByText("1990-04-12")).toBeTruthy();
    expect(table.getByText(t.outsideLabel)).toBeTruthy();
    expect(table.getAllByRole("link")).toHaveLength(1);
    expect(table.getByRole("link").getAttribute("href")).toBe(
      "/my/appointments/7",
    );
    expect(screen.queryByRole("button", { name: t.book })).toBeNull();
    expect(screen.queryByLabelText(t.fields.doctor)).toBeNull();
  });

  it("say why a list is empty", () => {
    const empty = {
      ok: true as const,
      status: 200,
      data: { data: [], meta: meta(0) },
    };
    renderWithIntl(
      <OwnAppointmentList result={empty} filters={{}} range={range} />,
    );
    expect(screen.getByText(t.own.emptyTodayTitle)).toBeTruthy();
    cleanup();

    renderWithIntl(
      <OwnAppointmentList
        result={empty}
        filters={{ status: "cancelled" }}
        range={range}
      />,
    );
    expect(screen.getByText(t.own.emptyFilteredTitle)).toBeTruthy();
  });

  it("show one appointment with no link and no phone", () => {
    renderWithIntl(
      <OwnAppointmentDetails
        appointment={{
          ...ownRow,
          note: "First visit",
          booked_at: "2026-11-05T14:22:31.000000Z",
        }}
        timeZone="Africa/Cairo"
      />,
    );

    expect(screen.getByText("First visit")).toBeTruthy();
    expect(screen.getByText(t.sex.female)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(document.body.textContent).not.toContain("0100000");
  });
});
