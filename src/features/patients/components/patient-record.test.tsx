import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Activity, type ComponentProps, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import { handOver, markAsked, takeAsked, takeHandedOver } from "../opening";
import type { Patient } from "../types";
import { PatientRecord } from "./patient-record";

const readPatient = vi.hoisted(() => vi.fn());
const updatePatient = vi.hoisted(() => vi.fn());
vi.mock("../api/patients", () => ({ readPatient, updatePatient }));

const endSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session-end", () => ({ endSession }));

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

const { patients: t, shared } = messagesByLocale.en;

const record: Patient = {
  id: 5,
  full_name: "Synthetic Patient",
  sex: "female",
  date_of_birth: "1990-04-12",
  phone: "01000000001",
  national_id: "29004120100001",
  address: "12 Synthetic St",
  emergency_contact: {
    name: "Synthetic Guardian",
    relationship: "father",
    phone: "01000000002",
  },
  created_at: "2026-02-01T10:00:00.000000Z",
  updated_at: "2026-02-01T10:00:00.000000Z",
};
const sparse: Patient = {
  ...record,
  national_id: null,
  address: null,
  emergency_contact: null,
};
const found = (patient: Patient = record) => ({
  ok: true,
  status: 200,
  data: patient,
});
const refused = (status: number, message?: string) => ({
  ok: false,
  error: { status, fieldErrors: {}, ...(message ? { message } : {}) },
});

function stage(mode: "visible" | "hidden" = "visible") {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messagesByLocale.en}
      timeZone="Africa/Cairo"
    >
      <Activity mode={mode}>
        <PatientRecord id={5} timeZone="Africa/Cairo" today="2026-11-06" />
      </Activity>
    </NextIntlClientProvider>
  );
}

async function settled() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function shown() {
  const view = render(stage());
  await settled();
  return view;
}

const reload = () => screen.getByRole("button", { name: t.record.reload });

beforeEach(() => {
  readPatient.mockReset();
  updatePatient.mockReset();
  readPatient.mockResolvedValue(found());
  takeAsked(5);
  takeHandedOver(5);
});

describe("when the record is read", () => {
  it("reads once on opening, and shows the record", async () => {
    await shown();

    expect(readPatient).toHaveBeenCalledTimes(1);
    expect(readPatient).toHaveBeenCalledWith(5, "en");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Synthetic Patient",
    );
  });

  it("doesn't read again on re-rendering", async () => {
    const view = await shown();
    view.rerender(stage());
    await settled();

    expect(readPatient).toHaveBeenCalledTimes(1);
  });

  it("reads once under Strict Mode's repeated effects", async () => {
    render(<StrictMode>{stage()}</StrictMode>);
    await settled();

    expect(readPatient).toHaveBeenCalledTimes(1);
  });

  it("doesn't read on focus, visibility, or reconnecting", async () => {
    await shown();
    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("online"));
    });
    await settled();

    expect(readPatient).toHaveBeenCalledTimes(1);
  });

  it("doesn't read when a held page is shown again", async () => {
    const view = await shown();
    view.rerender(stage("hidden"));
    await settled();
    view.rerender(stage("visible"));
    await settled();

    expect(readPatient).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Synthetic Patient",
    );
  });

  it("reads again when shown after a click on its link, and uses up the mark", async () => {
    const view = await shown();
    view.rerender(stage("hidden"));
    await settled();

    markAsked(5);
    readPatient.mockResolvedValue(found({ ...record, phone: "01000000099" }));
    view.rerender(stage("visible"));
    await settled();

    expect(readPatient).toHaveBeenCalledTimes(2);
    expect(screen.getByText("01000000099")).toBeTruthy();

    view.rerender(stage("hidden"));
    await settled();
    view.rerender(stage("visible"));
    await settled();
    expect(readPatient).toHaveBeenCalledTimes(2);
  });

  it("uses a handed-over record, with no read", async () => {
    handOver(record);
    await shown();

    expect(readPatient).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Synthetic Patient",
    );
  });

  it("doesn't read for a record handed over for someone else", async () => {
    handOver({ ...record, id: 6 });
    await shown();

    expect(readPatient).toHaveBeenCalledTimes(1);
    takeHandedOver(6);
  });

  it("shows progress while reloading, and can't be pressed twice", async () => {
    await shown();

    let answer: (value: unknown) => void = () => undefined;
    readPatient.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    fireEvent.click(reload());

    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: t.record.reloading,
    });
    expect(button.disabled).toBe(true);
    // The record stays on screen in the meantime.
    expect(screen.getByText("01000000001")).toBeTruthy();

    await act(async () => {
      answer(found({ ...record, phone: "01000000088" }));
      await Promise.resolve();
    });
    expect(screen.getByText("01000000088")).toBeTruthy();
    expect(readPatient).toHaveBeenCalledTimes(2);
  });

  it("applies only the newest answer, when a click overtakes a reload", async () => {
    const view = await shown();

    let answerOld: (value: unknown) => void = () => undefined;
    readPatient.mockReturnValueOnce(
      new Promise((resolve) => {
        answerOld = resolve;
      }),
    );
    fireEvent.click(reload());

    view.rerender(stage("hidden"));
    await settled();
    markAsked(5);
    readPatient.mockResolvedValueOnce(
      found({ ...record, phone: "01000000066" }),
    );
    view.rerender(stage("visible"));
    await settled();

    await act(async () => {
      answerOld(found({ ...record, phone: "01000000055" }));
      await Promise.resolve();
    });
    expect(screen.getByText("01000000066")).toBeTruthy();
    expect(screen.queryByText("01000000055")).toBeNull();
  });
});

