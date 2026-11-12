# Contract: Inactivity lock

Reasons in [research R3 and R4](../research.md#r4-how-the-lock-covers-the-page-and-keeps-its-text). States in [data-model](../data-model.md#inactivity-lock).

## Where

`features/auth/components/inactivity-lock.tsx`, a Client Component exported from `features/auth/public.ts`. It wraps the content of exactly
two pages:

| Page | Wrapped component |
|---|---|
| `/[locale]/my/encounters/[id]` | `EncounterRecord` (the record, its addenda, the history panel inside it) |
| `/[locale]/my/patients/[id]/history` | `PatientHistory` |

Each page passes `personId` and `personName` from `getCurrentUser`, which `ScreenGate` has already read in the same render, so no extra
request is made, and `startLocked` when the request carries the lock marker `nile_locked` (`isLockMarked()` in `lib/auth/session.ts`).
The limit, `LOCK_AFTER_MS = 5 * 60 * 1000`, is a constant in the component, not a setting.

## Props

```ts
type InactivityLockProps = {
  personId: number; // sent with the password, so that only this person's session can open the page
  personName: string; // shown as written, never translated
  startLocked?: boolean; // the lock marker was set: show only the lock, and don't mount the content until unlocked
  children: ReactNode;
};
```

## What the person sees

| State | Shown |
|---|---|
| Active | The page, unchanged. Nothing about the lock is visible |
| Locked | A modal over an opaque backdrop covering the whole window: `auth.lock.heading`, `auth.lock.description` naming `personName`, a password field labelled `auth.lock.password`, the unlock button `auth.lock.unlock`, and a secondary `auth.lock.signOut` |
| Unlocking | The button shows progress and is disabled; the field is read-only |
| Refused | The backend's message under the field (or at form level for `403`), focus back on the field |
| Cannot unlock (`409`) | `auth.lock.cannotUnlock`, no field, only sign-out |
| Confirm sign-out | A second step inside the lock itself (not a separate dialog, which would render in the inert part of the page): `auth.lock.signOutWarning` ("Any text not saved on this page will be lost. This can't be undone.") as an alert, confirm `auth.lock.signOutConfirm`, and `auth.lock.keepLocked` to go back |
| Signing out | Progress on the confirm button; on success the existing `leaveAfterSignOut()`; on failure, the error inside the lock, still locked |

## Behavior rules

1. Locks when 5 minutes have passed since the last `keydown`, `pointerdown`, `pointermove`, `wheel`, `touchstart`, or captured `scroll` on
   the document, counted for the whole tab: work on other pages of the tab counts when a record kept by Back is shown again. No warning
   first (owner's choice). Opening the page counts as activity.
2. Checks the elapsed time whenever the page becomes visible, and before paint when a hidden page is shown again.
3. While locked: the rest of the document is inert (native modal dialog), the wrapped content is also `invisible` and `inert`, and
   `Escape` neither closes the lock nor reaches a dialog underneath (a `keydown` listener on `window`, in the capture phase). If the
   browser closes the modal anyway, as Chromium may on a repeated Escape, the lock reopens at once. Activity under the lock doesn't count.
4. Sends nothing when locking: it sets the session cookie `nile_locked=1` (path `/`, `SameSite=Lax`, `Secure` on HTTPS) from the page,
   which every later request carries. With it set, both pages load with `startLocked`, so a reload, the address typed again, or a new tab
   reads nothing until unlocked. Every sign-in, unlock, and sign-out clears it. Unlocking sends one `POST /api/auth/unlock`; signing out sends the existing `POST /api/auth/sign-out`.
5. Doesn't touch the form, the guard on leaving, or requests in flight. A save finished while locked is visible after unlocking (F16).
6. The password lives only in the field's own state, and is cleared after every attempt and on unlock. `autocomplete="current-password"`;
   no "show password" control.
7. Signing out from the lock asks only its own warning: the page's leave guard mustn't ask a second time behind the lock, and must still
   hold the text if signing out fails.
8. If another tab signs out (`signed-out` on the channel), this tab leaves as today. If the session ends by itself elsewhere, the record
   page's existing notice applies after unlocking; the lock itself stays until unlocked or signed out.
9. On unlock, focus returns to the element that had it before locking, once the dialog has gone and the content is no longer inert, or to
   the page's main heading if that element is gone.
10. Keyboard: focus starts in the password field; Tab cycles within the lock; Enter submits. Screen readers announce the lock as a dialog
    named by its heading; the content behind isn't announced.

## Messages (both locales, identical keys)

`auth.lock.heading`, `auth.lock.description`, `auth.lock.password`, `auth.lock.unlock`, `auth.lock.signOut`, `auth.lock.signOutWarning`,
`auth.lock.signOutConfirm`, `auth.lock.keepLocked`, `auth.lock.working`, `auth.lock.cannotUnlock`, `auth.lock.otherAccount`,
`auth.errors.passwordRequired`. Signing out reuses `auth.signOut.working` and `auth.signOut.failure`.

## Tests

- Unit: timing with fake timers (locks at 5 min, not before; activity resets; visibility return after 5 min locks at once); no request on
  locking; the password cleared after each attempt; each answer in the table of the [route contract](unlock-route.md).
- Component: unsaved text and an open confirmation survive lock and unlock; content isn't in the accessibility tree while locked.
- End to end (fake backend, production build), with Playwright's clock moved forward rather than waiting 5 minutes: lock on both pages in both locales, both themes, axe on the locked state, keyboard-only
  unlock, sign-out with its warning, a page that isn't a record never locks.
- Live: unlock writes exactly `auth.sign_in` and `auth.sign_out`, and no `encounter.opened` or `encounter.history_viewed`.
