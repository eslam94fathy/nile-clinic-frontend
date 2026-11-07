import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import type { OwnQueueEntry } from "../types";
import { OwnQueueActions } from "./own-queue-actions";

const api = vi.hoisted(() => ({ callNext: vi.fn(), finishVisit: vi.fn() }));
vi.mock("../api/queue", () => api);
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const t = messagesByLocale.en.queue;
const { irreversible } = messagesByLocale.en.shared.confirm;

function entry(id: number, status: OwnQueueEntry["status"]): OwnQueueEntry {
  return {
    id,
    queue_number: id,
    status,
    walk_in: true,
    arrived_at: "2026-11-07T08:00:00.000000Z",
    called_at: null,
    finished_at: null,
    left_at: null,
    appointment: null,
    patient: {
      id: id + 100,
      full_name: `Synthetic ${id}`,
      sex: "male",
      date_of_birth: "1990-01-01",
    },
  };
}

beforeEach(() => {
  api.callNext.mockReset();
  api.finishVisit.mockReset();
  toast.success.mockReset();
});
afterEach(cleanup);

function setUp(
  entries: OwnQueueEntry[],
  currentRecordStatus?: "none" | "draft" | "finalized",
) {
  const onAnswered = vi.fn();
  const refresh = vi.fn().mockResolvedValue(undefined);
  renderWithIntl(
    <OwnQueueActions
      entries={entries}
      headingId="heading"
      currentRecordStatus={currentRecordStatus}
      onAnswered={onAnswered}
      refresh={refresh}
    />,
  );
  return { onAnswered, refresh };
}

const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const inDialog = (name: string) =>
  fireEvent.click(
    screen
      .getAllByRole("button", { name })
      .find((button) => button.closest('[role="alertdialog"]')) ??
      document.body,
  );

describe("OwnQueueActions", () => {
  describe("finishing with a record not finalized", () => {
    it.each(["none", "draft"] as const)(
      "says so for %s, without blocking",
      (status) => {
        setUp([entry(1, "with_doctor")], status);
        press(t.own.finish.action);

        const dialog = screen.getByRole("alertdialog");
        expect(dialog.textContent).toContain(t.own.notFinalizedNote);
        expect(
          screen
            .getAllByRole("button", { name: t.own.finish.confirm })
            .some((button) => button.closest('[role="alertdialog"]')),
        ).toBe(true);
      },
    );

    it.each([["finalized"], [undefined]] as const)(
      "says nothing for %s",
      (status) => {
        setUp([entry(1, "with_doctor")], status);
        press(t.own.finish.action);
        expect(screen.getByRole("alertdialog").textContent).not.toContain(
          t.own.notFinalizedNote,
        );
      },
    );
  });

  it("offers nothing when there's nothing to do", () => {
    setUp([entry(1, "seen")]);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("asks before calling, names nobody, and says it can't be undone", () => {
    setUp([entry(1, "waiting")]);
    press(t.own.callNext.action);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain(t.own.callNext.description);
    expect(dialog.textContent).toContain(irreversible);
    expect(dialog.textContent).not.toContain("Synthetic 1");
    expect(api.callNext).not.toHaveBeenCalled();
  });

  it("names the patient the API returned, who may not be the first waiting", async () => {
    const answer = entry(2, "with_doctor");
    api.callNext.mockResolvedValue({ ok: true, status: 200, data: answer });
    const { onAnswered, refresh } = setUp([
      entry(1, "waiting"),
      entry(2, "waiting"),
    ]);
    press(t.own.callNext.action);
    inDialog(t.own.callNext.confirm);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        t.own.callNext.done.replace("{name}", "Synthetic 2"),
      ),
    );
    expect(onAnswered).toHaveBeenCalledWith(answer);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("names the current patient before finishing, and mentions no medical record", () => {
    setUp([entry(1, "with_doctor")]);
    press(t.own.finish.action);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("Synthetic 1");
    expect(dialog.textContent).toContain(irreversible);
    expect(dialog.textContent?.toLowerCase()).not.toContain("record");
    expect(dialog.textContent?.toLowerCase()).not.toContain("encounter");
  });

  it("won't finish someone other than the patient it named", async () => {
    function Stage() {
      const [entries, setEntries] = useState([entry(1, "with_doctor")]);
      return (
        <>
          <button
            onClick={() =>
              setEntries([entry(1, "seen"), entry(2, "with_doctor")])
            }
          >
            {"Change"}
          </button>
          <OwnQueueActions
            entries={entries}
            headingId="heading"
            onAnswered={vi.fn()}
            refresh={vi.fn().mockResolvedValue(undefined)}
          />
        </>
      );
    }
    renderWithIntl(<Stage />);
    press(t.own.finish.action);
    const dialog = screen.getByRole("alertdialog");

    // The dialog makes everything else inert, so this stands in for a refresh arriving.
    fireEvent.click(screen.getByText("Change"));
    expect(dialog.textContent).toContain("Synthetic 1");
    inDialog(t.own.finish.confirm);

    await screen.findByText(t.own.finish.changed);
    expect(api.finishVisit).not.toHaveBeenCalled();
  });

  it("moves focus to the heading when a refresh removes the button holding it", () => {
    function Stage() {
      const [entries, setEntries] = useState([entry(1, "waiting")]);
      return (
        <>
          <h2 id="heading" tabIndex={-1}>
            {"Heading"}
          </h2>
          <button onClick={() => setEntries([entry(1, "left")])}>
            {"Change"}
          </button>
          <OwnQueueActions
            entries={entries}
            headingId="heading"
            onAnswered={vi.fn()}
            refresh={vi.fn().mockResolvedValue(undefined)}
          />
        </>
      );
    }
    renderWithIntl(<Stage />);
    const action = screen.getByRole("button", { name: t.own.callNext.action });
    action.focus();

    // Clicking in a test doesn't move focus, so the button keeps it until it goes.
    fireEvent.click(screen.getByText("Change"));

    expect(
      screen.queryByRole("button", { name: t.own.callNext.action }),
    ).toBeNull();
    expect(document.activeElement).toBe(screen.getByText("Heading"));
  });

  it("stays open with the API's message on a refusal, and reads again", async () => {
    api.callNext.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { queue: ["Sent as written."] } },
    });
    const { onAnswered, refresh } = setUp([entry(1, "waiting")]);
    press(t.own.callNext.action);
    inDialog(t.own.callNext.confirm);

    await screen.findByText("Sent as written.");
    expect(onAnswered).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows a conflict's message", async () => {
    api.callNext.mockResolvedValue({
      ok: false,
      error: {
        status: 409,
        message: "With someone else.",
        reason: "patient_with_another_doctor",
        fieldErrors: {},
      },
    });
    setUp([entry(1, "waiting")]);
    press(t.own.callNext.action);
    inDialog(t.own.callNext.confirm);

    await screen.findByText("With someone else.");
  });

  it("says it can't tell when no answer came, and doesn't repeat it", async () => {
    api.finishVisit.mockResolvedValue({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
    const { refresh } = setUp([entry(1, "with_doctor")]);
    press(t.own.finish.action);
    inDialog(t.own.finish.confirm);

    await screen.findByText(t.unknownOutcome);
    expect(api.finishVisit).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
