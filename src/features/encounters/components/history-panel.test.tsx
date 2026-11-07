import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { finalized, ok, pageOf, refused } from "../test-support";
import { useHistoryPanel } from "../use-history-panel";
import { HistoryPanel } from "./history-panel";

const api = vi.hoisted(() => ({
  readHistory: vi.fn(),
  readEncounter: vi.fn(),
}));
vi.mock("../api/encounters", () => api);

const m = messagesByLocale.en;
const t = m.encounters;
const item = {
  id: finalized.id,
  date: "2026-01-15",
  doctor: { id: 2, name: "Synthetic Other Doctor", specialties: [] },
};

function Harness({
  onSessionEnded,
  onClosed,
}: {
  onSessionEnded: () => void;
  onClosed: () => void;
}) {
  const panel = useHistoryPanel(21, onSessionEnded);
  return (
    <>
      <button type="button" onClick={() => void panel.openHistory()}>
        Open the panel
      </button>
      {panel.state.view === "closed" ? null : (
        <HistoryPanel
          panel={panel}
          timeZone="Africa/Cairo"
          onClosed={onClosed}
        />
      )}
    </>
  );
}

function setUp() {
  const onSessionEnded = vi.fn();
  const onClosed = vi.fn();
  renderWithIntl(
    <Harness onSessionEnded={onSessionEnded} onClosed={onClosed} />,
  );
  return { onSessionEnded, onClosed };
}

const open = () =>
  fireEvent.click(screen.getByRole("button", { name: "Open the panel" }));

beforeEach(() => {
  api.readHistory.mockReset();
  api.readEncounter.mockReset();
  api.readHistory.mockResolvedValue(ok(pageOf([item])));
  api.readEncounter.mockResolvedValue(ok(finalized));
});
afterEach(cleanup);

describe("the history panel", () => {
  it("reads nothing while closed", () => {
    setUp();
    expect(api.readHistory).not.toHaveBeenCalled();
    expect(api.readEncounter).not.toHaveBeenCalled();
  });

  it("is a labelled region, not a dialog", async () => {
    setUp();
    open();
    await screen.findByRole("region", { name: t.panel.heading });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("reads the history once on opening, and moves focus to its heading", async () => {
    setUp();
    open();

    await screen.findByText("Synthetic Other Doctor");
    expect(api.readHistory).toHaveBeenCalledOnce();
    expect(api.readHistory).toHaveBeenCalledWith(21, 1, "en", true);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: t.panel.heading }),
      ),
    );
  });

  it("reads a record once when chosen, read only", async () => {
    setUp();
    open();
    fireEvent.click(
      await screen.findByRole("button", { name: t.history.open }),
    );

    await screen.findByText("Synthetic diagnosis");
    expect(api.readEncounter).toHaveBeenCalledOnce();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(t.addenda.add)).toBeNull();
  });

  it("goes back to the history with no read", async () => {
    setUp();
    open();
    fireEvent.click(
      await screen.findByRole("button", { name: t.history.open }),
    );
    fireEvent.click(await screen.findByRole("button", { name: t.panel.back }));

    await screen.findByText("Synthetic Other Doctor");
    expect(api.readHistory).toHaveBeenCalledOnce();
  });

  it("drops everything on closing, and opening again reads again", async () => {
    const { onClosed } = setUp();
    open();
    await screen.findByText("Synthetic Other Doctor");

    fireEvent.click(screen.getByRole("button", { name: t.panel.close }));
    expect(screen.queryByText("Synthetic Other Doctor")).toBeNull();
    expect(onClosed).toHaveBeenCalledOnce();

    open();
    await screen.findByText("Synthetic Other Doctor");
    expect(api.readHistory).toHaveBeenCalledTimes(2);
  });

  it("ignores an answer that arrives after closing", async () => {
    let answer: (value: unknown) => void = () => {};
    api.readHistory.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    setUp();
    open();
    fireEvent.click(await screen.findByRole("button", { name: t.panel.close }));

    answer(ok(pageOf([item])));
    await waitFor(() =>
      expect(screen.queryByText("Synthetic Other Doctor")).toBeNull(),
    );
  });

  it("reads each further page once, when asked", async () => {
    api.readHistory.mockResolvedValue(ok(pageOf([item], 1, 2)));
    setUp();
    open();
    fireEvent.click(
      await screen.findByRole("button", { name: t.history.next }),
    );

    await waitFor(() =>
      expect(api.readHistory).toHaveBeenLastCalledWith(21, 2, "en", true),
    );
  });

  it("keeps a failure inside the panel", async () => {
    api.readHistory.mockResolvedValue(refused(500, {}, "Went wrong."));
    setUp();
    open();

    await screen.findByText("Went wrong.");
    expect(
      screen.getByRole("region", { name: t.panel.heading }),
    ).not.toBeNull();
    expect(api.readHistory).toHaveBeenCalledOnce();
  });

  it("repeats the read that failed, and no other, as each writes an entry", async () => {
    api.readEncounter.mockResolvedValueOnce(refused(500, {}, "Went wrong."));
    setUp();
    open();
    fireEvent.click(
      await screen.findByRole("button", { name: t.history.open }),
    );
    await screen.findByText("Went wrong.");

    fireEvent.click(
      screen.getByRole("button", { name: m.shared.states.retry }),
    );
    await screen.findByText("Synthetic diagnosis");
    expect(api.readEncounter).toHaveBeenCalledTimes(2);
    expect(api.readHistory).toHaveBeenCalledOnce();
  });

  it("says something failed when the API sent no message", async () => {
    api.readHistory.mockResolvedValue(refused(0));
    setUp();
    open();
    await screen.findByText(m.auth.errors.unavailable);
  });

  it("gives the neutral state for a 404", async () => {
    api.readHistory.mockResolvedValue(refused(404, {}, "No records."));
    setUp();
    open();
    await screen.findByText(m.shared.states.notFoundHeading);
    expect(document.body.textContent).not.toContain("No records.");
  });

  it("passes up a dead session rather than leaving", async () => {
    api.readHistory.mockResolvedValue(refused(401));
    const { onSessionEnded } = setUp();
    open();
    await waitFor(() => expect(onSessionEnded).toHaveBeenCalledOnce());
    expect(screen.queryByRole("region", { name: t.panel.heading })).toBeNull();
  });
});
