"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiError } from "@/lib/api/api-error";
import { markLocked } from "@/lib/auth/lock-marker";
import { leaveAfterSignOut } from "@/lib/auth/session-end";
import { signOut } from "../api/sign-out";
import { unlock } from "../api/unlock";

/** Fixed by the owner (ADR 0020), not a setting. */
export const LOCK_AFTER_MS = 5 * 60 * 1000;

const ACTIVITY = [
  "keydown",
  "pointerdown",
  "pointermove",
  "wheel",
  "touchstart",
  "scroll",
] as const;

// Activity anywhere in this tab counts, so that coming back to a record kept from earlier (by Back) after working on other
// pages doesn't lock it. Watched from the first lock on, for the life of the tab.
let lastActivity = 0;
let watching = false;
function watchTab() {
  if (watching) return;
  watching = true;
  const seen = () => {
    lastActivity = Date.now();
  };
  for (const type of ACTIVITY) {
    document.addEventListener(type, seen, { capture: true, passive: true });
  }
}

const noSubscription = () => () => {};

type Phase =
  "active" | "locked" | "unlocking" | "confirmingSignOut" | "signingOut";

type Refusal = { field?: string; form: string[] };

/** The backend's words as sent; a password message goes on the field, anything else above the form. */
function readRefusal(error: ApiError, general: string): Refusal {
  const { password, ...others } = error.fieldErrors;
  const form = Object.values(others).flat();
  if (form.length === 0 && !password && error.message) form.push(error.message);
  if (form.length === 0 && !password) form.push(general);
  return { ...(password ? { field: password.join(" ") } : {}), form };
}

/**
 * Covers a page holding clinical content after 5 minutes without activity (ADR 0020). The page stays mounted
 * underneath, so nothing typed is lost and nothing is saved. A modal dialog makes the rest of the document
 * inert; only the same person's password, through a fresh sign-in, opens it again.
 *
 * `startLocked` is for a page loaded while this browser's lock marker is set: the content isn't mounted, so nothing
 * is read, until the person unlocks.
 */
