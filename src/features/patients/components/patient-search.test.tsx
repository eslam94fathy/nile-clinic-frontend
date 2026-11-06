import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Activity, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import { noteChange } from "../opening";
import { PatientSearch } from "./patient-search";

const searchPatients = vi.hoisted(() => vi.fn());
vi.mock("../api/patients", () => ({ searchPatients }));

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
  usePathname: () => "/patients",
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const { patients: t, shared } = messagesByLocale.en;

const row = (id: number, full_name = `Synthetic Patient ${id}`) => ({
  id,
  full_name,
  sex: "female" as const,
  date_of_birth: "1990-04-12",
  phone: "01000000001",
});

function found(rows = [row(5)], page = 1, lastPage = 1) {
  return {
    ok: true,
    status: 200,
    data: {
      data: rows,
      meta: {
        current_page: page,
        last_page: lastPage,
        per_page: 15,
        total: rows.length,
        from: rows.length ? 1 : null,
        to: rows.length || null,
      },
    },
  };
}
const refused = (
  status: number,
  fieldErrors: Record<string, string[]> = {},
  message?: string,
) => ({
  ok: false,
  error: { status, fieldErrors, ...(message ? { message } : {}) },
});

const BLANK = { name: "", phone: "", id: "", national_id: "" };

function stage(mode: "visible" | "hidden" = "visible") {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messagesByLocale.en}
      timeZone="Africa/Cairo"
    >
      <Activity mode={mode}>
        <PatientSearch />
      </Activity>
    </NextIntlClientProvider>
  );
}

const field = (label: string) =>
  screen.getByRole<HTMLInputElement>("textbox", { name: label });
const nameField = () => field(t.fields.fullName);
const phoneField = () => field(t.fields.phone);
const numberField = () => field(t.fields.number);
const nationalIdField = () => field(t.fields.nationalId);

const type = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: t.search.button }));
    await Promise.resolve();
  });
}

async function searchByName(value = "Synthetic") {
  type(nameField(), value);
  await submit();
}

beforeEach(() => {
  searchPatients.mockReset();
  searchPatients.mockResolvedValue(found());
  push.mockReset();
});
afterEach(cleanup);

describe("before any search", () => {
  it("asks for nothing on being shown, or while typing", () => {
    render(stage());

    expect(screen.getByText(t.search.promptTitle)).toBeTruthy();
    type(nameField(), "Synthetic");
    type(phoneField(), "010");

    expect(searchPatients).not.toHaveBeenCalled();
  });

  it("labels all four fields, with what each one matches", () => {
    render(stage());

    expect(nameField().getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText(t.search.nameHint)).toBeTruthy();
    expect(screen.getAllByText(t.search.wholeValueHint)).toHaveLength(3);
    for (const input of [
      nameField(),
      phoneField(),
      numberField(),
      nationalIdField(),
    ]) {
      expect(input.getAttribute("autocomplete")).toBe("off");
      expect(input.getAttribute("name")).toBeNull();
    }
  });
});

describe("what gets sent", () => {
  it("asks for a term when everything is blank, and sends nothing", async () => {
    render(stage());

    await submit();
    expect(screen.getByRole("alert").textContent).toContain(t.search.needTerm);

    type(nameField(), "   ");
    type(phoneField(), " - ");
    await submit();

    expect(searchPatients).not.toHaveBeenCalled();
  });

  it("converts digits in the number fields, leaving the name as typed", async () => {
    render(stage());

    type(nameField(), " أحمد ٣ ");
    type(phoneField(), "٠١٠ ٠٠٠٠-٠٠٠١");
    type(numberField(), "٥");
    type(nationalIdField(), "٢٩٠٠٤١٢٠١٠٠٠٠١");
    await submit();

    expect(searchPatients).toHaveBeenCalledExactlyOnceWith(
      {
        name: "أحمد ٣",
        phone: "01000000001",
        id: "5",
        national_id: "29004120100001",
      },
      1,
      "en",
    );
  });

  it("leaves blank terms empty, which the API module doesn't send", async () => {
    render(stage());

    await searchByName("Synthetic");

    expect(searchPatients).toHaveBeenCalledExactlyOnceWith(
      { ...BLANK, name: "Synthetic" },
      1,
      "en",
    );
  });

  it("never touches the address", async () => {
    render(stage());

    await searchByName();

    expect(push).not.toHaveBeenCalled();
  });
});

