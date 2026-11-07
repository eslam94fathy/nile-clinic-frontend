import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetUnsavedForTests } from "@/lib/unsaved-changes";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { recordOpening } from "../opening";
import { draft, finalized, ok, refused } from "../test-support";
import { EncounterRecord } from "./encounter-record";

const api = vi.hoisted(() => ({
  readEncounter: vi.fn(),
  saveEncounter: vi.fn(),
  finalizeEncounter: vi.fn(),
  addAddendum: vi.fn(),
  readTodaysList: vi.fn(),
  readHistory: vi.fn(),
  isSessionAlive: vi.fn(),
}));
vi.mock("../api/encounters", () => api);
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", async (original) => ({
  ...(await original<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => router,
}));

const m = messagesByLocale.en;
const t = m.encounters;

const setUp = (ownDoctorId: number | null = 2) =>
  renderWithIntl(
    <EncounterRecord
      id={draft.id}
      ownDoctorId={ownDoctorId}
      timeZone="Africa/Cairo"
    />,
  );

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset();
  api.readTodaysList.mockResolvedValue(refused(500));
  router.refresh.mockReset();
});

afterEach(() => {
  cleanup();
  resetUnsavedForTests();
});

describe("EncounterRecord", () => {
  it("keeps a typed addendum if reading again finds the session has ended", async () => {
    api.readEncounter.mockResolvedValueOnce(ok(finalized));
    api.readEncounter.mockResolvedValueOnce(refused(401));
    setUp();
    const box = await screen.findByLabelText<HTMLTextAreaElement>(
      t.addenda.label,
    );
    fireEvent.change(box, { target: { value: "Synthetic correction" } });

    fireEvent.click(screen.getByRole("button", { name: t.view.reload }));
    await screen.findByText(t.sessionEnded.heading);
    expect(api.readEncounter).toHaveBeenLastCalledWith(draft.id, "en", true);
    expect(
      screen.getByLabelText<HTMLTextAreaElement>(t.addenda.label).value,
    ).toBe("Synthetic correction");
  });

  it.each([403, 404])(
    "keeps a typed addendum on a %i when reading again",
    async (status) => {
      api.readEncounter.mockResolvedValueOnce(ok(finalized));
      api.readEncounter.mockResolvedValueOnce(refused(status, {}, "Refused."));
      setUp();
      const box = await screen.findByLabelText<HTMLTextAreaElement>(
        t.addenda.label,
      );
      fireEvent.change(box, { target: { value: "Synthetic correction" } });

      fireEvent.click(screen.getByRole("button", { name: t.view.reload }));
      await screen.findByText("Refused.");
      expect(
        screen.getByLabelText<HTMLTextAreaElement>(t.addenda.label).value,
      ).toBe("Synthetic correction");
    },
  );

  it("shows the loading state during its one read", async () => {
    api.readEncounter.mockResolvedValue(ok(draft));
    setUp();
    expect(screen.getByRole("status")).not.toBeNull();
    await screen.findByLabelText(t.form.diagnosis);
    expect(api.readEncounter).toHaveBeenCalledOnce();
  });

  it("gives a draft the form, with the patient's summary and nothing more", async () => {
    api.readEncounter.mockResolvedValue(ok(draft));
    setUp();

    await screen.findByLabelText(t.form.diagnosis);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("Synthetic Patient");
    expect(document.body.textContent).toContain("1990-01-01");
    expect(document.body.textContent).toContain(t.sex.female);
  });

  it("reads nothing for a record handed over", async () => {
    recordOpening.handOver(draft);
    setUp();
    await screen.findByLabelText(t.form.diagnosis);
    expect(api.readEncounter).not.toHaveBeenCalled();
  });

  it("reads nothing on focus, or on being re-rendered", async () => {
    api.readEncounter.mockResolvedValue(ok(draft));
    const { rerender } = setUp();
    await screen.findByLabelText(t.form.diagnosis);

    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    rerender(
      <NextIntlClientProvider locale="en" messages={m} timeZone="Africa/Cairo">
        <EncounterRecord
          id={draft.id}
          ownDoctorId={2}
          timeZone="Africa/Cairo"
        />
      </NextIntlClientProvider>,
    );
    expect(api.readEncounter).toHaveBeenCalledOnce();
  });

  it("gives one neutral state for a 404, whatever the cause", async () => {
    api.readEncounter.mockResolvedValue(refused(404, {}, "No record."));
    setUp();
    await screen.findByText(m.shared.states.notFoundHeading);
    expect(screen.queryByLabelText(t.form.diagnosis)).toBeNull();
    expect(document.body.textContent).not.toContain("No record.");
  });

  it("shows not allowed on a 403, and lets the gate decide again", async () => {
    api.readEncounter.mockResolvedValue(refused(403));
    setUp();
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(screen.queryByLabelText(t.form.diagnosis)).toBeNull();
  });

  it("offers trying again on a failure, as a person's action", async () => {
    api.readEncounter.mockResolvedValueOnce(refused(500, {}, "Went wrong."));
    api.readEncounter.mockResolvedValueOnce(ok(draft));
    setUp();

    await screen.findByText("Went wrong.");
    expect(api.readEncounter).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole("button", { name: m.shared.states.retry }),
    );
    await screen.findByLabelText(t.form.diagnosis);
    expect(api.readEncounter).toHaveBeenCalledTimes(2);
  });

  it("shows a finalized record read only, offering no change to it", async () => {
    api.readEncounter.mockResolvedValue(ok(finalized));
    setUp();

    await screen.findByText("Synthetic diagnosis");
    expect(screen.queryByLabelText(t.form.diagnosis)).toBeNull();
    expect(screen.queryByRole("button", { name: t.save.action })).toBeNull();
    expect(
      screen.queryByRole("button", { name: t.finalize.action }),
    ).toBeNull();
  });

  it("lets only the author add to a finalized record", async () => {
    api.readEncounter.mockResolvedValue(ok(finalized));
    setUp(2);
    await screen.findByLabelText(t.addenda.label);
    cleanup();

    setUp(99);
    await screen.findByText("Synthetic diagnosis");
    expect(screen.queryByLabelText(t.addenda.label)).toBeNull();
  });

  it("offers no adding when the doctor's own number isn't known", async () => {
    api.readEncounter.mockResolvedValue(ok(finalized));
    setUp(null);
    await screen.findByText("Synthetic diagnosis");
    expect(screen.queryByLabelText(t.addenda.label)).toBeNull();
  });

  it("reads again only when asked, saying it writes an entry", async () => {
    api.readEncounter.mockResolvedValue(ok(finalized));
    setUp();

    await screen.findByText(t.view.reloadHint);
    expect(api.readEncounter).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: t.view.reload }));
    await waitFor(() => expect(api.readEncounter).toHaveBeenCalledTimes(2));
  });

  it("keeps a finalized record on screen if reading again fails", async () => {
    api.readEncounter.mockResolvedValueOnce(ok(finalized));
    api.readEncounter.mockResolvedValueOnce(refused(500));
    setUp();
    await screen.findByText("Synthetic diagnosis");

    fireEvent.click(screen.getByRole("button", { name: t.view.reload }));
    await screen.findByText(t.view.outOfDate);
    expect(screen.getByText("Synthetic diagnosis")).not.toBeNull();
  });

  it("removes a record on a 404 when reading again", async () => {
    api.readEncounter.mockResolvedValueOnce(ok(finalized));
    api.readEncounter.mockResolvedValueOnce(refused(404));
    setUp();
    await screen.findByText("Synthetic diagnosis");

    fireEvent.click(screen.getByRole("button", { name: t.view.reload }));
    await waitFor(() =>
      expect(screen.queryByText("Synthetic diagnosis")).toBeNull(),
    );
  });

  it("moves to the read-only view on finalizing, with focus on its heading and no read", async () => {
    api.readEncounter.mockResolvedValue(ok(draft));
    api.finalizeEncounter.mockResolvedValue(
      ok({ ...finalized, diagnosis: null }),
    );
    setUp();
    await screen.findByLabelText(t.form.diagnosis);

    fireEvent.click(screen.getByRole("button", { name: t.finalize.action }));
    fireEvent.click(screen.getByRole("button", { name: t.finalize.confirm }));

    const heading = await screen.findByRole("heading", { name: t.title });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(api.readEncounter).toHaveBeenCalledOnce();
    expect(screen.queryByText(t.finalize.differs)).toBeNull();
  });

  it("says so when what was locked isn't what was on screen", async () => {
    api.readEncounter.mockResolvedValue(ok(draft));
    api.finalizeEncounter.mockResolvedValue(
      ok({ ...finalized, chief_complaint: "Another tab's text" }),
    );
    setUp();
    await screen.findByLabelText(t.form.diagnosis);

    fireEvent.click(screen.getByRole("button", { name: t.finalize.action }));
    fireEvent.click(screen.getByRole("button", { name: t.finalize.confirm }));

    await screen.findByText(t.finalize.differs);
    expect(screen.getByText("Another tab's text")).not.toBeNull();
  });
});
