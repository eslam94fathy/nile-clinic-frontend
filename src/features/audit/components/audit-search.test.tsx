import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "@/lib/api/api-error";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { syntheticEntry } from "../test-support";
import type { AuditPage } from "../types";
import { AuditSearch } from "./audit-search";

const { searchAuditEntries, refresh, push } = vi.hoisted(() => ({
  searchAuditEntries: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));
vi.mock("../api/audit", () => ({ searchAuditEntries }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  usePathname: () => "/audit",
  useRouter: () => ({ refresh, push }),
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));
vi.mock("@/features/patients/public", () => ({
  PatientLink: ({ id, children }: { id: number; children: ReactNode }) => (
    <a href={`/patients/${String(id)}`}>{children}</a>
  ),
}));

const t = messagesByLocale.en.audit;
const states = messagesByLocale.en.shared.states;
const pager = messagesByLocale.en.shared.cursorPager;

const page = (
  ids: number[],
  next: string | null = null,
  prev: string | null = null,
): ApiResult<AuditPage> => ({
  ok: true,
  status: 200,
  data: {
    data: ids.map((id) => syntheticEntry({ id })),
    meta: { per_page: 25, next_cursor: next, prev_cursor: prev },
  },
});
const failure = (
  status: number,
  fieldErrors: Record<string, string[]> = {},
  message?: string,
): ApiResult<AuditPage> => ({
  ok: false,
  error: { status, fieldErrors, ...(message ? { message } : {}) },
});

const staff = [
  { id: 3, name: "Synthetic Admin", is_active: true },
  { id: 4, name: "Synthetic Former", is_active: false },
];

function open(staffList: typeof staff | null = staff) {
  renderWithIntl(<AuditSearch staff={staffList} timeZone="Africa/Cairo" />);
}

const field = (label: string) => screen.getByLabelText(label);
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const entries = () => screen.queryAllByRole("article");

beforeEach(() => {
  searchAuditEntries.mockReset();
  searchAuditEntries.mockResolvedValue(page([3, 2], "c2"));
  refresh.mockClear();
  push.mockClear();
});
afterEach(cleanup);

describe("before a search", () => {
  it("shows the notice and invites a search, reading nothing", () => {
    open();
    expect(screen.getByText(t.notice)).toBeTruthy();
    expect(screen.getByText(t.states.beforeSearchTitle)).toBeTruthy();
    expect(searchAuditEntries).not.toHaveBeenCalled();
  });

  it("offers every account, marking deactivated ones, and groups the actions", () => {
    open();
    const options = within(field(t.filters.staff)).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      t.filters.any,
      "Synthetic Admin",
      t.filters.deactivated.replace("{name}", "Synthetic Former"),
    ]);
    expect(field(t.filters.action).querySelectorAll("optgroup")).toHaveLength(
      10,
    );
  });

  it("offers a number for the staff member if the accounts couldn't be read", () => {
    open(null);
    expect(field(t.filters.staffNumber).tagName).toBe("INPUT");
  });
});