export function InactivityLock({
  personId,
  personName,
  startLocked = false,
  children,
}: {
  personId: number;
  personName: string;
  startLocked?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const headingId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const shownBefore = useRef(false);
  const returnFocusTo = useRef<Element | null>(null);
  const restoreFocus = useRef(false);
  // The lock is a portal on the body, which exists only in the browser.
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  const [phase, setPhase] = useState<Phase>(startLocked ? "locked" : "active");
  const [contentAllowed, setContentAllowed] = useState(!startLocked);
  const [canUnlock, setCanUnlock] = useState(true);
  const [password, setPassword] = useState("");
  const [refusal, setRefusal] = useState<Refusal>({ form: [] });

  const locked = phase !== "active";
  const lockedRef = useRef(locked);
  useLayoutEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  const lockNow = useCallback(() => {
    returnFocusTo.current = document.activeElement;
    // Before anything else, so that a reload from here on shows only the lock.
    markLocked();
    setPhase("locked");
  }, []);

  const isDue = () => Date.now() - lastActivity >= LOCK_AFTER_MS;

  // Opening the page counts as activity. Shown again after being kept hidden (Back), it locks before it paints if the
  // whole tab has been idle for the limit.
  useLayoutEffect(() => {
    watchTab();
    if (!shownBefore.current) {
      shownBefore.current = true;
      lastActivity = Date.now();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizing with the clock, before paint
    } else if (isDue()) lockNow();
  }, [lockNow]);

  useEffect(() => {
    if (locked) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    // Activity only moves the time; the timer, when it fires, looks again and waits for the remainder.
    const check = () => {
      clearTimeout(timer);
      if (isDue()) {
        lockNow();
        return;
      }
      timer = setTimeout(check, lastActivity + LOCK_AFTER_MS - Date.now());
    };
    // Timers are throttled in hidden tabs and stop while a computer sleeps, so the clock decides.
    const shown = () => {
      if (document.visibilityState === "visible") check();
    };

    document.addEventListener("visibilitychange", shown);
    check();

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", shown);
    };
  }, [locked, lockNow]);

  // The dialog exists only while locked, so opening it is all there is: unmounting closes it. A page that starts locked
  // has its dialog only once hydrated.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!locked || !dialog) return;
    if (!dialog.open) dialog.showModal();
    // Hides everything else on the body, including dialogs other code has portalled there (globals.css).
    document.body.setAttribute("data-locked", "");
    return () => document.body.removeAttribute("data-locked");
  }, [locked, inBrowser]);

  // Escape must neither close the lock nor reach a dialog under it, which listens on the document (research R4).
  useEffect(() => {
    if (!locked) return;
    const stopEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", stopEscape, { capture: true });
    return () =>
      window.removeEventListener("keydown", stopEscape, { capture: true });
  }, [locked]);

  function stayOpen() {
    // The browser may close a modal on a repeated Escape; the lock never opens that way.
    if (lockedRef.current) dialogRef.current?.showModal();
  }

  // Only once the dialog has gone and the content is no longer inert, which is after the render that unlocks.
  useEffect(() => {
    if (locked || !restoreFocus.current) return;
    restoreFocus.current = false;
    const target = returnFocusTo.current;
    if (target instanceof HTMLElement && target.isConnected) target.focus();
  }, [locked]);

  function unlocked() {
    setPassword("");
    setRefusal({ form: [] });
    lastActivity = Date.now();
    restoreFocus.current = true;
    setContentAllowed(true);
    setPhase("active");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (phase !== "locked") return;
    if (password === "") {
      setRefusal({ field: t("errors.passwordRequired"), form: [] });
      passwordRef.current?.focus();
      return;
    }

    setPhase("unlocking");
    setRefusal({ form: [] });
    const result = await unlock(password, personId, locale);
    if (result.ok) {
      unlocked();
      return;
    }

    const { status } = result.error;
    if (status === 409) setCanUnlock(false);
    // Kept only when no answer came, so the person can simply try again.
    if (status !== 0 && status < 500) setPassword("");
    setRefusal(readRefusal(result.error, t("errors.general")));
    setPhase("locked");
    passwordRef.current?.focus();
  }

  async function confirmSignOut() {
    if (phase !== "confirmingSignOut") return;
    setPhase("signingOut");
    if (await signOut()) {
      leaveAfterSignOut();
      return;
    }
    // The cookie couldn't be cleared, so the person stays here, still locked, with the page's text kept.
    setRefusal({ form: [t("signOut.failure")] });
    setPhase("locked");
  }

  const confirming = phase === "confirmingSignOut" || phase === "signingOut";

  return (
    <>
      <div
        data-lock-content
        className={locked ? "invisible" : undefined}
        inert={locked}
      >
        {contentAllowed ? children : null}
      </div>
      {/*
        A new node at the end of the body, created as the page locks: an open Radix dialog hides what was there before
        from assistive technology and turns off pointer events on the body, so the lock must be neither (research R4).
      */}
      {locked && inBrowser
        ? createPortal(
            <dialog
              data-inactivity-lock
              ref={dialogRef}
              aria-labelledby={headingId}
              onCancel={(event) => event.preventDefault()}
              onClose={stayOpen}
              className="pointer-events-auto m-0 h-dvh max-h-none w-dvw max-w-none bg-background p-4 text-foreground backdrop:bg-background"
            >
              <div className="mx-auto flex max-w-md flex-col gap-4 pt-[15dvh]">
                <h2 id={headingId} className="text-2xl font-semibold">
                  {t("lock.heading")}
                </h2>
                <p className="text-muted-foreground">
                  {t.rich("lock.description", {
                    name: () => <UserText>{personName}</UserText>,
                  })}
                </p>
                {confirming ? (
                  <div className="flex flex-col gap-4">
                    <p role="alert" className="font-medium text-destructive">
                      {t("lock.signOutWarning")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={phase === "signingOut"}
                        onClick={() => void confirmSignOut()}
                      >
                        {phase === "signingOut"
                          ? t("signOut.working")
                          : t("lock.signOutConfirm")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={phase === "signingOut"}
                        onClick={() => setPhase("locked")}
                      >
                        {t("lock.keepLocked")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form
                    method="post"
                    noValidate
                    onSubmit={(event) => void submit(event)}
                    className="flex flex-col gap-4"
                  >
                    <FormError messages={refusal.form} />
                    {canUnlock ? (
                      <>
                        <FormField
                          label={t("lock.password")}
                          error={refusal.field}
                          required
                        >
                          {(input) => (
                            <Input
                              {...input}
                              ref={passwordRef}
                              type="password"
                              dir="ltr"
                              autoComplete="current-password"
                              autoFocus
                              readOnly={phase === "unlocking"}
                              value={password}
                              onChange={(event) =>
                                setPassword(event.target.value)
                              }
                            />
                          )}
                        </FormField>
                        <Button type="submit" disabled={phase === "unlocking"}>
                          {phase === "unlocking"
                            ? t("lock.working")
                            : t("lock.unlock")}
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={phase === "unlocking"}
                      onClick={() => setPhase("confirmingSignOut")}
                    >
                      {t("lock.signOut")}
                    </Button>
                  </form>
                )}
              </div>
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
