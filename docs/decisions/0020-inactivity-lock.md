# ADR 0020: Medical-record pages lock when idle, and unlock with a fresh sign-in

**Status:** Accepted, by the project owner after Phase 13's review, 2026-11-12

Answers the condition in Phase 8's [privacy review](../../specs/008-medical-encounters/privacy-review.md) (risk 1). Changes what
[ADR 0010](0010-session-and-guards.md) seals in the cookie. See [research](../../specs/013-hardening/research.md), R3 and R4.

## Context

A medical record stays on an unattended screen indefinitely: decision Q2 rejected an inactivity sign-out for the front desk, and a record
page makes no requests, so nothing notices. The owner decided (2026-11-11) that medical-record pages lock after 5 minutes without activity,
with no warning; that the lock mustn't lose unsaved text or save anything; and that only the same person's password opens it, through a
fresh sign-in. The API has no way to check a password apart from signing in (`POST /auth/sign-in`), and the cookie held only the token.

## Decision

- `InactivityLock` in `features/auth` wraps the record page (with its addenda and history panel) and the patient history page. No other page.
- Locked, it opens a native `<dialog>` with `showModal()` over an opaque backdrop, which makes the rest of the document inert and sits above
  every portal. The dialog is a new node appended to the body as the page locks, as an open Radix dialog hides what was there from
  assistive technology. Every other child of the body, the wrapped content included, is `visibility: hidden` while locked. The content
  stays mounted: text, dialogs, and requests in flight are untouched. Escape is stopped before Radix's own listener sees it.
- Activity is keyboard, pointer, wheel, touch, and scroll anywhere in the tab, timed with `Date.now()` and checked again whenever the page
  is shown, so a hidden or sleeping tab locks before it paints. Work on other pages of the same tab counts, so a record brought back by Back
  locks only if the whole tab sat idle (owner, 2026-11-11, after the code review).
- Locking sets a cookie, `nile_locked`, from the page itself, so it sends nothing. It holds no identity and ends with the browser. While
  it's set, each medical-record page loads with only the lock and doesn't mount its content, so nothing is read, written to the audit
  trail, or sent until the person unlocks: reloading, typing the address again, or a new tab can't get past it (security finding S1, owner
  2026-11-11). Every sign-in, unlock, and sign-out clears it. A side effect: once one tab locks, every record page in that browser opens
  locked until someone unlocks.
- At sign-in, the seal holds `{ token, userId, email }`. `POST /api/auth/unlock` takes the password and the id of the person the page was
  opened for. It refuses if the seal names anyone else (someone has signed in since, in another tab), signs in with the **sealed** email,
  checks the returned id against the sealed one, ends the old token if it still exists, and seals the new one. A seal without the new fields
  can't unlock; the lock then offers only signing out.
- Signing out from the lock warns that unsaved text will be lost, and asks for confirmation.

## Alternatives

| Option | Why not |
|---|---|
| A privacy curtain anyone can dismiss | Owner chose a password; a curtain stops only a glance |
| Sign out at the limit | Loses unsaved text, which the privacy review forbids |
| Email typed or sent by the browser | Lets someone at the screen attempt another account's sign-in from a locked record |
| Read the email with the old token | Fails after the backend's idle timeout, exactly when needed |
| An overlay `div` | Doesn't cover top-layer or portalled content without `inert` on each by hand |

## Consequences

- Each unlock writes `auth.sign_in`, and usually `auth.sign_out` for the old token, in the audit trail. The owner accepted this.
- Unlocking counts against the backend's sign-in limits; until the backend trusts the frontend's address (H2), that's the clinic's shared
  limit of 20 attempts per minute.
- People signed in before this phase is deployed can't unlock until they sign in again.
- A success toast for a save finished while locked may expire unseen; the page's own "saved at" status remains.
- Accepted risks, recorded in [Phase 13's review](../../specs/013-hardening/review.md):
  - The lock hides content without removing it, so nothing typed is lost. Someone with the browser's developer tools on the computer could
    read what's under it, or delete the marker cookie.
  - If an administrator changes a person's email while their page is locked, the sealed email no longer signs in: the backend's refusal
    reads like a wrong password, and only signing out remains.
  - Two tabs unlocking in the same instant both end the old token; one of the two new tokens is then overwritten and never ended, and stays
    valid until the backend's idle limit.
