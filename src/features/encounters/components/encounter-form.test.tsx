import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasUnsaved, resetUnsavedForTests } from "@/lib/unsaved-changes";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { draft, finalized, ok, pageOf, refused } from "../test-support";
import { EncounterForm } from "./encounter-form";

const api = vi.hoisted(() => ({
  saveEncounter: vi.fn(),
  finalizeEncounter: vi.fn(),
  readTodaysList: vi.fn(),
  readHistory: vi.fn(),
  readEncounter: vi.fn(),
  isSessionAlive: vi.fn(),
}));
vi.mock("../api/encounters", () => api);
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router }));
const endSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session-end", () => ({ endSession }));

const m = messagesByLocale.en;
const t = m.encounters;
const NOTE = "Synthetic note, with a line\nand another";

const setUp = (record = draft) => {
  const onFinalized = vi.fn();
  renderWithIntl(
    <EncounterForm
      record={record}
      timeZone="Africa/Cairo"
      onFinalized={onFinalized}
      readFailure={null}
    />,
  );
  return { onFinalized };
};

const field = (label: string) =>
  screen.getByLabelText<HTMLTextAreaElement>(label);
const write = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const inDialog = (name: string) =>
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name }),
  );
const sentBody = () =>
  api.saveEncounter.mock.calls[0]?.[1] as {
    diagnosis: string | null;
    prescriptions: { medication: string }[];
  };

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset();
  api.readTodaysList.mockResolvedValue(refused(500));
  api.saveEncounter.mockImplementation((_id, body) =>
    Promise.resolve(ok({ ...draft, ...body })),
  );
  api.finalizeEncounter.mockResolvedValue(ok(finalized));
  toast.success.mockReset();
  router.refresh.mockReset();
  endSession.mockReset();
});

afterEach(() => {
  cleanup();
  resetUnsavedForTests();
});

