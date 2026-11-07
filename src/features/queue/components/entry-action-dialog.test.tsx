import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import type { QueueEntry } from "../types";
import { EntryActionDialog } from "./entry-action-dialog";

const api = vi.hoisted(() => ({ markLeft: vi.fn(), undoCheckIn: vi.fn() }));
vi.mock("../api/queue", () => api);
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const t = messagesByLocale.en.queue;
const { irreversible } = messagesByLocale.en.shared.confirm;

const entry: QueueEntry = {
  id: 5,
  queue_number: 3,
  status: "waiting",
  walk_in: false,
  arrived_at: "2026-11-07T08:00:00.000000Z",
  called_at: null,
  finished_at: null,
  left_at: null,
  appointment: { id: 7, start: "09:20", end: "09:40" },
  doctor: { id: 3, name: "Synthetic Doctor", title: "Consultant" },
  patient: { id: 12, full_name: "Synthetic Patient", phone: "01000000001" },
};

beforeEach(() => {
  api.markLeft.mockReset();
  api.undoCheckIn.mockReset();
  toast.success.mockReset();
});
afterEach(cleanup);

function setUp(action: "mark_left" | "undo") {
  const onClose = vi.fn();
  const refresh = vi.fn().mockResolvedValue(undefined);
  renderWithIntl(
    <EntryActionDialog
      request={{ entry, action }}
      open
      onClose={onClose}
      onCloseAutoFocus={() => {}}
      refresh={refresh}
    />,
  );
  return { onClose, refresh };
}

const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

describe("EntryActionDialog", () => {
  it("names the patient, and says marking as left can't be undone", () => {
    setUp("mark_left");
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("Synthetic Patient");
    expect(dialog.textContent).toContain(t.left.description);
    expect(dialog.textContent).toContain(irreversible);
  });

  it("says what undoing does", () => {
    setUp("undo");
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("Synthetic Patient");
    expect(dialog.textContent).toContain(t.undo.description);
  });

  it("closes and confirms on success, and reads the list again", async () => {
    api.markLeft.mockResolvedValue({ ok: true, status: 200, data: entry });
    const { onClose, refresh } = setUp("mark_left");
    press(t.left.confirm);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.markLeft).toHaveBeenCalledWith(5, "en");
    expect(toast.success).toHaveBeenCalledWith(t.left.done);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("undoes the right entry", async () => {
    api.undoCheckIn.mockResolvedValue({ ok: true, status: 204, data: null });
    setUp("undo");
    press(t.undo.confirm);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(t.undo.done),
    );
    expect(api.undoCheckIn).toHaveBeenCalledWith(5, "en");
    expect(api.markLeft).not.toHaveBeenCalled();
  });

  it("stays open with the API's message on a refusal, and reads the list again", async () => {
    api.markLeft.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { entry: ["Sent as written."] } },
    });
    const { onClose, refresh } = setUp("mark_left");
    press(t.left.confirm);

    await screen.findByText("Sent as written.");
    expect(onClose).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each([0, 502])("says it can't tell after a %i", async (status) => {
    api.markLeft.mockResolvedValue({
      ok: false,
      error: { status, fieldErrors: {} },
    });
    const { refresh } = setUp("mark_left");
    press(t.left.confirm);

    await screen.findByText(t.unknownOutcome);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("doesn't send twice while one is under way", async () => {
    api.markLeft.mockReturnValue(new Promise(() => {}));
    setUp("mark_left");
    press(t.left.confirm);
    fireEvent.click(
      screen.getByRole("button", {
        name: messagesByLocale.en.shared.confirm.working,
      }),
    );

    await waitFor(() => expect(api.markLeft).toHaveBeenCalledTimes(1));
  });
});
