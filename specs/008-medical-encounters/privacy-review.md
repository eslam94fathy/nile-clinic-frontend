# Privacy Review: Medical Encounters

**Done by**: Claude Code (Opus 5.5), who also built this phase, on 2026-11-07. So this isn't independent. It's put to the project owner, who decides each open risk below.

**Scope**: Phase 8's frontend, at the working tree on branch `008-medical-encounters`, against the backend at commit `dff2dca`.

**Not a legal review.** Egyptian health-data obligations still need one before production (see the end).

## Evidence

| Source | Result |
|---|---|
| `e2e/live/encounters.spec.ts`, running API, production build | 20 of 20 |
| `e2e/encounters.spec.ts`, fake backend, production build | 58 of 58 |
| `e2e/accessibility.spec.ts`, clinical screens | 12 of 12, before the code review's fixes |
| `e2e/live/patients.spec.ts`, after the shared read moved | 24 of 24, before the code review's fixes |
| `/code-review` at high effort | 10 findings, all fixed: see [tasks.md](tasks.md) |
| `pnpm check` and `pnpm test:e2e:live` in full | Reported passing by the owner **before** the code review's fixes. **Not yet re-run since** |
| `/security-review` | **Couldn't run.** It needs `origin/HEAD`, which isn't set here, and it reads only committed changes, and this phase is uncommitted. The checks it would have prompted were done by hand, below. It should be run once this is committed |

## Where clinical text can reach

A distinct marker was planted in all ten clinical fields, including a prescription line and an addendum, through the real journey on the running API.

