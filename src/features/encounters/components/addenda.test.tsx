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
import { finalized, ok, refused } from "../test-support";
import { Addenda } from "./addenda";

const addAddendum = vi.hoisted(() => vi.fn());
vi.mock("../api/encounters", () => ({
  addAddendum,
  isSessionAlive: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
const endSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session-end", () => ({ endSession }));

const m = messagesByLocale.en;
const t = m.encounters.addenda;
const NOTE = "Synthetic correction";

const addendum = (id: number, text: string) => ({
  id,
  text,
  created_at: "2026-11-07T10:00:00.000000Z",
});

function setUp({ canAdd = true, record = finalized } = {}) {
  const onAdded = vi.fn();
  const onReload = vi.fn();
  renderWithIntl(
    <Addenda
      record={record}
      canAdd={canAdd}
      timeZone="Africa/Cairo"
      onAdded={onAdded}
      onReload={onReload}
    />,
  );
  return { onAdded, onReload };
}

const field = () => screen.getByLabelText<HTMLTextAreaElement>(t.label);
const write = (text = NOTE) =>
  fireEvent.change(field(), { target: { value: text } });
const submit = () => {
  fireEvent.click(screen.getByRole("button", { name: t.add }));
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: t.confirm,
    }),
  );
};

beforeEach(() => {
  addAddendum.mockReset();
  toast.success.mockReset();
  endSession.mockReset();
});
afterEach(() => {
  cleanup();
  resetUnsavedForTests();
});

describe("Addenda", () => {
  it("lists them oldest first, as sent, with their times in the clinic's zone", () => {
    setUp({
      record: {
        ...finalized,
        addenda: [addendum(1, "First"), addendum(2, "Second")],
      },
    });
    const items = screen.getAllByRole("listitem");
    expect(items[0]?.textContent).toContain("First");
    expect(items[1]?.textContent).toContain("Second");
    // 10:00 UTC is 12:00 in Cairo in November.
    expect(items[0]?.textContent).toMatch(/12:00/);
  });

  it("says when there are none", () => {
    setUp();
    expect(screen.getByText(t.empty)).not.toBeNull();
  });

  it("offers adding only to the author", () => {
    setUp({ canAdd: false });
    expect(screen.queryByLabelText(t.label)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("has no length limit, and asks the browser to stay out", () => {
    setUp();
    expect(field().hasAttribute("maxlength")).toBe(false);
    expect(field().getAttribute("spellcheck")).toBe("false");
    expect(field().getAttribute("autocomplete")).toBe("off");
  });

  it("says it's permanent before sending", () => {
    setUp();
    write();
    fireEvent.click(screen.getByRole("button", { name: t.add }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain(t.description);
    expect(dialog.textContent).toContain(m.shared.confirm.irreversible);
    expect(addAddendum).not.toHaveBeenCalled();
  });

  it("passes on what the API returned, and empties the field, with no read", async () => {
    const added = addendum(5, NOTE);
    addAddendum.mockResolvedValue(ok(added, 201));
    const { onAdded, onReload } = setUp();
    write();
    submit();

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(added));
    expect(addAddendum).toHaveBeenCalledWith(finalized.id, NOTE, "en");
    await waitFor(() => expect(field().value).toBe(""));
    expect(onReload).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(t.done);
    expect(hasUnsaved()).toBe(false);
  });

  it("sends empty text for the API to refuse, on the field", async () => {
    addAddendum.mockResolvedValue(refused(422, { text: ["It's required."] }));
    setUp();
    submit();
    await screen.findByText("It's required.");
    expect(addAddendum).toHaveBeenCalledOnce();
  });

  it("keeps the text when refused", async () => {
    addAddendum.mockResolvedValue(refused(422, { text: ["Too long."] }));
    setUp();
    write();
    submit();

    await screen.findByText("Too long.");
    expect(field().value).toBe(NOTE);
  });

  it("shows a message with no field at form level", async () => {
    addAddendum.mockResolvedValue(refused(422, { encounter: ["A draft."] }));
    setUp();
    write();
    submit();
    await screen.findByText("A draft.");
  });

  it("warns that adding again could add it twice, when no answer comes", async () => {
    addAddendum.mockResolvedValue(refused(0));
    const { onReload } = setUp();
    write();
    submit();

    await screen.findByText(t.unknown);
    expect(field().value).toBe(NOTE);
    expect(addAddendum).toHaveBeenCalledOnce();
    expect(onReload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: t.openRecord }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("says nothing was added on a 500", async () => {
    addAddendum.mockResolvedValue(refused(500));
    setUp();
    write();
    submit();
    await screen.findByText(t.notAdded);
    expect(field().value).toBe(NOTE);
  });

  it("keeps the text when the session has ended", async () => {
    addAddendum.mockResolvedValue(refused(401));
    setUp();
    write();
    submit();

    await screen.findByText(m.encounters.sessionEnded.heading);
    expect(field().value).toBe(NOTE);
    expect(endSession).not.toHaveBeenCalled();
  });

  it("guards unsaved text", () => {
    setUp();
    expect(hasUnsaved()).toBe(false);
    write();
    expect(hasUnsaved()).toBe(true);
  });
});
