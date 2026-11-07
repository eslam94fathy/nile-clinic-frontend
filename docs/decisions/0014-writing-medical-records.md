# ADR 0014: Writing medical records

**Status:** Accepted, by the project owner with Phase 8's plan, 2026-11-07

Builds on [ADR 0005](0005-audit-safe-data-fetching.md), [ADR 0010](0010-session-and-guards.md), [ADR 0012](0012-audited-reads-in-the-browser.md), and
[ADR 0013](0013-live-reads.md). See [research](../../specs/008-medical-encounters/research.md), R1 to R9.

## Context

Medical records are the most sensitive thing the clinic holds, and the first screen where a person writes at length. Three facts shape this:

- Each change to a draft writes a permanent audit entry, so saving automatically would fill the trail with entries nobody chose.
- The constitution bars clinical text from persistent browser storage, so what's typed exists only on screen until saved.
- Until now a `401` always left the page at once, which suits a form of a few fields, and doesn't suit twenty minutes of notes.

## Decision

**Saving is always a person's action.** There's no timer, no save on leaving a field, and no draft kept in the browser. The page always shows whether anything is unsaved. The owner chose this, and accepted that a crash loses what was typed since the last save.

**Leaving is guarded, in one place.** While something would be lost, one capturing listener catches clicks on links, including the language switch, and asks first. Sign-out asks the same store, and `beforeunload` covers closing and reloading. "Leave" returns the form to what was last saved, so discarded text isn't held on a hidden page. Back and forward are cancelled through the Navigation API's `navigate` event. Phase 8 measured that a capturing `popstate` listener comes too late, and that this works in Chromium on a production build ([research R2](../../specs/008-medical-encounters/research.md)). A browser without the API, or one refusing to cancel, gives no warning there, and the left page stays held with its text.

**A `401` can be answered instead of acted on.** `browserApi` gains `answerSessionEnd`, used only by a record's save, finalize, and addendum, and the panel's reads beside a draft. The page says nothing was saved, keeps the text, and leaves when the person chooses. Every other call still leaves at once. This narrows ADR 0010 for these calls. Another tab signing out still leaves at once, losing what's unsaved, because signing out on a shared computer has to mean it. Another tab finding that the session ended by itself is treated like a `401`, if something would be lost. A `403` or `404` on one of these changes doesn't refresh the page, as the gate re-deciding would remove the form. Saving stays on offer, and "Sign in" first checks the session, as another tab may have signed in again, sharing the cookie, and ending it then would sign everyone out and lose the text for nothing. Signing out asks first but discards nothing, as it can fail and stay on the page.

**Starting a record isn't an irreversible action (Principle VI),** the owner decided on 2026-11-07. A record can't be deleted, but an empty draft harms nothing and can be completed later, as ADR 0012 reasoned for registering a patient. So it needs no confirmation.

**Clinical content is only in component state.** It's never read on the server, never put in the query cache, and sent `no-store`. A record and a history use ADR 0012's guarded read, which moves to shared code. Inside the panel beside a draft, reads happen directly in click handlers: with no address and no effect, nothing can repeat them.

**The form never decides.** Whether a record is complete, or allowed, is the API's alone. Fields have no `maxLength`, because cutting pasted clinical text silently is worse than a refusal that keeps it.

**Browser features are asked to stay out,** with `autoComplete="off"`, `spellCheck={false}`, `writingsuggestions="false"`, the common extension opt-outs, and `translate="no"`. Doctors lose spell checking, which is the cost of keeping text off remote services.

**Live reads gain one.** `GET /doctors/me/visits` joins ADR 0013's list, as it's unaudited, and gives "My queue" the record's status.

## Alternatives

| Option | Why not |
|---|---|
| Automatic saving on a timer | Fills a permanent trail with entries nobody chose. The owner declined it |
| Saving on leaving a field | The most entries of all. The owner declined it |
| Encrypted draft in browser storage | The key must live where the text does, so it hides nothing from whoever has the computer, and the constitution bars it |
| `onNavigate` on every link | Every link in the application would need to know about this form. Next.js's docs suggest it, for a smaller application |
| A dialog for the panel | A doctor must read and type at once, so nothing can trap focus |
| A sheet component for the panel | A plain region does this, with no dependency |
| A hard `401` on every call | Loses twenty minutes of notes to an expired session, for a privacy gain the owner can still choose in the review |

## Consequences

- A crash or power cut loses typing, as the owner accepted.
- Text can stay on an unattended screen after a session ends. The privacy review puts this to the owner, and removing the option is one line.
- A hidden page can hold clinical text in its DOM within one session, as ADR 0012 accepts for patients. A full page load clears it at sign-out.
- A browser extension can ignore what it's asked. That's beyond the application, and the review records it.
- A later Next.js version could change how `popstate` or held pages behave. The guard's test would then fail.