describe("results", () => {
  it("shows only the list's five fields, linking to the record", async () => {
    render(stage());

    await searchByName();

    const table = screen.getByRole("table", { name: t.search.caption });
    expect(table.textContent).toContain("Synthetic Patient 5");
    expect(table.textContent).toContain(t.sex.female);
    expect(table.textContent).toContain("1990-04-12");
    expect(table.textContent).toContain("01000000001");
    const link = screen.getAllByRole("link", {
      name: "Synthetic Patient 5",
    })[0];
    expect(link?.getAttribute("href")).toBe("/patients/5");
    expect(link?.getAttribute("data-prefetch")).toBe("false");
    expect(screen.queryByRole("columnheader", { name: /sort/iu })).toBeNull();
  });

  it("pages with the same terms, by button", async () => {
    searchPatients.mockResolvedValue(found([row(5)], 1, 2));
    render(stage());
    await searchByName();

    searchPatients.mockResolvedValue(found([row(6)], 2, 2));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: shared.table.next }));
      await Promise.resolve();
    });

    expect(searchPatients).toHaveBeenLastCalledWith(
      { ...BLANK, name: "Synthetic" },
      2,
      "en",
    );
    expect(screen.getByRole("table").textContent).toContain(
      "Synthetic Patient 6",
    );
    expect(nameField().value).toBe("Synthetic");
    // The button pressed was replaced, so focus goes to what replaced it, not back to the page's start.
    expect(document.activeElement).toBe(
      screen.getByRole("table").closest("[tabindex='-1']"),
    );
  });

  it("says when nothing matches, keeps the terms, and offers registering", async () => {
    searchPatients.mockResolvedValue(found([]));
    render(stage());

    await searchByName("Nobody");

    expect(screen.getByText(t.search.emptyTitle)).toBeTruthy();
    expect(nameField().value).toBe("Nobody");
    expect(
      screen.getByRole("link", { name: t.register }).getAttribute("href"),
    ).toBe("/patients/new");
  });

  it("applies only the newest search's answer", async () => {
    let answerFirst: (value: unknown) => void = () => undefined;
    searchPatients.mockReturnValueOnce(
      new Promise((resolve) => {
        answerFirst = resolve;
      }),
    );
    render(stage());
    await searchByName("first");

    searchPatients.mockResolvedValueOnce(found([row(2, "Second answer")]));
    await searchByName("second");
    expect(screen.getByRole("table").textContent).toContain("Second answer");

    await act(async () => {
      answerFirst(found([row(1, "First answer")]));
      await Promise.resolve();
    });

    expect(screen.getByRole("table").textContent).not.toContain("First answer");
    expect(screen.getByRole("table").textContent).toContain("Second answer");
  });
});

describe("when the API refuses or fails", () => {
  it("shows a 422 on its field, as sent, and keeps the terms", async () => {
    searchPatients.mockResolvedValue(
      refused(422, { phone: ["That phone can't be right."] }, "Invalid."),
    );
    render(stage());

    type(phoneField(), "12");
    await submit();

    expect(screen.getByText("That phone can't be right.")).toBeTruthy();
    expect(phoneField().getAttribute("aria-invalid")).toBe("true");
    expect(phoneField().value).toBe("12");
  });

  it("shows other 422 keys at form level, dropping none", async () => {
    searchPatients.mockResolvedValue(
      refused(422, { per_page: ["Too many."] }, "Invalid."),
    );
    render(stage());

    await searchByName();

    expect(screen.getByRole("alert").textContent).toContain("Too many.");
  });

  it("clears a field's error once a later search succeeds", async () => {
    searchPatients.mockResolvedValueOnce(
      refused(422, { name: ["Not like that."] }),
    );
    render(stage());
    await searchByName();
    expect(screen.getByText("Not like that.")).toBeTruthy();

    await searchByName("Better");

    expect(screen.queryByText("Not like that.")).toBeNull();
  });

  it("keeps the terms on an error, and retrying repeats the search", async () => {
    searchPatients.mockResolvedValueOnce(refused(500));
    render(stage());
    await searchByName("Kept");

    expect(screen.getByText(shared.states.errorHeading)).toBeTruthy();
    expect(nameField().value).toBe("Kept");
    expect(searchPatients).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: shared.states.retry }),
      );
      await Promise.resolve();
    });

    expect(searchPatients).toHaveBeenCalledTimes(2);
    expect(searchPatients).toHaveBeenLastCalledWith(
      { ...BLANK, name: "Kept" },
      1,
      "en",
    );
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("shows the forbidden state on a 403", async () => {
    searchPatients.mockResolvedValue(refused(403));
    render(stage());

    await searchByName();

    expect(screen.getByText(shared.states.forbiddenHeading)).toBeTruthy();
  });
});

