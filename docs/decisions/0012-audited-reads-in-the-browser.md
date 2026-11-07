# ADR 0012: Audited reads in the browser

**Status:** Accepted, by the project owner with Phase 5, 2026-11-06

Decided during Phase 5 planning, and measured with a production spike against the real backend. See
[research](../../specs/005-patients/research.md), R1 to R4. This changes part of [ADR 0005](0005-audit-safe-data-fetching.md),
and is a narrow exception to [ADR 0011](0011-server-reads-and-refresh.md).

## Context

Each successful `GET /patients/{id}` writes a permanent `patient.opened` entry. A false entry is false evidence.

ADR 0011 says that pages read on the server, and that forms call `router.refresh()`. Phase 5 tested whether a record could be read
this way without writing false entries, by counting real entries on a production build:

| Step, on one patient | Read on the server | Read in the browser |
|---|---|---|
| Hovering a link, tab focus, reconnecting | No entry | No entry |
| Away and back, with no refresh anywhere | No entry | No entry |
| `router.refresh()` on another page, record hidden | No entry | No entry |
| **Back, after that refresh** | **One false entry** | No entry |
| `router.refresh()` on the record's own page | **One false entry** | No entry |
| Full reload, or back after a full page load | One entry, which is true | One entry, which is true |

Phase 4's forms refresh after a save, so saving anything and then pressing back would have written a false "opened" entry.

Separately, patient search terms are patient details, and the constitution bans them from addresses. A Server Component can only
learn them from the address.

## Decision

**Records and patient search are read in Client Components, through the same-origin route.** No patient API call exists on the
server. Everything else stays under ADR 0011.

Three parts make the record's read correct, all in memory only:

1. **The reader holds the record in state.** Its effect reads on first mounting. A refresh or being shown again changes nothing.
2. **A click on `PatientLink` marks the record as asked for.** The effect also runs when a held page is shown, and reads if it finds
   the mark. So a click reads afresh, and the back button doesn't. Only a click can say so, which is why every link to a record uses
   `PatientLink`. Clicks that open another tab leave no mark, as that tab reads for itself.
3. **`POST` hands its returned record to the reader,** so registering writes `patient.registered` and no false opening.

`PATCH`'s returned record replaces the one in state, as ADR 0005 already requires.

Reading a list isn't audited, so search results may be repeated freely. An in-memory counter tells a held search that a patient
changed, and it repeats its last search when next shown.

**Measured**, with all three parts in place: first click 1, away and back 1, second click 2, refresh elsewhere 2, back after that 2,
Ctrl+click into a new tab 3, back in the first tab 3. Registering, then moving to the record: 0. Away and back: 0. Full reload: 1.

**Measured again on the built feature** (real entries, production build, `e2e/live/patients.spec.ts`), and all as the spike found:

| Journey | Entries, in order |
|---|---|
| From the record's address | Load 1, focus events 1, away and back 1, a real change on `/specialties` then back 1, "Reload details" 2, reload 3, language switch 4 |
| From real search results | Results shown and hovered 0, click 1, to the search by its link and back 1, a real change then back 1, the same result again 2, Ctrl+click reading in a new tab 3, back in the first tab 3 |
| Registering | `patient.registered` once and openings 0, then reload 1 |
| Correcting | Opening 1, a save with no change sends no `PATCH` and stays 1, a real change gives `patient.updated` once and stays 1 |

On `next dev`, under Strict Mode: first opening 1, away and back 1. So development mode doesn't double the entry, which answers ADR 0005's concern. A unit test also checks Strict Mode's repeat directly.

## This reverses part of ADR 0005

ADR 0005 rejected "fetch audited records outside TanStack Query", because it would be "a second data path", and "retry and focus bugs
simply move elsewhere". That judgment was made before anything was measured, and this reverses it:

- **The second path is what's needed.** An audited read must not retry, refetch, or cache, so a query library would have nothing to do.
- **The bugs it feared don't appear,** as the measurements show, and a permanent live test keeps it that way.
- **ADR 0005's rule on a bare `useEffect` stands.** This effect isn't bare: a ref and the mark decide whether it reads, and what the
  rule worried about, effects re-running when a page is shown again, is exactly what's tested.

ADR 0005's other rules still apply: no prefetching, no automatic retry, use what a mutation returned, and refreshing is a person's action.

Phases 8 and 11 have audited reads too, and should start from this ADR. TanStack Query still arrives with the queue's polling in Phase 7.

**Phase 8 made this read shared,** as its second consumer: `lib/use-audited-read.ts`, `lib/audited-opening.ts`, and `components/shared/audited-link.tsx`. Patients use them too, with their live counts unchanged. See [ADR 0014](0014-writing-medical-records.md).

## Two readings of the constitution

The project owner decided both on 2026-11-06.

- **The patient number may appear in an address (Principle II).** It's an opaque identifier that reveals nothing without access, and a
  record needs an address. Everything else about a patient stays out of addresses.
- **Registering isn't an irreversible action (Principle VI),** so it needs no confirmation, even though patients can't be deleted. Any
  wrong detail can be corrected by editing, as with staff accounts and specialties in Phase 4. The real risk is a duplicate, and a
  check on the phone number addresses it. A dialog on every registration would slow reception for no added safety.

## Alternatives

| Option | Why not |
|---|---|
| Server read, and no `router.refresh()` in patient screens | Other features' forms refresh too |
| Remove `router.refresh()` everywhere | Reverses ADR 0011's tested design for one feature |
| TanStack Query for this read | Nothing for it to do, and Principle IX |
| Keep search terms in the address, and read on the server | Forbidden by Principle II |
| Keep `/patients/new` in the address after registering | A reload would then offer an empty form for a patient who has just been saved |

## Consequences

- A reload clears a search. Going back restores it only while the page is held.
- A patient's record needs JavaScript. Search and the forms need it anyway.
- Going back to a page no longer held reads again, and so does switching language. Both are a person asking to see the record, so
  the entries are true.
- A held record can be out of date, which ADR 0005 accepts. "Last changed" is shown, and "Reload details" and another click read afresh.
- A later Next.js version could change when held pages keep state or re-run effects. `e2e/live/patients.spec.ts` would then fail.