| Place | Checked how | Found |
|---|---|---|
| Addresses | Every address visited, searched | None. Only record and patient numbers |
| Page titles | Each step, searched | No marker, and no patient name |
| `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, readable cookies | Searched at the end of the journey | None |
| The server's output | The application server's log, searched | None, and no patient name |
| Audit trail | Entries for that patient, searched | None. Only which fields changed |
| HTML the server sends | Fetched for a record and a history, searched | None, and no patient name |
| Page after signing out and going back | Page text, searched | None, and no patient name |
| Response caching | `Cache-Control` on every clinical answer | `no-store` on each |
| Logs and reporting in code | Searched `src` | No logging in the feature. The only `console` calls in `src` are startup configuration errors. No analytics or error-reporting package is installed |
| Server rendering | Searched the code | No clinical read on the server. No `use cache` on clinical pages |
| Same-origin route | Read | Passes bodies through unread, logs nothing, sends `no-store`, and refuses cross-origin changes and non-JSON reads |
| Code running from stored text | Planted markup, in a test | Shown as text. No dangerous output sink in the feature |
| Messages and announcements | Tests and reading | Confirmations hold no clinical text. The API's refusals don't repeat submitted text, by its own contract |
| Browser features | Attributes tested | Fields ask for no autofill, form restore, spell-check service, writing suggestions, or translation, and common extensions are asked to stay out |

**What this search can't see**: the browser's own disk cache and form-restore files, and a browser's or operating system's memory or page file. These rest on `no-store`, on `autoComplete="off"`, and on the browser honouring them. Browser extensions weren't tested. Only Chromium was tested.

## Who can reach each screen

Every cell in quickstart's permission table was checked.

- Administrators and receptionists get the not-allowed state on all three clinical addresses, with **0 reads**, and `403` from the API on all seven operations.
- A doctor with no profile is told so, with 0 reads.
- Another doctor's draft gives a `404` whose body is **identical** to an unknown id's.
- Another doctor's finalized record reads only while the patient is on this doctor's list today, and stops once they've left.
- No other role's screen shows a record's status, count, or link.
- A doctor's screens show only the patient's number, name, sex, and date of birth, and never read the patient's own record.

## The audit trail stays true

Counted on the running API, each row exact.

| Action | Entries |
|---|---|
| Showing lists, hovering, focus, reconnecting, away and back, four real polling intervals | 0 |
| Starting, saving, finalizing, adding an addendum | Each one of its own, and no opening |
| An identical save | 0 |
| Following a link, a new tab, reloading, reading again, switching language | 1 opening each, which is true |
| Each history page | 1 each |
| The panel | 1 per click |
| Access having ended | 1 refusal, which is true |
| Rows where no history is offered | 0 refusals |

## Sign-out, session end, and shared computers

- Signing out does a full page load, which clears memory and every held page. Nothing appeared on going back, in the planted-text journey.
- Signing in never returns anyone to a clinical address, and writes no opening.
- Signing out in another tab leaves this tab at once, losing what's unsaved.

## Open risks, for the owner

Each needs accepting or rejecting. **Decisions are recorded below once made.**

| # | Risk | Now | Recommendation |
|---|---|---|---|
| 1 | **An unattended screen.** A record stays on screen indefinitely, with no inactivity sign-out (decision Q2 was made for the front desk). A record page makes no requests, so it doesn't even notice a session ending | Accepted by no one yet for clinical content | Accept for now, and add an inactivity lock for clinical pages to Phase 13 as a pre-production requirement. It's the strongest protection available, but needs its own design, as it mustn't lose unsaved text |
| 2 | **Text kept after a session ends by itself.** It stays on screen until the person chooses, including if an administrator deactivated the doctor | Built, per ADR 0014 | Accept. Losing a clinician's notes is the more likely harm, and the text was already on screen. Removing it is small |
| 3 | **A crash loses typing.** Nothing is stored, by the constitution | Owner accepted, 2026-11-07 | Already accepted, recorded here |
| 4 | **A hidden page holds clinical text.** Up to 3 visited pages stay in memory and the page's hidden content within one session. Cleared at sign-out | As ADR 0012 accepts for patients | Accept |
| 5 | **A browser or extension beyond reach.** An extension can ignore what it's asked, and doctors lose spell check to keep text off remote services | Fields ask them not to | Accept. Controlling extensions is a matter for how clinic computers are managed, so add it to deployment notes |
| 6 | **Printing.** The browser can print any page. Not offered, and can't be prevented | Decision Q5 | Accept |
| 7 | **Another tab overwriting a draft.** No version check exists in the API (gap G9). The page says so after finalizing, not before | Recorded as a gap | Accept for now, and raise with the backend. A version check there is the only real fix |
| 8 | **The back button elsewhere.** Tested only by Playwright in Chromium. A browser without the Navigation API, or one refusing to cancel, gives no warning, and the left page stays held with its text | Measured in research R2 | Accept, and check the real button by hand |

## Not done

Quickstart's "By hand" checks have no results: keyboard, screen reader, shared computer, mixed text, timing, a crash, and the real back button. Nothing here replaces them, and the screen reader and real back button can't be automated here.

## For the legal review before production

Already required by the roadmap. This phase adds these questions:

- How long must medical records be kept, as they can't be deleted?
- Is what a doctor can read from another doctor, under today's-list access, acceptable under Egyptian health-data rules?
- Are audit entries of who read a record, and their network addresses, personal data, and how long may they be kept? Hazard H2 also means addresses are wrong until the backend trusts the proxy.
- Who may see clinical content for medical-legal requests? Nobody can, through this application.
- Is protection at rest in the backend's database sufficient? The backend's spec left this open, and this frontend stores nothing.

## Owner's decisions

Made on 2026-11-07, each as recommended.

| # | Risk | Decision |
|---|---|---|
| 1 | An unattended screen | **Accepted for now.** An inactivity lock for clinical pages is required by Phase 13, before production, designed so that it can't lose unsaved text. Recorded in the roadmap |
| 2 | Text kept after a session ends by itself | **Accepted.** Stays as built |
| 3 | A crash loses typing | **Accepted** earlier, with the save strategy |
| 4 | A hidden page holds clinical text | **Accepted** |
| 5 | A browser or extension beyond reach | **Accepted.** Managing extensions on clinic computers is a deployment note in the roadmap |
| 6 | Printing | **Accepted** |
| 7 | Another tab overwriting a draft | **Accepted for now.** A version check should be raised with the backend. Recorded in the roadmap |
| 8 | The back button elsewhere | **Accepted.** The real button stays on the by-hand list |

The owner's decisions rest on this review as written. The by-hand checks and the full `pnpm check` after the code review's fixes were still outstanding when they were made.