describe("what's shown", () => {
  it("offers every field, with the record's text", () => {
    setUp();
    expect(field(t.form.chiefComplaint).value).toBe("Synthetic complaint");
    expect(field(t.form.examinationFindings).value).toBe("");
    expect(field(t.form.diagnosis).value).toBe("");
    expect(field(t.form.treatmentPlan).value).toBe("");
  });

  it("asks the browser and extensions to stay out, and never limits length", () => {
    setUp();
    const form = field(t.form.diagnosis).closest("form");
    expect(form?.getAttribute("autocomplete")).toBe("off");
    expect(form?.getAttribute("method")).toBe("post");

    for (const label of [t.form.chiefComplaint, t.form.diagnosis]) {
      const input = field(label);
      expect(input.getAttribute("autocomplete")).toBe("off");
      expect(input.getAttribute("spellcheck")).toBe("false");
      expect(input.getAttribute("writingsuggestions")).toBe("false");
      expect(input.getAttribute("data-gramm")).toBe("false");
      expect(input.hasAttribute("maxlength")).toBe(false);
    }
  });

  it("says nothing saves by itself", () => {
    setUp();
    expect(screen.getByText(t.form.noAutomaticSave)).not.toBeNull();
  });

  it("offers no history until today's list says so", async () => {
    setUp();
    await waitFor(() => expect(api.readTodaysList).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button", { name: t.panel.open })).toBeNull();
  });
});

describe("the unsaved notice", () => {
  it("shows whether anything is unsaved, and holds on while it is", () => {
    setUp();
    expect(screen.getByRole("status").textContent).toContain(t.status.saved);
    expect(hasUnsaved()).toBe(false);

    write(t.form.diagnosis, NOTE);
    expect(screen.getByRole("status").textContent).toContain(t.status.unsaved);
    expect(hasUnsaved()).toBe(true);
  });

  it("isn't fooled by spaces", () => {
    setUp();
    write(t.form.diagnosis, "   ");
    expect(screen.getByRole("status").textContent).toContain(t.status.saved);
  });
});

describe("saving", () => {
  it("sends nothing when nothing has changed, and says so", () => {
    setUp();
    press(t.save.action);
    expect(api.saveEncounter).not.toHaveBeenCalled();
    expect(screen.getByText(m.shared.form.nothingToSave)).not.toBeNull();
  });

  it("sends all five keys, keeps text whole, and uses the answer", async () => {
    setUp();
    const long = "ن".repeat(12_000);
    write(t.form.diagnosis, long);
    press(t.save.action);

    await waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
    expect(Object.keys(sentBody()).sort()).toEqual([
      "chief_complaint",
      "diagnosis",
      "examination_findings",
      "prescriptions",
      "treatment_plan",
    ]);
    expect(sentBody().diagnosis).toBe(long);
    expect(screen.getByRole("status").textContent).toContain(t.status.saved);
    expect(hasUnsaved()).toBe(false);
  });

  it("doesn't repeat clinical text in its confirmation", async () => {
    setUp();
    write(t.form.diagnosis, NOTE);
    press(t.save.action);
    await waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith(t.save.done);
  });

  it("makes fields read-only while it runs, so nothing can be overwritten", async () => {
    let answer: (value: unknown) => void = () => {};
    api.saveEncounter.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    setUp();
    const input = field(t.form.diagnosis);
    write(t.form.diagnosis, NOTE);
    input.focus();
    press(t.save.action);

    await waitFor(() => expect(input.readOnly).toBe(true));
    expect(document.activeElement).not.toBe(document.body);
    press(t.save.working);
    expect(api.saveEncounter).toHaveBeenCalledOnce();

    answer(ok({ ...draft, diagnosis: NOTE }));
    await waitFor(() => expect(input.readOnly).toBe(false));
  });
});

describe("refusals keep everything typed", () => {
  it("puts messages on their fields", async () => {
    api.saveEncounter.mockResolvedValue(
      refused(422, { diagnosis: ["Too long."] }),
    );
    setUp();
    write(t.form.diagnosis, NOTE);
    press(t.save.action);

    await screen.findByText("Too long.");
    expect(field(t.form.diagnosis).value).toBe(NOTE);
    expect(field(t.form.diagnosis).getAttribute("aria-invalid")).toBe("true");
  });

  it("puts a line's message on the line on screen, past an empty one", async () => {
    setUp();
    press(t.form.lines.add);
    press(t.form.lines.add);
    const medication = screen.getAllByLabelText<HTMLInputElement>(
      t.form.lines.medication,
    );
    fireEvent.change(medication[1] as HTMLInputElement, {
      target: { value: "Synthetic" },
    });
    api.saveEncounter.mockResolvedValue(
      refused(422, { "prescriptions.0.dosage": ["Needs a dosage."] }),
    );
    press(t.save.action);

    await screen.findByText("Needs a dosage.");
    expect(sentBody().prescriptions).toHaveLength(1);
    const secondLine = screen.getByRole("group", {
      name: t.form.lines.lineHeading.replace("{number}", "2"),
    });
    expect(within(secondLine).queryByText("Needs a dosage.")).not.toBeNull();
    const firstLine = screen.getByRole("group", {
      name: t.form.lines.lineHeading.replace("{number}", "1"),
    });
    expect(within(firstLine).queryByText("Needs a dosage.")).toBeNull();
  });

  it("puts what has no field at form level", async () => {
    api.saveEncounter.mockResolvedValue(
      refused(422, { prescriptions: ["At most 20."] }),
    );
    setUp();
    write(t.form.diagnosis, NOTE);
    press(t.save.action);
    await screen.findByText("At most 20.");
  });

  it("says nothing was saved on a 500", async () => {
    api.saveEncounter.mockResolvedValue(refused(500, {}, "Went wrong."));
    setUp();
    write(t.form.diagnosis, NOTE);
    press(t.save.action);

    await screen.findByText(t.failure.notSaved);
    expect(field(t.form.diagnosis).value).toBe(NOTE);
    expect(api.saveEncounter).toHaveBeenCalledOnce();
  });

  it.each([0, 502, 503])(
    "says it isn't known on status %i, and sends nothing again",
    async (status) => {
      api.saveEncounter.mockResolvedValue(refused(status));
      setUp();
      write(t.form.diagnosis, NOTE);
      press(t.save.action);

      await screen.findByText(t.failure.saveUnknown);
      expect(field(t.form.diagnosis).value).toBe(NOTE);
      expect(api.saveEncounter).toHaveBeenCalledOnce();
    },
  );

  it.each([403, 404])(
    "keeps the text on a %i, doesn't re-decide the page, and offers no more saving",
    async (status) => {
      api.saveEncounter.mockResolvedValue(refused(status, {}, "Not allowed."));
      setUp();
      write(t.form.diagnosis, NOTE);
      press(t.save.action);

      await screen.findByText("Not allowed.");
      expect(screen.getByText(t.failure.stopped)).not.toBeNull();
      expect(field(t.form.diagnosis).value).toBe(NOTE);
      expect(router.refresh).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: t.save.action })).toBeNull();
    },
  );

  it("keeps the text when the session has ended, and leaves only when asked", async () => {
    api.saveEncounter.mockResolvedValue(refused(401, {}, "Signed out."));
    setUp();
    write(t.form.diagnosis, NOTE);
    press(t.save.action);

    await screen.findByText(t.sessionEnded.heading);
    expect(field(t.form.diagnosis).value).toBe(NOTE);
    expect(screen.queryByText("Signed out.")).toBeNull();
    expect(endSession).not.toHaveBeenCalled();

    api.isSessionAlive.mockResolvedValue(false);
    press(t.sessionEnded.signIn);
    await waitFor(() => expect(endSession).toHaveBeenCalledOnce());
  });

  it("doesn't end a session another tab has signed in to again", async () => {
    api.saveEncounter.mockResolvedValueOnce(refused(401));
    api.isSessionAlive.mockResolvedValue(true);
    setUp();
    write(t.form.diagnosis, NOTE);
    press(t.save.action);
    await screen.findByText(t.sessionEnded.heading);

    press(t.sessionEnded.signIn);
    await waitFor(() =>
      expect(screen.queryByText(t.sessionEnded.heading)).toBeNull(),
    );
    expect(endSession).not.toHaveBeenCalled();
    expect(field(t.form.diagnosis).value).toBe(NOTE);
  });

  it("keeps saving on offer after a session ended, and a success clears the notice", async () => {
    api.saveEncounter.mockResolvedValueOnce(refused(401));
    setUp();
    write(t.form.diagnosis, NOTE);
    press(t.save.action);
    await screen.findByText(t.sessionEnded.heading);

    press(t.save.action);
    await waitFor(() =>
      expect(screen.queryByText(t.sessionEnded.heading)).toBeNull(),
    );
    expect(toast.success).toHaveBeenCalledWith(t.save.done);
  });

  it("offers the record beside the text when it was finalized elsewhere, reading nothing until asked", async () => {
    api.saveEncounter.mockResolvedValue(
      refused(422, { encounter: ["Finalized already."] }),
    );
    api.readEncounter.mockResolvedValue(ok(finalized));
    setUp();
    write(t.form.diagnosis, NOTE);
    press(t.save.action);

    await screen.findByText("Finalized already.");
    expect(api.readEncounter).not.toHaveBeenCalled();

    press(t.failure.openAsItStands);
    await screen.findByText("Synthetic diagnosis");
    expect(api.readEncounter).toHaveBeenCalledOnce();
    expect(field(t.form.diagnosis).value).toBe(NOTE);
  });
});

