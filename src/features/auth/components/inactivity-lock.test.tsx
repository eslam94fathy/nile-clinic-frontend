import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
} from "@testing-library/react";
import { Activity, useState } from "react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import en from "@/messages/en.json";
import { renderWithIntl } from "@/test-support/render-with-intl";
import { InactivityLock, LOCK_AFTER_MS } from "./inactivity-lock";

const unlock = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const leaveAfterSignOut = vi.hoisted(() => vi.fn());
vi.mock("../api/unlock", () => ({ unlock }));
vi.mock("../api/sign-out", () => ({ signOut }));
vi.mock("@/lib/auth/session-end", () => ({ leaveAfterSignOut }));

const t = en.auth.lock;
const NAME = "Synthetic Doctor";
const PERSON_ID = 7;
const NOTE = "Synthetic unsaved sentence";
const SECOND = 1000;
const MINUTE = 60 * SECOND;

// jsdom has no modal dialogs; the browser's own behavior is tested end to end.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  unlock.mockReset();
  signOut.mockReset().mockResolvedValue(true);
  leaveAfterSignOut.mockReset();
  document.cookie = "nile_locked=; Max-Age=0; Path=/";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A page with unsaved text, a dialog of its own, and a save that may still be on its way. */
function Page() {
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState<Promise<string> | null>(null);
  return (
    <main>
      <h1>Synthetic record</h1>
      <label>
        Diagnosis
        <textarea defaultValue="" />
      </label>
      <button
        type="button"
        onClick={() => {
          const pending = pendingSave();
          setSaving(pending);
          void pending.then(setSavedAt);
        }}
      >
        Save
      </button>
      {saving && !savedAt ? <p>Saving</p> : null}
      {savedAt ? <p>Saved at {savedAt}</p> : null}
    </main>
  );
}

let finishSave: (time: string) => void = () => {};
const saveCalls = vi.fn();
function pendingSave() {
  saveCalls();
  return new Promise<string>((resolve) => {
    finishSave = resolve;
  });
}

function show({ startLocked = false } = {}) {
  return renderWithIntl(
    <InactivityLock
      personId={PERSON_ID}
      personName={NAME}
      startLocked={startLocked}
    >
      <Page />
    </InactivityLock>,
  );
}

/** A record kept hidden while the person is on another page of the same tab, as Back restores it. */
function KeptPage() {
  const [shown, setShown] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setShown((value) => !value)}>
        Switch page
      </button>
      <Activity mode={shown ? "visible" : "hidden"}>
        <InactivityLock personId={PERSON_ID} personName={NAME}>
          <Page />
        </InactivityLock>
      </Activity>
    </>
  );
}

const marked = () => document.cookie.includes("nile_locked=1");

const lockDialog = () => screen.queryByRole("dialog");
// The label also says the field is required.
const passwordField = () =>
  screen.queryByLabelText(t.password, { exact: false });
const content = () => screen.getByRole("heading", { name: "Synthetic record" });