describe("what it shows", () => {
  it("shows loading until the answer arrives", () => {
    readPatient.mockReturnValue(new Promise(() => {}));
    render(stage());

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("shows every detail", async () => {
    await shown();

    for (const text of [
      "5",
      t.sex.female,
      "1990-04-12",
      "01000000001",
      "29004120100001",
      "12 Synthetic St",
      "Synthetic Guardian",
      "father",
      "01000000002",
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
  });

  it("says what wasn't recorded, in words", async () => {
    readPatient.mockResolvedValue(found(sparse));
    await shown();

    expect(screen.getAllByText(t.fields.notRecorded)).toHaveLength(3);
  });

  it("states that reloading records an opening", async () => {
    await shown();
    expect(screen.getByText(t.record.reloadHint)).toBeTruthy();
  });
});

describe("when reading fails", () => {
  it("shows not allowed on 403, with no retry", async () => {
    readPatient.mockResolvedValue(refused(403));
    await shown();

    expect(screen.getByText(shared.states.forbiddenHeading)).toBeTruthy();
    expect(readPatient).toHaveBeenCalledTimes(1);
  });

  it("shows the neutral state on 404", async () => {
    readPatient.mockResolvedValue(refused(404));
    await shown();

    expect(screen.getByText(shared.states.notFoundHeading)).toBeTruthy();
  });

  it("doesn't retry on its own, and tries once when asked", async () => {
    readPatient.mockResolvedValue(refused(500, "It failed."));
    await shown();

    expect(screen.getByText("It failed.")).toBeTruthy();
    expect(readPatient).toHaveBeenCalledTimes(1);

    readPatient.mockResolvedValue(found());
    fireEvent.click(screen.getByRole("button", { name: shared.states.retry }));
    await settled();

    expect(readPatient).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Synthetic Patient",
    );
  });
});

describe("editing", () => {
  const edit = () => screen.getByRole("button", { name: t.record.edit });
  const phoneField = () =>
    screen.getByLabelText<HTMLInputElement>(
      new RegExp(`^${t.fields.phone}`, "u"),
    );
  const changePhone = (value = "01000000009") =>
    fireEvent.change(phoneField(), { target: { value } });
  const save = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.form.save }));
      await Promise.resolve();
    });
  };

  it("starts from the record on screen, with no read", async () => {
    await shown();

    fireEvent.click(edit());

    expect(phoneField().value).toBe("01000000001");
    expect(readPatient).toHaveBeenCalledTimes(1);
  });

  it("isn't offered until there's a record", () => {
    readPatient.mockReturnValue(new Promise(() => {}));
    render(stage());

    expect(screen.queryByRole("button", { name: t.record.edit })).toBeNull();
  });

  it("can't reload while editing", async () => {
    await shown();

    fireEvent.click(edit());

    expect(screen.queryByRole("button", { name: t.record.reload })).toBeNull();
    expect(screen.queryByText(t.record.reloadHint)).toBeNull();
  });

  it("shows the returned record after saving, with no read", async () => {
    await shown();
    updatePatient.mockResolvedValue(found({ ...record, phone: "01000000009" }));

    fireEvent.click(edit());
    changePhone();
    await save();

    await waitFor(() => expect(screen.getByText("01000000009")).toBeTruthy());
    expect(screen.queryByRole("button", { name: t.form.save })).toBeNull();
    expect(readPatient).toHaveBeenCalledTimes(1);
    expect(reload()).toBeTruthy();
  });

  it("can edit a record that was handed over, which never had a read", async () => {
    handOver(record);
    await shown();
    updatePatient.mockResolvedValue(found({ ...record, phone: "01000000009" }));

    fireEvent.click(edit());
    changePhone();
    await save();

    await waitFor(() => expect(screen.getByText("01000000009")).toBeTruthy());
    expect(readPatient).not.toHaveBeenCalled();
  });

  it("cancelling returns the record untouched, with no read", async () => {
    await shown();

    fireEvent.click(edit());
    changePhone();
    fireEvent.click(screen.getByRole("button", { name: t.form.cancel }));

    expect(screen.getByText("01000000001")).toBeTruthy();
    expect(screen.queryByText("01000000009")).toBeNull();
    expect(readPatient).toHaveBeenCalledTimes(1);
    expect(updatePatient).not.toHaveBeenCalled();
  });

  it("forgets what was typed once cancelled", async () => {
    await shown();

    fireEvent.click(edit());
    changePhone();
    fireEvent.click(screen.getByRole("button", { name: t.form.cancel }));
    fireEvent.click(edit());

    expect(phoneField().value).toBe("01000000001");
  });

  it("returns focus to the button, after saving or cancelling", async () => {
    await shown();

    fireEvent.click(edit());
    fireEvent.click(screen.getByRole("button", { name: t.form.cancel }));

    await waitFor(() => expect(document.activeElement).toBe(edit()));
  });

  it("keeps what was typed when a read arrives during editing", async () => {
    const view = await shown();

    fireEvent.click(edit());
    changePhone();
    view.rerender(stage("hidden"));
    await settled();
    markAsked(5);
    readPatient.mockResolvedValue(
      found({ ...record, address: "9 Newer St", full_name: "Newer Name" }),
    );
    view.rerender(stage("visible"));
    await settled();

    expect(readPatient).toHaveBeenCalledTimes(2);
    expect(phoneField().value).toBe("01000000009");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Newer Name",
    );
  });

  it("ignores a read that was overtaken by a save", async () => {
    await shown();
    let answerRead: (value: unknown) => void = () => undefined;
    readPatient.mockReturnValueOnce(
      new Promise((resolve) => {
        answerRead = resolve;
      }),
    );
    fireEvent.click(reload());

    updatePatient.mockResolvedValue(found({ ...record, phone: "01000000009" }));
    fireEvent.click(edit());
    changePhone();
    await save();
    await waitFor(() => expect(screen.getByText("01000000009")).toBeTruthy());

    await act(async () => {
      answerRead(found({ ...record, phone: "01000000055" }));
      await Promise.resolve();
    });

    expect(screen.getByText("01000000009")).toBeTruthy();
    expect(screen.queryByText("01000000055")).toBeNull();
    expect(reload()).toBeTruthy();
  });

  it.each([
    [403, shared.states.forbiddenHeading],
    [404, shared.states.notFoundHeading],
  ])("removes the record on a %i when saving", async (status, heading) => {
    await shown();
    updatePatient.mockResolvedValue(refused(status));

    fireEvent.click(edit());
    changePhone();
    await save();

    await screen.findByText(heading);
    expect(screen.queryByText("01000000001")).toBeNull();
    expect(screen.queryByText("Synthetic Patient")).toBeNull();
    expect(screen.queryByRole("button", { name: t.form.save })).toBeNull();
  });

  it("keeps the form through a server failure when saving", async () => {
    await shown();
    updatePatient.mockResolvedValue(refused(500, "It failed."));

    fireEvent.click(edit());
    changePhone();
    await save();

    await screen.findByText("It failed.");
    expect(phoneField().value).toBe("01000000009");
    expect(readPatient).toHaveBeenCalledTimes(1);
  });
});

