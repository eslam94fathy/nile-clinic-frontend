import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { syntheticEntry } from "../test-support";
import type { AuditEntry as Entry } from "../types";
import { AuditEntry } from "./audit-entry";

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
    <a href={`/patients/${String(id)}`} data-audited="true">
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const en = messagesByLocale.en;
const t = en.audit;

function show(entry: Entry, locale: "en" | "ar" = "en") {
  renderWithIntl(<AuditEntry entry={entry} timeZone="Africa/Cairo" />, locale);
  return screen.getByRole("article");
}

/** The value beside a label in the entry's details. */
function detail(article: HTMLElement, label: string) {
  const term = within(article).getByText(label, { selector: "dt" });
  const value = term.nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No value for ${label}`);
  return value;
}

describe("the summary", () => {
  it("gives the time with seconds in the clinic's zone, the action, and the outcome in words", () => {
    const article = show(syntheticEntry());

    // 22:30:07 UTC is 00:30:07 the next day in Cairo.
    expect(within(article).getByText(/Nov 6, 2026.*12:30:07/)).toBeTruthy();
    expect(within(article).getByRole("heading").textContent).toBe(
      t.actions.discount.set,
    );
    expect(within(article).getByText(t.outcomes.succeeded)).toBeTruthy();
  });

  it("marks a refusal in words", () => {
    const article = show(syntheticEntry({ outcome: "refused" }));
    const badge = within(article).getByText(t.outcomes.refused);
    expect(badge.getAttribute("data-tone")).toBe("warning");
  });
});

describe("who acted", () => {
  it("names a staff member as stored, with the role they held then", () => {
    const article = show(syntheticEntry());
    const who = detail(article, t.entry.who);

    expect(within(who).getByRole("link").getAttribute("href")).toBe("/staff/3");
    expect(within(who).getByRole("link").textContent).toBe("Synthetic Admin");
    expect(who.textContent).toContain(
      t.actors.roleAtTime.replace("{role}", en.roles.administrator),
    );
  });

  it("names the system and an unknown sign-in in words", () => {
    show(
      syntheticEntry({
        actor: { type: "system", id: null, name: null, role: null },
      }),
    );
    expect(screen.getByText(t.actors.system)).toBeTruthy();
    cleanup();

    show(
      syntheticEntry({
        action: "auth.sign_in",
        outcome: "refused",
        actor: { type: "unknown", id: null, name: null, role: null },
      }),
    );
    expect(screen.getByText(t.actors.unknown)).toBeTruthy();
    expect(screen.queryByText(t.entry.targetedAccount)).toBeNull();
  });

  it("says a refused sign-in's account is the one targeted", () => {
    show(
      syntheticEntry({
        action: "auth.sign_in",
        outcome: "refused",
        subject: { type: "staff_member", id: 3 },
        changes: null,
      }),
    );
    expect(screen.getByText(t.entry.targetedAccount)).toBeTruthy();
  });
});

describe("the details", () => {
  it("gives the record, patient, and address", () => {
    const article = show(syntheticEntry());

    const record = detail(article, t.entry.record);
    expect(record.textContent).toContain(t.subjects.charge);
    expect(within(record).getByRole("link").getAttribute("href")).toBe(
      "/charges/57",
    );
    const patient = within(detail(article, t.entry.patient)).getByRole("link");
    expect(patient.getAttribute("data-audited")).toBe("true");
    expect(patient.textContent).toBe("12");
    expect(detail(article, t.entry.address).textContent).toBe("203.0.113.10");
  });

  it("says None for each absent detail", () => {
    const article = show(
      syntheticEntry({
        subject: null,
        patient_id: null,
        network_address: null,
        changes: null,
      }),
    );
    for (const label of [
      t.entry.record,
      t.entry.patient,
      t.entry.address,
      t.entry.changed,
    ]) {
      expect(detail(article, label).textContent).toBe(t.entry.none);
    }
  });

  it("lists every field changed, with before and after for the kept ones", () => {
    const changed = detail(show(syntheticEntry()), t.entry.changed);
    const items = within(changed).getAllByRole("listitem");

    expect(items.map((item) => item.firstChild?.textContent)).toEqual([
      t.fields.discount,
      t.fields.discount_reason,
      t.fields.status,
    ]);
    // Money as sent, with its currency; a reason's name only.
    expect(items[0]?.textContent).toMatch(/0\.00.*200\.00/);
    expect(items[1]?.textContent).toBe(t.fields.discount_reason);
    expect(items[2]?.textContent).toContain(en.shared.status.charge.unpaid);
    expect(items[2]?.textContent).toContain(en.shared.status.charge.paid);
  });

  it("says None before a value on creation, and shows what it doesn't know as sent", () => {
    const changed = detail(
      show(
        syntheticEntry({
          action: "charge.created",
          changes: {
            fields: ["status", "loyalty_points"],
            values: {
              status: { from: null, to: "on_hold" },
              loyalty_points: { from: 1, to: 2 },
            },
          },
        }),
      ),
      t.entry.changed,
    );
    const [status, points] = within(changed).getAllByRole("listitem");

    expect(status?.textContent).toContain(t.entry.none);
    expect(status?.textContent).toContain("on_hold");
    expect(status?.textContent).not.toContain(en.shared.status.unknown);
    expect(points?.textContent).toMatch(/loyalty_points.*1.*2/);
  });

  it("gives a search's filters, translated, or says there were none", () => {
    const article = show(
      syntheticEntry({
        action: "audit.searched",
        subject: null,
        patient_id: null,
        changes: null,
        filters: {
          patient_id: 12,
          action: "patient.opened",
          from: "2026-11-01",
        },
      }),
    );
    const used = detail(article, t.entry.filtersUsed);
    expect(used.textContent).toContain(t.filters.patient);
    expect(used.textContent).toContain("12");
    expect(used.textContent).toContain(t.actions.patient.opened);
    expect(used.textContent).toContain("2026-11-01");
    cleanup();

    const none = show(
      syntheticEntry({ action: "audit.searched", changes: null, filters: {} }),
    );
    expect(detail(none, t.entry.filtersUsed).textContent).toBe(
      t.entry.noFilters,
    );
  });

  it("has no filters row for other actions", () => {
    show(syntheticEntry());
    expect(screen.queryByText(t.entry.filtersUsed)).toBeNull();
  });

  it("speaks Arabic", () => {
    const article = show(syntheticEntry(), "ar");
    expect(within(article).getByRole("heading").textContent).toBe(
      messagesByLocale.ar.audit.actions.discount.set,
    );
  });
});

describe("what the backend adds later", () => {
  it("shows an unknown action, outcome, record type, actor type, and role exactly as sent", () => {
    const article = show(
      syntheticEntry({
        action: "discount.removed",
        outcome: "deferred",
        subject: { type: "invoice", id: 91 },
        changes: { fields: ["total"], values: { total: { from: 1, to: 2 } } },
      }),
    );

    expect(within(article).getByRole("heading").textContent).toBe(
      "discount.removed",
    );
    expect(within(article).getByText("deferred")).toBeTruthy();
    expect(screen.queryByText(en.shared.status.unknown)).toBeNull();
    const record = detail(article, t.entry.record);
    expect(record.textContent).toContain("invoice");
    expect(record.textContent).toContain("91");
    expect(within(record).queryByRole("link")).toBeNull();
    cleanup();

    const actor = show(
      syntheticEntry({
        actor: { type: "service", id: 4, name: null, role: null },
      }),
    );
    const who = detail(actor, t.entry.who);
    expect(who.textContent).toBe("service");
    expect(within(who).queryByRole("link")).toBeNull();
    cleanup();

    const role = show(
      syntheticEntry({
        actor: {
          type: "staff",
          id: 3,
          name: "Synthetic Admin",
          role: "auditor",
        },
      }),
    );
    expect(detail(role, t.entry.who).textContent).toContain("auditor");
  });
});
