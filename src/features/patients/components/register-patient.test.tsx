import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import { changeCount, takeHandedOver } from "../opening";
import { RegisterPatient } from "./register-patient";

const findByPhone = vi.hoisted(() => vi.fn());
const registerPatient = vi.hoisted(() => vi.fn());
vi.mock("../api/patients", () => ({ findByPhone, registerPatient }));

const replace = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
  useRouter: () => ({ replace, refresh }),
}));

const success = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success } }));

const { patients: t } = messagesByLocale.en;
const f = t.fields;

const TODAY = "2026-11-06";

const summary = (id: number) => ({
  id,
  full_name: `Synthetic Match ${id}`,
  sex: "female" as const,
  date_of_birth: "1990-04-12",
  phone: "01000000001",
});
const page = (rows: ReturnType<typeof summary>[], total = rows.length) => ({
  ok: true,
  status: 200,
  data: {
    data: rows,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 10,
      total,
      from: rows.length ? 1 : null,
      to: rows.length || null,
    },
  },
});
const saved = {
  ok: true,
  status: 201,
  data: {
    ...summary(42),
    full_name: "Synthetic New",
    national_id: null,
    address: null,
    emergency_contact: null,
    created_at: "2026-11-06T10:00:00.000000Z",
    updated_at: "2026-11-06T10:00:00.000000Z",
  },
};
const refused = (
  status: number,
  fieldErrors: Record<string, string[]> = {},
  message?: string,
) => ({
  ok: false,
  error: { status, fieldErrors, ...(message ? { message } : {}) },
});

function stage() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messagesByLocale.en}
      timeZone="Africa/Cairo"
    >
      <RegisterPatient today={TODAY} />
    </NextIntlClientProvider>,
  );
}

const input = (label: string) =>
  screen.getByLabelText<HTMLInputElement>(new RegExp(`^${label}`, "u"));

const set = (label: string, value: string) =>
  fireEvent.change(input(label), { target: { value } });

function fillRequired(phone = "010 0000-0001") {
  set(f.fullName, "  Synthetic New  ");
  set(f.dateOfBirth, "1990-04-12");
  set(f.sex, "female");
  set(f.phone, phone);
}

const submitButton = () =>
  screen.getByRole("button", { name: t.registerForm.submit });

async function submit() {
  await act(async () => {
    fireEvent.click(submitButton());
    await Promise.resolve();
  });
}

async function press(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
    await Promise.resolve();
  });
}

beforeEach(() => {
  findByPhone.mockReset();
  registerPatient.mockReset();
  findByPhone.mockResolvedValue(page([]));
  registerPatient.mockResolvedValue(saved);
  replace.mockReset();
  refresh.mockReset();
  success.mockReset();
  takeHandedOver(42);
});
afterEach(cleanup);

describe("the form", () => {
  it("has no preselected sex, and autofill off on every field", () => {
    stage();

    expect(input(f.sex).value).toBe("");
    for (const label of [
      f.fullName,
      f.dateOfBirth,
      f.phone,
      f.nationalId,
      f.address,
      f.contactName,
      f.contactRelationship,
      f.contactPhone,
    ]) {
      expect(input(label).getAttribute("autocomplete")).toBe("off");
    }
    expect(input(f.fullName).getAttribute("dir")).toBe("auto");
    expect(input(f.phone).getAttribute("dir")).toBe("ltr");
    expect(input(f.dateOfBirth).getAttribute("type")).toBe("date");
  });

  it("gives quick feedback for each rule, and sends nothing", async () => {
    stage();

    await submit();

    await screen.findByText(t.form.nameRequired);
    expect(screen.getByText(t.form.dateRequired)).toBeTruthy();
    expect(screen.getByText(t.form.sexRequired)).toBeTruthy();
    expect(screen.getByText(t.form.phoneRule)).toBeTruthy();

    set(f.dateOfBirth, "2026-11-07");
    set(f.nationalId, "123");
    set(f.contactName, "Synthetic Guardian");
    await submit();

    await screen.findByText(t.form.dateRange);
    expect(screen.getByText(t.form.nationalIdRule)).toBeTruthy();
    expect(screen.getAllByText(t.form.contactPartRequired)).toHaveLength(2);
    expect(findByPhone).not.toHaveBeenCalled();
    expect(registerPatient).not.toHaveBeenCalled();
  });
});

