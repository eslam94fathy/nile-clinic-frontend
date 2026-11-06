import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { FreeTimes } from "./free-times";

const readFreeTimes = vi.hoisted(() => vi.fn());
vi.mock("../api/slots", () => ({ readFreeTimes }));
const endSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session-end", () => ({ endSession }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router }));

const t = messagesByLocale.en.scheduling.freeTimes;
const today = "2026-11-07";
const slot = (date: string, start: string, end: string) => ({
  date,
  start,
  end,
});
const found = (...slots: ReturnType<typeof slot>[]) => ({
  ok: true,
  status: 200,
  data: slots,
});

beforeEach(() => {
  readFreeTimes.mockReset();
  router.refresh.mockReset();
});
afterEach(cleanup);

function setUp(props: Partial<Parameters<typeof FreeTimes>[0]> = {}) {
  const onChange = vi.fn();
  const element = (
    <FreeTimes
      doctorId={3}
      today={today}
      value={null}
      onChange={onChange}
      refreshSignal={0}
      {...props}
    />
  );
  return { onChange, ...renderWithIntl(element) };
}

describe("FreeTimes", () => {
  it("reads seven days from today, and groups them by the API's dates", async () => {
    readFreeTimes.mockResolvedValue(
      found(
        slot("2026-11-08", "09:00", "09:20"),
        slot("2026-11-08", "09:20", "24:00"),
        slot("2026-11-10", "10:00", "10:20"),
      ),
    );
    setUp();

    await screen.findByText("2026-11-08");
    expect(readFreeTimes).toHaveBeenCalledWith(3, today, "2026-11-13", "en");
    expect(screen.getAllByRole("group")).toHaveLength(3);
    expect(
      screen.getByRole("radio", { name: "2026-11-08, 09:20 to 24:00" }),
    ).toBeTruthy();
  });

  it("gives every free time a name with its date and time, as one group", async () => {
    readFreeTimes.mockResolvedValue(
      found(
        slot("2026-11-08", "09:00", "09:20"),
        slot("2026-11-09", "09:00", "09:20"),
      ),
    );
    setUp();

    const radios = await screen.findAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual([
      "2026-11-08, 09:00 to 09:20",
      "2026-11-09, 09:00 to 09:20",
    ]);
    expect(radios[0]?.getAttribute("name")).toBe(
      radios[1]?.getAttribute("name"),
    );
  });

  it("tells the parent what's chosen", async () => {
    readFreeTimes.mockResolvedValue(found(slot(today, "09:00", "09:20")));
    const { onChange } = setUp();

    fireEvent.click(await screen.findByRole("radio"));
    expect(onChange).toHaveBeenCalledWith({ date: today, start: "09:00" });
  });

  it("moves by a week, and asks again only then", async () => {
    readFreeTimes.mockResolvedValue(found());
    setUp();
    await screen.findByText(t.emptyTitle);
    expect(readFreeTimes).toHaveBeenCalledTimes(1);

    const next = screen.getAllByRole("button", { name: t.nextWeek })[0];
    if (!next) throw new Error("No next week.");
    fireEvent.click(next);

    await waitFor(() =>
      expect(readFreeTimes).toHaveBeenLastCalledWith(
        3,
        "2026-11-14",
        "2026-11-20",
        "en",
      ),
    );
    expect(readFreeTimes).toHaveBeenCalledTimes(2);
  });

  it("never asks for a date before today", async () => {
    readFreeTimes.mockResolvedValue(found());
    setUp();
    await screen.findByText(t.emptyTitle);

    fireEvent.change(screen.getByLabelText(t.from), {
      target: { value: "2020-01-01" },
    });
    await act(async () => {});

    for (const call of readFreeTimes.mock.calls) {
      expect(String(call[1]) >= today).toBe(true);
    }
  });

  it("reads again on asking, and on the parent's signal", async () => {
    readFreeTimes.mockResolvedValue(found(slot(today, "09:00", "09:20")));
    renderWithIntl(<WithSignal />);
    await screen.findByRole("radio");
    expect(readFreeTimes).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: t.refresh }));
    await waitFor(() => expect(readFreeTimes).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Signal" }));
    await waitFor(() => expect(readFreeTimes).toHaveBeenCalledTimes(3));
  });

  it("clears a chosen time that's no longer offered", async () => {
    readFreeTimes.mockResolvedValue(found(slot(today, "10:00", "10:20")));
    const { onChange } = setUp({ value: { date: today, start: "09:00" } });

    await screen.findByRole("radio");
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("keeps a chosen time that's still offered", async () => {
    readFreeTimes.mockResolvedValue(found(slot(today, "09:00", "09:20")));
    const { onChange } = setUp({ value: { date: today, start: "09:00" } });

    const radio = await screen.findByRole<HTMLInputElement>("radio");
    expect(radio.checked).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows an empty state that claims no reason", async () => {
    readFreeTimes.mockResolvedValue(found());
    setUp();

    await screen.findByText(t.emptyTitle);
    expect(screen.getByText(t.emptyDescription)).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("offers to try again after a failure, and doesn't on its own", async () => {
    readFreeTimes.mockResolvedValue({
      ok: false,
      error: { status: 500, fieldErrors: {}, message: "Failed." },
    });
    setUp();

    await screen.findByText("Failed.");
    expect(readFreeTimes).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", {
        name: messagesByLocale.en.shared.states.retry,
      }),
    );
    await waitFor(() => expect(readFreeTimes).toHaveBeenCalledTimes(2));
  });

  it("announces an error from the parent", async () => {
    readFreeTimes.mockResolvedValue(found());
    setUp({ error: "This time is not available." });

    await screen.findByText(t.emptyTitle);
    expect(screen.getByRole("alert").textContent).toBe(
      "This time is not available.",
    );
  });

  it("uses the newest answer when two cross", async () => {
    let first: (value: unknown) => void = () => {};
    readFreeTimes.mockReturnValueOnce(
      new Promise((resolve) => {
        first = resolve;
      }),
    );
    readFreeTimes.mockResolvedValueOnce(
      found(slot("2026-11-14", "11:00", "11:20")),
    );
    setUp();

    fireEvent.click(screen.getByRole("button", { name: t.nextWeek }));
    await screen.findByText("2026-11-14");

    first(found(slot(today, "09:00", "09:20")));
    await act(async () => {});
    expect(screen.queryByText(today)).toBeNull();
  });
});

function WithSignal() {
  const [signal, setSignal] = useState(0);
  return (
    <>
      <button onClick={() => setSignal(signal + 1)}>{"Signal"}</button>
      <FreeTimes
        doctorId={3}
        today={today}
        value={null}
        onChange={() => {}}
        refreshSignal={signal}
      />
    </>
  );
}