describe("finalizing", () => {
  const finalize = () => {
    press(t.finalize.action);
    inDialog(t.finalize.confirm);
  };

  it("says what it does, on the safe choice", () => {
    setUp();
    press(t.finalize.action);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain(t.finalize.description);
    expect(dialog.textContent).toContain(m.shared.confirm.irreversible);
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: m.shared.confirm.cancel }),
    );
  });

  it("doesn't save when nothing has changed", async () => {
    const { onFinalized } = setUp();
    finalize();

    await waitFor(() => expect(onFinalized).toHaveBeenCalledOnce());
    expect(api.saveEncounter).not.toHaveBeenCalled();
    expect(api.finalizeEncounter).toHaveBeenCalledOnce();
  });

  it("saves what's on screen first, then locks it", async () => {
    const order: string[] = [];
    api.saveEncounter.mockImplementation((_id, body) => {
      order.push("save");
      return Promise.resolve(ok({ ...draft, ...body }));
    });
    api.finalizeEncounter.mockImplementation(() => {
      order.push("finalize");
      return Promise.resolve(
        ok({
          ...finalized,
          diagnosis: NOTE,
          chief_complaint: "Synthetic complaint",
        }),
      );
    });
    const { onFinalized } = setUp();
    write(t.form.diagnosis, NOTE);
    finalize();

    await waitFor(() => expect(onFinalized).toHaveBeenCalledOnce());
    expect(order).toEqual(["save", "finalize"]);
    expect(sentBody().diagnosis).toBe(NOTE);
    expect(onFinalized.mock.calls[0]?.[1]).toBe(false);
  });

  it("reports when what's locked differs, which another tab can cause", async () => {
    api.finalizeEncounter.mockResolvedValue(
      ok({ ...finalized, chief_complaint: "Another tab's text" }),
    );
    const { onFinalized } = setUp();
    finalize();

    await waitFor(() => expect(onFinalized).toHaveBeenCalledOnce());
    expect(onFinalized.mock.calls[0]?.[1]).toBe(true);
  });

  it.each([
    ["refused", refused(422, { diagnosis: ["Too long."] }), "Too long."],
    ["a 500", refused(500), t.failure.notSaved],
    ["no answer", refused(0), t.failure.saveUnknown],
  ])("locks nothing when the save gets %s", async (_name, answer, shown) => {
    api.saveEncounter.mockResolvedValue(answer);
    setUp();
    write(t.form.diagnosis, NOTE);
    finalize();

    await screen.findByText(shown);
    expect(api.finalizeEncounter).not.toHaveBeenCalled();
    expect(field(t.form.diagnosis).value).toBe(NOTE);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("sends the request whatever's missing, and shows the API's answer on the fields", async () => {
    api.finalizeEncounter.mockResolvedValue(
      refused(422, { diagnosis: ["The diagnosis is required."] }),
    );
    const { onFinalized } = setUp();
    finalize();

    await screen.findByText("The diagnosis is required.");
    expect(api.finalizeEncounter).toHaveBeenCalledOnce();
    expect(onFinalized).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("matches a refusal's lines to the screen, after saving removed an empty line", async () => {
    setUp({
      ...draft,
      prescriptions: [{ medication: "Synthetic" }],
    });
    press(t.form.lines.add);
    api.finalizeEncounter.mockResolvedValue(
      refused(422, { "prescriptions.0.dosage": ["Needs a dosage."] }),
    );
    finalize();

    await screen.findByText("Needs a dosage.");
    const firstLine = screen.getByRole("group", {
      name: t.form.lines.lineHeading.replace("{number}", "1"),
    });
    expect(within(firstLine).queryByText("Needs a dosage.")).not.toBeNull();
  });

  it("says nothing was finalized on a 500", async () => {
    api.finalizeEncounter.mockResolvedValue(refused(500));
    setUp();
    finalize();
    await screen.findByText(t.failure.notFinalized);
  });

  it("says it isn't known when no answer comes, and reads nothing until asked", async () => {
    api.finalizeEncounter.mockResolvedValue(refused(0));
    api.readEncounter.mockResolvedValue(ok(finalized));
    setUp();
    write(t.form.diagnosis, NOTE);
    finalize();

    await screen.findByText(t.failure.finalizeUnknown);
    expect(api.finalizeEncounter).toHaveBeenCalledOnce();
    expect(api.readEncounter).not.toHaveBeenCalled();
    press(t.failure.openAsItStands);
    await waitFor(() => expect(api.readEncounter).toHaveBeenCalledOnce());
  });

  it("keeps the text when the session has ended", async () => {
    api.finalizeEncounter.mockResolvedValue(refused(401));
    setUp();
    finalize();
    await screen.findByText(t.sessionEnded.heading);
    expect(endSession).not.toHaveBeenCalled();
  });
});

describe("the panel", () => {
  const onTheList = () =>
    api.readTodaysList.mockResolvedValue(
      ok({ data: [{ status: "seen", patient: { id: draft.patient.id } }] }),
    );

  it("reads nothing until a person opens it, and leaves what's typed alone", async () => {
    onTheList();
    api.readHistory.mockResolvedValue(ok(pageOf([])));
    setUp();
    write(t.form.diagnosis, NOTE);

    const open = await screen.findByRole("button", { name: t.panel.open });
    expect(api.readHistory).not.toHaveBeenCalled();

    fireEvent.click(open);
    await screen.findByText(t.history.emptyTitle);
    expect(api.readHistory).toHaveBeenCalledOnce();
    expect(field(t.form.diagnosis).value).toBe(NOTE);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("shows the notice instead of leaving, if the session has ended", async () => {
    onTheList();
    api.readHistory.mockResolvedValue(refused(401));
    setUp();
    write(t.form.diagnosis, NOTE);

    fireEvent.click(await screen.findByRole("button", { name: t.panel.open }));
    await screen.findByText(t.sessionEnded.heading);
    expect(endSession).not.toHaveBeenCalled();
    expect(field(t.form.diagnosis).value).toBe(NOTE);
  });
});

describe("closing the panel", () => {
  it("moves focus to the status line when no button opened it", async () => {
    api.saveEncounter.mockResolvedValue(
      refused(422, { encounter: ["Finalized already."] }),
    );
    api.readEncounter.mockResolvedValue(ok(finalized));
    setUp();
    write(t.form.diagnosis, NOTE);
    press(t.save.action);
    await screen.findByText("Finalized already.");
    press(t.failure.openAsItStands);
    await screen.findByText("Synthetic diagnosis");

    press(t.panel.close);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("status")),
    );
  });
});

describe("prescription lines", () => {
  it("adds and removes, with no confirmation, showing as unsaved", () => {
    setUp();
    expect(screen.getByText(t.form.lines.empty)).not.toBeNull();

    press(t.form.lines.add);
    const medication = screen.getByLabelText(t.form.lines.medication);
    fireEvent.change(medication, { target: { value: "Synthetic" } });
    expect(screen.getByRole("status").textContent).toContain(t.status.unsaved);

    const removal = t.form.lines.remove.replace("{number}", "1");
    press(removal);
    expect(screen.queryByLabelText(t.form.lines.medication)).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain(t.status.saved);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: t.form.lines.add }),
    );
  });

  it("stops adding at 20, as a convenience", () => {
    setUp();
    const add = screen.getByRole<HTMLButtonElement>("button", {
      name: t.form.lines.add,
    });
    for (let line = 0; line < 20; line += 1) fireEvent.click(add);
    expect(add.disabled).toBe(true);
  });

  it("asks the browser to stay out of each line's fields too", () => {
    setUp();
    press(t.form.lines.add);
    const input = screen.getByLabelText(t.form.lines.dosage);
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.hasAttribute("maxlength")).toBe(false);
  });
});