describe("reset", () => {
  it("clears the fields and results, and the search is forgotten", async () => {
    const { rerender } = render(stage());
    await searchByName();

    fireEvent.click(screen.getByRole("button", { name: shared.filters.reset }));

    expect(nameField().value).toBe("");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(t.search.promptTitle)).toBeTruthy();
    expect(searchPatients).toHaveBeenCalledTimes(1);

    noteChange();
    rerender(stage("hidden"));
    await act(async () => {
      rerender(stage());
      await Promise.resolve();
    });
    expect(searchPatients).toHaveBeenCalledTimes(1);
  });

  it("ignores an answer that arrives afterwards", async () => {
    let answer: (value: unknown) => void = () => undefined;
    searchPatients.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(stage());
    await searchByName();

    fireEvent.click(screen.getByRole("button", { name: shared.filters.reset }));
    await act(async () => {
      answer(found());
      await Promise.resolve();
    });

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(t.search.promptTitle)).toBeTruthy();
  });
});

describe("on being shown again", () => {
  async function hideAndShow(rerender: (node: ReactNode) => void) {
    rerender(stage("hidden"));
    await act(async () => {
      rerender(stage());
      await Promise.resolve();
    });
  }

  it("does nothing if no patient changed", async () => {
    const { rerender } = render(stage());
    await searchByName();

    await hideAndShow(rerender);

    expect(searchPatients).toHaveBeenCalledTimes(1);
    expect(nameField().value).toBe("Synthetic");
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("repeats the last search, on the same page, if a patient changed", async () => {
    searchPatients.mockResolvedValue(found([row(5)], 1, 2));
    const { rerender } = render(stage());
    await searchByName();
    searchPatients.mockResolvedValue(found([row(6)], 2, 2));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: shared.table.next }));
      await Promise.resolve();
    });

    noteChange();
    searchPatients.mockResolvedValue(found([row(6, "New name")], 2, 2));
    await hideAndShow(rerender);

    expect(searchPatients).toHaveBeenCalledTimes(3);
    expect(searchPatients).toHaveBeenLastCalledWith(
      { ...BLANK, name: "Synthetic" },
      2,
      "en",
    );
    expect(screen.getByRole("table").textContent).toContain("New name");

    await hideAndShow(rerender);
    expect(searchPatients).toHaveBeenCalledTimes(3);
  });

  it("asks for nothing if there's no search to repeat", async () => {
    const { rerender } = render(stage());

    noteChange();
    await hideAndShow(rerender);

    expect(searchPatients).not.toHaveBeenCalled();
  });

  it("moves to the first page if the one it was on no longer exists", async () => {
    searchPatients.mockResolvedValue(found([row(5)], 1, 2));
    const { rerender } = render(stage());
    await searchByName();
    searchPatients.mockResolvedValue(found([row(6)], 2, 2));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: shared.table.next }));
      await Promise.resolve();
    });

    noteChange();
    searchPatients.mockResolvedValueOnce(found([], 2, 1));
    searchPatients.mockResolvedValueOnce(found([row(5)], 1, 1));
    await hideAndShow(rerender);
    await act(async () => {
      await Promise.resolve();
    });

    expect(searchPatients).toHaveBeenLastCalledWith(
      { ...BLANK, name: "Synthetic" },
      1,
      "en",
    );
    expect(screen.getByRole("table").textContent).toContain(
      "Synthetic Patient 5",
    );
  });
});