describe("searching", () => {
  it("reads once on Search, with the filters set, and shows the entries", async () => {
    open();
    type(t.filters.patient, "12");
    press(t.filters.search);

    await waitFor(() => expect(entries()).toHaveLength(2));
    expect(searchAuditEntries).toHaveBeenCalledOnce();
    expect(searchAuditEntries).toHaveBeenCalledWith(
      { patient_id: 12 },
      null,
      "en",
    );
    expect(screen.getByText(pager.newest)).toBeTruthy();
  });

  it("changing a filter reads nothing, and says the results are the previous search's", async () => {
    open();
    press(t.filters.search);
    await waitFor(() => expect(entries()).toHaveLength(2));

    type(t.filters.patient, "12");
    fireEvent.change(field(t.filters.patient), { target: { value: "12" } });

    expect(screen.getByText(t.states.outOfDate)).toBeTruthy();
    expect(searchAuditEntries).toHaveBeenCalledOnce();
  });

  it("shows the empty state, keeping the filters", async () => {
    searchAuditEntries.mockResolvedValueOnce(page([]));
    open();
    type(t.filters.patient, "999");
    press(t.filters.search);

    await waitFor(() =>
      expect(screen.getByText(t.states.emptyTitle)).toBeTruthy(),
    );
    expect((field(t.filters.patient) as HTMLInputElement).value).toBe("999");
  });

  it("shows an error with Try again, which reads once more", async () => {
    searchAuditEntries.mockResolvedValueOnce(
      failure(500, {}, "Server trouble."),
    );
    open();
    press(t.filters.search);

    await waitFor(() =>
      expect(screen.getByText("Server trouble.")).toBeTruthy(),
    );
    press(states.retry);
    await waitFor(() => expect(entries()).toHaveLength(2));
    expect(searchAuditEntries).toHaveBeenCalledTimes(2);
  });

  it("shows the forbidden state on a 403, and lets the page re-decide", async () => {
    searchAuditEntries.mockResolvedValueOnce(failure(403));
    open();
    press(t.filters.search);

    await waitFor(() =>
      expect(screen.getByText(states.forbiddenHeading)).toBeTruthy(),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("Clear empties the filters and returns to before a search, reading nothing", async () => {
    open();
    press(t.filters.search);
    await waitFor(() => expect(entries()).toHaveLength(2));

    type(t.filters.patient, "12");
    press(t.filters.clear);

    expect((field(t.filters.patient) as HTMLInputElement).value).toBe("");
    expect(screen.getByText(t.states.beforeSearchTitle)).toBeTruthy();
    expect(searchAuditEntries).toHaveBeenCalledOnce();
  });
});

describe("problems with the filters", () => {
  it.each([
    [
      { [t.filters.from]: "2026-11-05", [t.filters.to]: "2026-11-01" },
      t.problems.reversed,
    ],
    [{ [t.filters.subjectNumber]: "57" }, t.problems.needsType],
    [{ [t.filters.patient]: "-3" }, t.problems.notANumber],
  ])("shows %o's problem on its field and sends nothing", (values, problem) => {
    open();
    for (const [label, value] of Object.entries(values)) type(label, value);
    press(t.filters.search);

    expect(screen.getByText(problem)).toBeTruthy();
    expect(searchAuditEntries).not.toHaveBeenCalled();
  });

  it("checks a typed staff number", () => {
    open(null);
    type(t.filters.staffNumber, "abc");
    press(t.filters.search);
    expect(screen.getByText(t.problems.notANumber)).toBeTruthy();
    expect(searchAuditEntries).not.toHaveBeenCalled();
  });

  it("puts the API's refusals on their fields, and any other at form level", async () => {
    searchAuditEntries.mockResolvedValueOnce(
      failure(422, { to: ["The end is wrong."], period: ["Something else."] }),
    );
    open();
    press(t.filters.search);

    await waitFor(() =>
      expect(screen.getByText("The end is wrong.")).toBeTruthy(),
    );
    expect(field(t.filters.to).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Something else.")).toBeTruthy();
  });
});

describe("paging", () => {
  async function searched() {
    open();
    type(t.filters.patient, "12");
    press(t.filters.search);
    await waitFor(() => expect(entries()).toHaveLength(2));
  }

  it("moves with the filters shown, not the form's", async () => {
    await searched();
    type(t.filters.patient, "99");
    searchAuditEntries.mockResolvedValueOnce(page([1], null, "c1"));
    press(pager.older);

    await waitFor(() => expect(entries()).toHaveLength(1));
    expect(searchAuditEntries).toHaveBeenLastCalledWith(
      { patient_id: 12 },
      "c2",
      "en",
    );
    expect(screen.getByRole("button", { name: pager.older })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.queryByText(pager.newest)).toBeNull();
  });

  it("keeps the page when a move fails, and Try again repeats it", async () => {
    await searched();
    searchAuditEntries.mockResolvedValueOnce(failure(500));
    press(pager.older);

    await waitFor(() =>
      expect(
        screen.getByText(t.states.moveFailed, { exact: false }),
      ).toBeTruthy(),
    );
    expect(entries()).toHaveLength(2);
    press(states.retry);
    await waitFor(() => expect(searchAuditEntries).toHaveBeenCalledTimes(3));
    expect(searchAuditEntries).toHaveBeenLastCalledWith(
      { patient_id: 12 },
      "c2",
      "en",
    );
  });

  it("offers to start again after a refused position", async () => {
    await searched();
    searchAuditEntries.mockResolvedValueOnce(
      failure(422, { cursor: ["Invalid position."] }),
    );
    press(pager.older);

    await waitFor(() =>
      expect(screen.getByText(t.states.positionRefused)).toBeTruthy(),
    );
    await act(async () => press(t.states.startAgain));
    expect(searchAuditEntries).toHaveBeenLastCalledWith(
      { patient_id: 12 },
      null,
      "en",
    );
  });
});

describe("the out-of-date notice", () => {
  function later() {
    let resolve: (result: ApiResult<AuditPage>) => void = () => undefined;
    const promise = new Promise<ApiResult<AuditPage>>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  }

  async function searchedFor(patient: string) {
    open();
    type(t.filters.patient, patient);
    press(t.filters.search);
    await waitFor(() => expect(entries()).toHaveLength(2));
  }

  it("goes when the form is changed back to what was searched", async () => {
    await searchedFor("1");
    type(t.filters.patient, "2");
    expect(screen.getByText(t.states.outOfDate)).toBeTruthy();

    type(t.filters.patient, "1");
    expect(screen.queryByText(t.states.outOfDate)).toBeNull();
  });

  it("refuses Search while Older reads, and the older page then says the form has moved on", async () => {
    await searchedFor("1");
    const older = later();
    searchAuditEntries.mockReturnValueOnce(older.promise);
    press(pager.older);

    type(t.filters.patient, "2");
    const search = screen.getByRole("button", { name: t.filters.search });
    expect(search.getAttribute("aria-disabled")).toBe("true");
    press(t.filters.search);

    await act(async () => older.resolve(page([1], null, "c1")));
    expect(entries()).toHaveLength(1);
    expect(searchAuditEntries).toHaveBeenCalledTimes(2);
    expect(screen.getByText(t.states.outOfDate)).toBeTruthy();
    expect(search.getAttribute("aria-disabled")).toBeNull();
  });

  it("stays after a refused search, as the page shown is still the previous one", async () => {
    await searchedFor("1");
    searchAuditEntries.mockResolvedValueOnce(
      failure(422, { to: ["The end is wrong."] }),
    );
    type(t.filters.patient, "2");
    press(t.filters.search);

    await waitFor(() =>
      expect(screen.getByText("The end is wrong.")).toBeTruthy(),
    );
    expect(entries()).toHaveLength(2);
    expect(screen.getByText(t.states.outOfDate)).toBeTruthy();
  });

  it("compares an edit made during a search with that search's results, not the page before", async () => {
    await searchedFor("1");
    const reading = later();
    searchAuditEntries.mockReturnValueOnce(reading.promise);
    type(t.filters.patient, "2");
    press(t.filters.search);

    type(t.filters.patient, "1");
    await act(async () => reading.resolve(page([5])));
    expect(entries()).toHaveLength(1);
    expect(screen.getByText(t.states.outOfDate)).toBeTruthy();
  });
});
