import { cleanup, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { LastRead } from "./last-read";

afterEach(cleanup);

const t = messagesByLocale.en.shared.lastRead;
// 10:00 in UTC, so 12:00 in Cairo, whatever zone this computer is in.
const READ_AT = Date.UTC(2026, 10, 7, 10, 0);

function setUp(props: Partial<Parameters<typeof LastRead>[0]> = {}) {
  const onRefresh = vi.fn();
  const view = renderWithIntl(
    <LastRead
      readAt={READ_AT}
      outOfDate={false}
      reading={false}
      onRefresh={onRefresh}
      timeZone="Africa/Cairo"
      {...props}
    />,
  );
  return { ...view, onRefresh };
}

describe("LastRead", () => {
  it("says when, in the clinic's time zone", () => {
    setUp();
    expect(screen.getByText(/12:00/)).toBeTruthy();
    expect(screen.getByText(new RegExp(t.label))).toBeTruthy();
  });

  it("says nothing about a time before the first read", () => {
    setUp({ readAt: 0 });
    expect(screen.queryByText(new RegExp(t.label))).toBeNull();
  });

  it("refreshes when asked", () => {
    const { onRefresh } = setUp();
    fireEvent.click(screen.getByRole("button", { name: t.refresh }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("doesn't start a second read, and stays pressable, while one is under way", () => {
    const { onRefresh } = setUp({ reading: true });
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: t.refresh,
    });
    fireEvent.click(button);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
  });

  it("announces being out of date through one status region that's always there", () => {
    function Stage() {
      const [outOfDate, setOutOfDate] = useState(false);
      return (
        <>
          <LastRead
            readAt={READ_AT}
            outOfDate={outOfDate}
            reading={false}
            onRefresh={() => {}}
            timeZone="Africa/Cairo"
          />
          <button onClick={() => setOutOfDate(true)}>{"Fail"}</button>
        </>
      );
    }
    renderWithIntl(<Stage />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Fail" }));

    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toBe(t.outOfDate);
  });

  it("doesn't promise a retry for a list that reads only when asked", () => {
    setUp({ outOfDate: true, retriesBySelf: false });

    expect(screen.getByRole("status").textContent).toBe(t.outOfDateOnDemand);
  });
});