async function pass(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function lockByWaiting() {
  await pass(LOCK_AFTER_MS);
  expect(lockDialog()).not.toBeNull();
}

async function submitPassword(password: string) {
  const field = passwordField();
  if (!field) throw new Error("No password field");
  fireEvent.change(field, { target: { value: password } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: t.unlock }));
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("InactivityLock", () => {
  it("locks after exactly five minutes without activity, and not before", async () => {
    expect(LOCK_AFTER_MS).toBe(5 * MINUTE);
    show();

    await pass(LOCK_AFTER_MS - SECOND);
    expect(lockDialog()).toBeNull();

    await pass(SECOND);
    const dialog = lockDialog();
    expect(dialog).not.toBeNull();
    expect(
      within(dialog as HTMLElement).getByRole("heading", { name: t.heading }),
    ).toBeDefined();
    expect(dialog?.textContent).toContain(NAME);
    expect(dialog?.getAttribute("aria-labelledby")).toBeTruthy();
  });

  for (const [name, fire] of [
    ["keydown", () => fireEvent.keyDown(document, { key: "a" })],
    ["pointerdown", () => fireEvent.pointerDown(document)],
    ["pointermove", () => fireEvent.pointerMove(document)],
    ["wheel", () => fireEvent.wheel(document)],
    ["touchstart", () => fireEvent.touchStart(document)],
    ["scroll", () => fireEvent.scroll(content())],
  ] as const) {
    it(`counts ${name} as activity, anywhere on the page`, async () => {
      show();

      await pass(4 * MINUTE);
      fire();
      await pass(4 * MINUTE);
      expect(lockDialog()).toBeNull();

      await pass(MINUTE);
      expect(lockDialog()).not.toBeNull();
    });
  }

  it("locks at once on return when the limit passed while hidden, even if timers didn't run", async () => {
    show();

    vi.setSystemTime(Date.now() + 6 * MINUTE);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(lockDialog()).not.toBeNull();
  });

  it("marks this browser as locked, so a reload or a new tab shows only the lock", async () => {
    show();
    expect(marked()).toBe(false);

    await lockByWaiting();

    expect(marked()).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("starting locked, mounts nothing behind the lock until the person unlocks", async () => {
    unlock.mockResolvedValue({ ok: true, status: 200, data: {} });
    show({ startLocked: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(lockDialog()).not.toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Synthetic record" }),
    ).toBeNull();
    expect(document.body.hasAttribute("data-locked")).toBe(true);

    await submitPassword("synthetic-password-1");

    expect(lockDialog()).toBeNull();
    expect(content()).toBeDefined();
  });

  it("counts work on other pages of the same tab when a kept record is shown again", async () => {
    renderWithIntl(<KeptPage />);
    const switchPage = () => {
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Switch page" }));
      });
    };
    switchPage();

    // Six minutes on another page, in use every minute.
    for (let minute = 0; minute < 6; minute += 1) {
      await pass(MINUTE);
      fireEvent.keyDown(document.body, { key: "a" });
    }
    switchPage();

    expect(lockDialog()).toBeNull();
  });

  it("locks a kept record shown again after the whole tab sat idle", async () => {
    renderWithIntl(<KeptPage />);
    const switchPage = () => {
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Switch page" }));
      });
    };
    switchPage();
    await pass(6 * MINUTE);
    switchPage();

    expect(lockDialog()).not.toBeNull();
  });

  it("sends nothing when locking, and hides the page while keeping it", async () => {
    show();
    fireEvent.change(screen.getByLabelText("Diagnosis"), {
      target: { value: NOTE },
    });

    await lockByWaiting();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(unlock).not.toHaveBeenCalled();
    const wrapper = content().closest("[data-lock-content]");
    expect(wrapper?.className).toContain("invisible");
    expect(wrapper?.hasAttribute("inert")).toBe(true);
    // Everything else on the body is hidden too, such as a dialog portalled there, but not the lock.
    expect(document.body.hasAttribute("data-locked")).toBe(true);
    expect(lockDialog()?.parentElement).toBe(document.body);
    expect(lockDialog()?.hasAttribute("data-inactivity-lock")).toBe(true);
    expect(screen.getByLabelText<HTMLTextAreaElement>("Diagnosis").value).toBe(
      NOTE,
    );
  });

  it("keeps Escape from reaching the page while locked", async () => {
    show();
    const reached = vi.fn();
    document.addEventListener("keydown", reached, { capture: true });

    await lockByWaiting();
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(escape);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
    );

    expect(escape.defaultPrevented).toBe(true);
    expect(reached).not.toHaveBeenCalled();
    expect(lockDialog()).not.toBeNull();
    document.removeEventListener("keydown", reached, { capture: true });
  });

  it("reopens the lock if the browser closes it by itself", async () => {
    show();
    await lockByWaiting();

    act(() => {
      (lockDialog() as HTMLDialogElement).close();
    });

    expect(lockDialog()).not.toBeNull();
  });

  it("asks for the password before sending anything", async () => {
    show();
    await lockByWaiting();

    await submitPassword("");

    expect(unlock).not.toHaveBeenCalled();
    expect(screen.getByText(en.auth.errors.passwordRequired)).toBeDefined();
  });

  it("unlocks with the right password, keeping every unsaved word", async () => {
    unlock.mockResolvedValue({ ok: true, status: 200, data: {} });
    show();
    fireEvent.change(screen.getByLabelText("Diagnosis"), {
      target: { value: NOTE },
    });
    await lockByWaiting();

    await submitPassword("synthetic-password-1");

    expect(unlock).toHaveBeenCalledExactlyOnceWith(
      "synthetic-password-1",
      PERSON_ID,
      "en",
    );
    expect(lockDialog()).toBeNull();
    expect(screen.getByLabelText<HTMLTextAreaElement>("Diagnosis").value).toBe(
      NOTE,
    );
    expect(document.body.hasAttribute("data-locked")).toBe(false);
    expect(content().closest("[data-lock-content]")?.className).not.toContain(
      "invisible",
    );
    expect(fetchSpy).not.toHaveBeenCalled();

    // A fresh five minutes, and the field empty when it locks again.
    await pass(LOCK_AFTER_MS - SECOND);
    expect(lockDialog()).toBeNull();
    await pass(SECOND);
    expect((passwordField() as HTMLInputElement).value).toBe("");
  });

  it("can't be pressed twice while unlocking", async () => {
    unlock.mockReturnValue(new Promise(() => {}));
    show();
    await lockByWaiting();

    await submitPassword("synthetic-password-1");
    const button = screen.getByRole("button", { name: t.working });
    fireEvent.click(button);

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(unlock).toHaveBeenCalledOnce();
  });

  const refusals = [
    {
      status: 422,
      error: {
        status: 422,
        message: "These credentials do not match our records.",
        fieldErrors: {
          email: ["These credentials do not match our records."],
        },
      },
      shown: "These credentials do not match our records.",
      keepsPassword: false,
    },
    {
      status: 403,
      error: {
        status: 403,
        message: t.otherAccount,
        fieldErrors: {},
      },
      shown: t.otherAccount,
      keepsPassword: false,
    },
    {
      status: 502,
      error: { status: 502, message: "Something went wrong.", fieldErrors: {} },
      shown: "Something went wrong.",
      keepsPassword: true,
    },
    {
      status: 0,
      error: { status: 0, fieldErrors: {} },
      shown: en.auth.errors.general,
      keepsPassword: true,
    },
  ];

  for (const { status, error, shown, keepsPassword } of refusals) {
    it(`stays locked after a ${String(status || "missing")} answer, saying why`, async () => {
      unlock.mockResolvedValue({ ok: false, error });
      show();
      await lockByWaiting();

      await submitPassword("synthetic-wrong");

      expect(lockDialog()).not.toBeNull();
      expect(screen.getByText(shown)).toBeDefined();
      expect((passwordField() as HTMLInputElement).value).toBe(
        keepsPassword ? "synthetic-wrong" : "",
      );
    });
  }

  it("offers only signing out when this session can't unlock", async () => {
    unlock.mockResolvedValue({
      ok: false,
      error: { status: 409, message: t.cannotUnlock, fieldErrors: {} },
    });
    show();
    await lockByWaiting();

    await submitPassword("synthetic-password-1");

    expect(screen.getByText(t.cannotUnlock)).toBeDefined();
    expect(passwordField()).toBeNull();
    expect(screen.queryByRole("button", { name: t.unlock })).toBeNull();
    expect(screen.getByRole("button", { name: t.signOut })).toBeDefined();
  });

  it("warns before signing out, and going back returns to the lock", async () => {
    show();
    await lockByWaiting();

    fireEvent.click(screen.getByRole("button", { name: t.signOut }));
    expect(screen.getByText(t.signOutWarning)).toBeDefined();
    expect(signOut).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: t.keepLocked }));
    expect(passwordField()).not.toBeNull();
    expect(lockDialog()).not.toBeNull();
  });

  it("signs out after the warning is confirmed", async () => {
    show();
    await lockByWaiting();

    fireEvent.click(screen.getByRole("button", { name: t.signOut }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.signOutConfirm }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(signOut).toHaveBeenCalledOnce();
    expect(leaveAfterSignOut).toHaveBeenCalledOnce();
  });

  it("stays locked, text kept, when signing out fails", async () => {
    signOut.mockResolvedValue(false);
    show();
    fireEvent.change(screen.getByLabelText("Diagnosis"), {
      target: { value: NOTE },
    });
    await lockByWaiting();

    fireEvent.click(screen.getByRole("button", { name: t.signOut }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.signOutConfirm }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(leaveAfterSignOut).not.toHaveBeenCalled();
    expect(screen.getByText(en.auth.signOut.failure)).toBeDefined();
    expect(lockDialog()).not.toBeNull();
    expect(screen.getByLabelText<HTMLTextAreaElement>("Diagnosis").value).toBe(
      NOTE,
    );
  });

  it("lets a save already sent finish while locked, and shows it after unlocking", async () => {
    unlock.mockResolvedValue({ ok: true, status: 200, data: {} });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await lockByWaiting();

    await act(async () => {
      finishSave("10:30");
      await vi.advanceTimersByTimeAsync(0);
    });
    await submitPassword("synthetic-password-1");

    expect(saveCalls).toHaveBeenCalledOnce();
    expect(screen.getByText("Saved at 10:30")).toBeDefined();
  });

  it("gives focus back to where it was before locking", async () => {
    unlock.mockResolvedValue({ ok: true, status: 200, data: {} });
    show();
    const field = screen.getByLabelText("Diagnosis");
    field.focus();
    await lockByWaiting();

    await submitPassword("synthetic-password-1");

    expect(document.activeElement).toBe(field);
  });
});
