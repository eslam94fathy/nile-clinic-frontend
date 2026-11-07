import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import type { QueueEntry } from "../types";
import { actionMarker, QueueGroup } from "./queue-group";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));
vi.mock("@/features/patients/public", () => ({
  PatientLink: ({ id, children }: { id: number; children: ReactNode }) => (
    <a data-patient-link={id}>{children}</a>
  ),
}));

afterEach(cleanup);

const t = messagesByLocale.en.queue;

const entry: QueueEntry = {
  id: 5,
  queue_number: 3,
  status: "waiting",
  walk_in: false,
  arrived_at: "2026-11-07T08:00:00.000000Z",
  called_at: null,
  finished_at: null,
  left_at: null,
  appointment: { id: 7, start: "09:20", end: "24:00" },
  doctor: { id: 3, name: "Synthetic Doctor", title: "Consultant" },
  patient: { id: 12, full_name: "Synthetic Patient", phone: "01000000001" },
};

function setUp(changes: Partial<QueueEntry> = {}) {
  const onAction = vi.fn();
  renderWithIntl(
    <QueueGroup
      group={{ doctor: entry.doctor, entries: [{ ...entry, ...changes }] }}
      timeZone="Africa/Cairo"
      onAction={onAction}
    />,
  );
  return { onAction };
}

describe("QueueGroup", () => {
  it("heads the rows with the doctor, and names the table", () => {
    setUp();
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain(
      "Synthetic Doctor",
    );
    expect(
      screen.getByRole("table", {
        name: t.caption.replace("{doctor}", "Synthetic Doctor"),
      }),
    ).toBeTruthy();
  });

  it("gives the number, patient, and appointment as sent, including an end of 24:00", () => {
    setUp();
    const table = within(screen.getByRole("table"));
    expect(table.getByRole("cell", { name: "3" })).toBeTruthy();
    expect(table.getByText("Synthetic Patient")).toBeTruthy();
    expect(table.getByText("01000000001")).toBeTruthy();

    const link = table.getByRole("link", { name: "09:20 – 24:00" });
    expect(link.getAttribute("href")).toBe("/appointments/7");
    expect(link.getAttribute("data-prefetch")).toBe("false");
  });

  it("links the patient only through the link that records a click", () => {
    setUp();
    const table = within(screen.getByRole("table"));
    expect(
      table
        .getByText("Synthetic Patient")
        .closest("a")
        ?.getAttribute("data-patient-link"),
    ).toBe("12");
  });

  it("labels a walk-in, with no appointment link", () => {
    setUp({ appointment: null, walk_in: true });
    const table = within(screen.getByRole("table"));
    expect(table.getByText(t.walkIn)).toBeTruthy();
    expect(table.queryByRole("button", { name: t.undo.action })).toBeNull();
  });

  it("gives times only where they exist", () => {
    setUp();
    const table = within(screen.getByRole("table"));
    expect(table.queryByText(new RegExp(t.times.called))).toBeNull();
    cleanup();

    setUp({ status: "seen", called_at: "2026-11-07T08:10:00.000000Z" });
    expect(
      within(screen.getByRole("table")).getByText(new RegExp(t.times.called)),
    ).toBeTruthy();
  });

  it("says which entry and action a button is for, and leaves the rest to the dialog", () => {
    const { onAction } = setUp();
    const table = within(screen.getByRole("table"));
    const left = table.getByRole("button", { name: t.left.action });

    expect(left.getAttribute("data-entry-action")).toBe(
      actionMarker(5, "mark_left"),
    );
    fireEvent.click(left);
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5 }),
      "mark_left",
    );
  });

  it("offers nothing on a row that isn't waiting", () => {
    setUp({ status: "with_doctor" });
    expect(within(screen.getByRole("table")).queryByRole("button")).toBeNull();
  });
});