describe("with no duplicates", () => {
  it("checks the phone, saves, hands over the record, and moves to it", async () => {
    stage();
    const changes = changeCount();
    fillRequired();

    await submit();

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(findByPhone).toHaveBeenCalledExactlyOnceWith("01000000001", "en");
    expect(registerPatient).toHaveBeenCalledExactlyOnceWith(
      {
        full_name: "Synthetic New",
        date_of_birth: "1990-04-12",
        sex: "female",
        phone: "01000000001",
      },
      "en",
    );
    expect(replace).toHaveBeenCalledExactlyOnceWith("/patients/42");
    expect(takeHandedOver(42)?.full_name).toBe("Synthetic New");
    expect(changeCount()).toBe(changes + 1);
    expect(success).toHaveBeenCalledExactlyOnceWith(
      t.registerForm.registered.replace("{number}", "42"),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("empties the form afterwards, as the page stays held", async () => {
    stage();
    fillRequired();

    await submit();

    await waitFor(() => expect(replace).toHaveBeenCalled());
    await waitFor(() => expect(input(f.fullName).value).toBe(""));
    expect(input(f.phone).value).toBe("");
  });

  it("sends every detail that was entered", async () => {
    stage();
    fillRequired();
    set(f.nationalId, "٢٩٠٠٤١٢٠١٠٠٠٠١");
    set(f.address, " 12 Synthetic St ");
    set(f.contactName, "Synthetic Guardian");
    set(f.contactRelationship, "father");
    set(f.contactPhone, "010-0000-0002");

    await submit();

    await waitFor(() => expect(registerPatient).toHaveBeenCalled());
    expect(registerPatient).toHaveBeenCalledWith(
      {
        full_name: "Synthetic New",
        date_of_birth: "1990-04-12",
        sex: "female",
        phone: "01000000001",
        national_id: "29004120100001",
        address: "12 Synthetic St",
        emergency_contact: {
          name: "Synthetic Guardian",
          relationship: "father",
          phone: "01000000002",
        },
      },
      "en",
    );
  });
});

describe("with possible duplicates", () => {
  beforeEach(() => {
    findByPhone.mockResolvedValue(page([summary(7), summary(8)]));
  });

  async function warned() {
    stage();
    fillRequired();
    await submit();
    await screen.findByText(t.registerForm.matchesTitle);
  }

  it("shows the matches instead of saving", async () => {
    await warned();

    expect(registerPatient).not.toHaveBeenCalled();
    const link = screen.getAllByRole("link", { name: "Synthetic Match 7" })[0];
    expect(link?.getAttribute("href")).toBe("/patients/7");
    expect(link?.getAttribute("data-prefetch")).toBe("false");
    expect(screen.getByRole("table").textContent).toContain("1990-04-12");
  });

  it("says how many there are when the panel shows only some", async () => {
    findByPhone.mockResolvedValue(page([summary(7)], 12));
    stage();
    fillRequired();
    await submit();

    const shown = t.registerForm.moreMatches.replace("{shown}", "1");
    expect(await screen.findByText(shown)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("12 patients");
  });

  it("registers anyway with no second check", async () => {
    await warned();

    await press(t.registerForm.registerAnyway);

    await waitFor(() => expect(registerPatient).toHaveBeenCalledTimes(1));
    expect(findByPhone).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledExactlyOnceWith("/patients/42"),
    );
  });

  it("removes the panel when the phone changes, and the next submit checks", async () => {
    await warned();

    set(f.phone, "01000000055");
    await waitFor(() =>
      expect(screen.queryByText(t.registerForm.matchesTitle)).toBeNull(),
    );
    expect(
      screen.queryByRole("button", { name: t.registerForm.registerAnyway }),
    ).toBeNull();

    findByPhone.mockResolvedValue(page([]));
    await submit();

    await waitFor(() => expect(registerPatient).toHaveBeenCalledTimes(1));
    expect(findByPhone).toHaveBeenLastCalledWith("01000000055", "en");
  });

  it("keeps the panel if the same phone is written differently", async () => {
    await warned();

    set(f.phone, "0100-000-0001");

    await waitFor(() =>
      expect(screen.getByText(t.registerForm.matchesTitle)).toBeTruthy(),
    );
  });

  it("still checks the other fields before registering anyway", async () => {
    await warned();

    set(f.fullName, "   ");
    await press(t.registerForm.registerAnyway);

    await screen.findByText(t.form.nameRequired);
    expect(registerPatient).not.toHaveBeenCalled();
  });
});

describe("when the check can't run", () => {
  beforeEach(() => {
    findByPhone.mockResolvedValueOnce(refused(500));
  });

  async function failed() {
    stage();
    fillRequired();
    await submit();
    await screen.findByText(t.registerForm.checkFailedTitle);
  }

  it("says so, and doesn't save on its own", async () => {
    await failed();

    expect(registerPatient).not.toHaveBeenCalled();
    expect(findByPhone).toHaveBeenCalledTimes(1);
  });

  it("offers trying again, which goes on to save if nothing matches", async () => {
    await failed();

    await press(t.registerForm.tryAgain);

    await waitFor(() => expect(registerPatient).toHaveBeenCalledTimes(1));
    expect(findByPhone).toHaveBeenCalledTimes(2);
  });

  it("offers registering anyway", async () => {
    await failed();

    await press(t.registerForm.registerAnyway);

    await waitFor(() => expect(registerPatient).toHaveBeenCalledTimes(1));
    expect(findByPhone).toHaveBeenCalledTimes(1);
  });
});

describe("a 403 on the check", () => {
  it("takes the usual route, rather than the failed-check panel", async () => {
    findByPhone.mockResolvedValue(refused(403, {}, "Not for you."));
    stage();
    fillRequired();

    await submit();

    await screen.findByText("Not for you.");
    expect(screen.queryByText(t.registerForm.checkFailedTitle)).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(registerPatient).not.toHaveBeenCalled();
  });
});

describe("when the API refuses", () => {
  it("shows each key on its field, others at form level, keeping what was typed", async () => {
    registerPatient.mockResolvedValue(
      refused(
        422,
        {
          full_name: ["Name refused."],
          date_of_birth: ["Date refused."],
          sex: ["Sex refused."],
          phone: ["Phone refused."],
          national_id: ["National ID refused."],
          address: ["Address refused."],
          "emergency_contact.name": ["Contact name refused."],
          "emergency_contact.relationship": ["Relationship refused."],
          "emergency_contact.phone": ["Contact phone refused."],
          emergency_contact: ["Contact refused."],
        },
        "Invalid.",
      ),
    );
    stage();
    fillRequired();

    await submit();

    for (const [label, message] of [
      [f.fullName, "Name refused."],
      [f.dateOfBirth, "Date refused."],
      [f.sex, "Sex refused."],
      [f.phone, "Phone refused."],
      [f.nationalId, "National ID refused."],
      [f.address, "Address refused."],
      [f.contactName, "Contact name refused."],
      [f.contactRelationship, "Relationship refused."],
      [f.contactPhone, "Contact phone refused."],
    ] as const) {
      await screen.findByText(message);
      expect(input(label).getAttribute("aria-invalid")).toBe("true");
    }
    expect(screen.getByText("Contact refused.")).toBeTruthy();
    expect(input(f.fullName).value).toBe("  Synthetic New  ");
    expect(input(f.phone).value).toBe("010 0000-0001");
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("double submission", () => {
  it("is blocked during the check", async () => {
    findByPhone.mockReturnValue(new Promise(() => undefined));
    stage();
    fillRequired();

    await submit();
    await screen.findByRole("button", { name: t.registerForm.checking });
    await act(async () => {
      fireEvent.submit(input(f.fullName).closest("form") as HTMLFormElement);
      await Promise.resolve();
    });

    expect(findByPhone).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: t.registerForm.checking,
      }).disabled,
    ).toBe(true);
  });

  it("is blocked during the save", async () => {
    registerPatient.mockReturnValue(new Promise(() => undefined));
    stage();
    fillRequired();

    await submit();
    await screen.findByRole("button", { name: t.registerForm.submitting });
    await act(async () => {
      fireEvent.submit(input(f.fullName).closest("form") as HTMLFormElement);
      await Promise.resolve();
    });

    expect(findByPhone).toHaveBeenCalledTimes(1);
    expect(registerPatient).toHaveBeenCalledTimes(1);
  });
});