describe("reloading", () => {
  it("reads once, and shows what came back", async () => {
    await shown();
    readPatient.mockResolvedValue(found({ ...record, phone: "01000000077" }));

    fireEvent.click(reload());
    await settled();

    expect(readPatient).toHaveBeenCalledTimes(2);
    expect(screen.getByText("01000000077")).toBeTruthy();
  });

  it("keeps the record through a server failure, saying it may be old", async () => {
    await shown();
    readPatient.mockResolvedValue(refused(500, "It failed."));

    fireEvent.click(reload());
    await settled();

    expect(screen.getByText(t.record.outOfDate)).toBeTruthy();
    expect(screen.getByText("It failed.")).toBeTruthy();
    expect(screen.getByText("01000000001")).toBeTruthy();
  });

  it("keeps the record when nothing answered", async () => {
    await shown();
    readPatient.mockResolvedValue(refused(0));

    fireEvent.click(reload());
    await settled();

    expect(screen.getByText(t.record.outOfDate)).toBeTruthy();
    expect(screen.getByText("01000000001")).toBeTruthy();
  });

  it.each([
    [403, shared.states.forbiddenHeading],
    [404, shared.states.notFoundHeading],
  ])("removes the record on %i", async (status, heading) => {
    await shown();
    readPatient.mockResolvedValue(refused(status));

    fireEvent.click(reload());
    await settled();

    expect(screen.getByText(heading)).toBeTruthy();
    expect(screen.queryByText("01000000001")).toBeNull();
    expect(screen.queryByText("Synthetic Patient")).toBeNull();
    expect(screen.queryByText(t.record.outOfDate)).toBeNull();
  });

  it("clears an earlier failure once a reload works", async () => {
    await shown();
    readPatient.mockResolvedValueOnce(refused(500, "It failed."));
    fireEvent.click(reload());
    await settled();
    fireEvent.click(reload());
    await settled();

    expect(screen.queryByText(t.record.outOfDate)).toBeNull();
    expect(screen.queryByText("It failed.")).toBeNull();
  });
});
