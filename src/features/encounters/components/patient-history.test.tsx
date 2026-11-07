import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { historyOpening, noteHistoryName } from "../opening";
import { ok, pageOf, refused } from "../test-support";
import { PatientHistory } from "./patient-history";

const readHistory = vi.hoisted(() => vi.fn());
vi.mock("../api/encounters", () => ({ readHistory }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", async (original) => ({
  ...(await original<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => router,
}));

const m = messagesByLocale.en;
const t = m.encounters.history;
const PATIENT = 21;
const item = {
  id: 9,
  date: "2026-01-15",
  doctor: { id: 2, name: "Synthetic Doctor", specialties: [] },
};

const show = () => renderWithIntl(<PatientHistory patientId={PATIENT} />);

beforeEach(() => {
  readHistory.mockReset();
  router.refresh.mockReset();
});
afterEach(cleanup);

describe("PatientHistory", () => {
  it("reads once on first being shown", async () => {
    readHistory.mockResolvedValue(ok(pageOf([item])));
    show();
    await screen.findByText("Synthetic Doctor");
    expect(readHistory).toHaveBeenCalledOnce();
    expect(readHistory).toHaveBeenCalledWith(PATIENT, 1, "en");
  });

  it("reads nothing on focus, or on being re-rendered", async () => {
    readHistory.mockResolvedValue(ok(pageOf([item])));
    const { rerender } = show();
    await screen.findByText("Synthetic Doctor");

    window.dispatchEvent(new Event("focus"));
    rerender(
      <NextIntlClientProvider locale="en" messages={m} timeZone="Africa/Cairo">
        <PatientHistory patientId={PATIENT} />
      </NextIntlClientProvider>,
    );
    expect(readHistory).toHaveBeenCalledOnce();
  });

  it("uses a mark left by a link", () => {
    historyOpening.markAsked(PATIENT);
    readHistory.mockResolvedValue(ok(pageOf([item])));
    show();
    expect(historyOpening.takeAsked(PATIENT)).toBe(false);
  });

  it("shows the name the link passed, and otherwise only the number", async () => {
    readHistory.mockResolvedValue(ok(pageOf([item])));
    noteHistoryName(PATIENT, "Synthetic Patient");
    show();
    await screen.findByText("Synthetic Patient");
    cleanup();

    show();
    await screen.findByText("Synthetic Doctor");
    expect(screen.queryByText("Synthetic Patient")).toBeNull();
    expect(document.body.textContent).toContain(String(PATIENT));
  });

  it("links each row to the record, without clinical content", async () => {
    readHistory.mockResolvedValue(ok(pageOf([item])));
    show();
    const link = await screen.findByRole("link", { name: t.open });
    expect(link.getAttribute("href")).toBe("/en/my/encounters/9");
  });

  it("reads another page once, when asked", async () => {
    readHistory.mockResolvedValue(ok(pageOf([item], 1, 2)));
    show();
    fireEvent.click(await screen.findByRole("button", { name: t.next }));

    await waitFor(() => expect(readHistory).toHaveBeenCalledTimes(2));
    expect(readHistory).toHaveBeenLastCalledWith(PATIENT, 2, "en");
  });

  it("uses neutral words for an empty history", async () => {
    readHistory.mockResolvedValue(ok(pageOf([])));
    show();
    await screen.findByText(t.emptyTitle);
  });

  it("gives the same neutral state for a 404, whatever the cause", async () => {
    readHistory.mockResolvedValue(refused(404, {}, "No records for them."));
    show();
    await screen.findByText(m.shared.states.notFoundHeading);
    expect(document.body.textContent).not.toContain("No records for them.");
  });

  it("offers trying again on a failure, as a person's action", async () => {
    readHistory.mockResolvedValueOnce(refused(500, {}, "Went wrong."));
    readHistory.mockResolvedValueOnce(ok(pageOf([item])));
    show();

    await screen.findByText("Went wrong.");
    expect(readHistory).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole("button", { name: m.shared.states.retry }),
    );
    await screen.findByText("Synthetic Doctor");
  });
});
