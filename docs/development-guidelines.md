# Development Guidelines

Day-to-day rules that apply the [constitution](../.specify/memory/constitution.md). Where they differ,
the constitution wins. Commands are listed in the [README](../README.md#commands); run `pnpm check` before calling work complete.

**Next.js here is newer than most training data and tutorials.** Read `node_modules/next/dist/docs/` before relying on memory.

## Workflow

Every significant feature runs through Spec Kit:

| Step | Command | Output |
|---|---|---|
| Specify | `/speckit-specify` | `specs/NNN-feature/spec.md` |
| Clarify | `/speckit-clarify` | Questions answered in the spec |
| Plan | `/speckit-plan` | `plan.md`, research, contracts |
| Tasks | `/speckit-tasks` | `tasks.md` |
| Analyze | `/speckit-analyze` | Consistency report |
| Implement | `/speckit-implement` | Code and tests |
| Test | Run everything; record the real results | Evidence in `tasks.md` |
| Review | `/code-review` | Findings resolved |

Before planning any API work, read the endpoint's contract and the backend's code when in doubt. Don't
work from memory or from these docs alone.

## TypeScript

- `strict` on, plus `noUncheckedIndexedAccess`.
- No `any`, no `@ts-ignore`, and no `as` without a comment explaining why it's safe.
- API types come from the generated file. Give them readable names in the feature's `types.ts`; don't
  redefine their shape.
- Model the API as it is: nullable stays nullable, and enums stay string unions.

## Components

- Server Component by default. Add `'use client'` at the lowest level that needs it.
- A component gets its data from a prop or a feature hook; it never calls `fetch`.
- One component per file. Use named exports, except where Next requires a default.
- Don't edit `components/ui` for one screen; wrap it in `components/shared` or in the feature instead.
- Extract shared code on the second real use, not the first.

## Design tokens

- Use token classes (`bg-primary`, `text-muted-foreground`, `bg-status-success`). Raw colors and palette utilities such as
  `bg-neutral-500` fail `pnpm check:contrast`.
- Change token values in `app/globals.css` and [ADR 0008](decisions/0008-visual-direction.md) together, or
  [ADR 0009](decisions/0009-brand-assets.md) for brand tokens. Keep them solid hex, except
  `overlay`. A new text and background pair goes in the list in `scripts/check-contrast.mjs`.
- After `shadcn add`, run `pnpm format`, and read the notes in [the tech stack](tech-stack.md#installed-phase-2).
- Long values in tables wrap and aren't truncated. Phone numbers and IDs use `LtrText`, which never breaks across lines.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Files, folders | kebab-case | `check-in-dialog.tsx` |
| Components, types | PascalCase | `CheckInDialog` |
| Hooks | `use` + camelCase | `useCheckIn` |
| Query keys | Factory per feature | `queueKeys.list(filters)` |
| Translation keys | `feature.area.item` | `queue.actions.checkIn` |
| API fields | Unchanged `snake_case` | `queue_number` |

## Data fetching

- Choose a query kind from [ADR 0005](decisions/0005-audit-safe-data-fetching.md) for every query.
- **Before adding a query, check whether the endpoint writes an audit entry.** If it does, it's *audited*.
- Mutations invalidate only what they affect, and use the response when it already holds the new record.
- Don't retry mutations automatically.
- No optimistic updates for money, medical records, or bookings: show what the server confirmed.
- Read an audited record with `useAuditedRead`, in the browser, and count real entries in a live test on a production build ([ADR 0012](decisions/0012-audited-reads-in-the-browser.md)).
- Search the audit trail only inside a person's press, never from an effect, a query library, or the address ([ADR 0018](decisions/0018-audit-search-on-press.md)). Each request, every page included, writes an entry.
- Link to an audited page only with a link built on `AuditedLink`: `PatientLink`, `RecordLink`, or `HistoryLink`. It never prefetches, and its click is what tells the reader a person asked to read again.
- Show or choose a patient without opening them with `ChosenPatient` and `PatientChooser`. Never read the record just to show who someone is.
- Treat a change that fails with status `0` or `502` and above as possibly saved, and say so. A `500` means it did not happen.
- Write a list that must stay current with `useLiveList` from `lib/api` and the `live` policy, which only reads the backend doesn't audit may use ([ADR 0013](decisions/0013-live-reads.md), [ADR 0015](decisions/0015-live-reads-beyond-the-queue.md)). Pass your feature's own `rootKey`, so that your actions refresh only your lists. Use the `onDemand` policy for a browser-read list that mustn't read by itself. Don't replace the list with a loading state on a refresh, and don't announce refreshes to assistive technology.
- Send a money action once: one request at a time, never retried, and on an unknown outcome read the charge again and say to check it before trying again. Never resend one by itself (hazard H6).
- Put a confirmation above anything a refresh can remove, with its own copy of what it's about, and say where focus goes if the button has gone.

## Signed-in pages

Follow [the app shell contract](../specs/003-auth-app-shell/contracts/app-shell.md).

- Wrap **all** of a page's content in `ScreenGate`, inside `<Suspense>`. Anything outside it enters the public static shell.
- Set `built: true` on the page's row in `lib/auth/app-routes.ts`.
- Reach the API from the server only through `lib/api/server-api.ts`, as it's what keeps prefetching away from the API. From the client, only through `lib/api/browser-api.ts`.
- A new page that writes an audit entry when opened goes in `lib/auth/return-address.ts`.
- A page under a route that fewer roles may use passes `capability` to `ScreenGate`, so nothing of it is sent to the others.
- A failed read shows `ApiFailureState`. Inside one section of a page, it stays in that section.
- Features share reads within a render through `cache()`. Client Components with a lot of text get it from `ScopedMessages`, which sends only the namespaces named.

## Proxy and caching

- Never re-create the request in `src/proxy.ts`; see the [architecture](architecture.md#internationalization-and-direction).
- Never use `use cache` on per-user, patient, or clinical data ([ADR 0006](decisions/0006-cache-components.md)).
- Dynamic data stays inside `<Suspense>`, so it can't end up in a static shell.

## Forms

- React Hook Form + Zod, always through the shared field components.
- Zod checks shape and required fields for fast feedback. Rules needing server knowledge belong to the
  API: uniqueness, slots, balances, permissions.
- On `422`, map each `errors` key to its field, including nested keys, and show the rest at form level.
- Use `useFormSubmit`, and `router.refresh()` after a change. A form that moves on calls `router.push()`, then `router.refresh()` ([ADR 0011](decisions/0011-server-reads-and-refresh.md)). Patient forms are the exception: nothing they show is on the server, so they use what the API returned and call `noteChange()` ([ADR 0012](decisions/0012-audited-reads-in-the-browser.md)).
- Visited pages stay mounted but hidden. A form that moves on calls `reset()`, and any password field uses `useClearOnLeave`.
- Give a field holding an existing value a `defaultValue`, so that it's there before hydration.
- Disable submit while pending, and until hydration, using `useHydrated`. Use `method="post"` on any form with a field that must stay out of the address, or the browser can submit it by itself as GET before React is ready.
- Show backend messages as sent. Never compare message text in code.
- On a page with text that's only on screen, use `UnsavedChangesGuard`, make fields read-only rather than disabled while a request runs, and use `answerSessionEnd` and `keepOnRefusal`, so that no failure can lose what's typed ([ADR 0014](decisions/0014-writing-medical-records.md)).
- Clinical fields spread `CLINICAL_INPUT`, and never have a `maxLength`, as cutting pasted clinical text silently is worse than a refusal that keeps it.

## Internationalization

- Every visible string, including `aria-label` and placeholders, comes from `messages/`.
- Use ICU for plurals. Arabic has six plural forms.
- Don't concatenate translated fragments.
- Enum labels are translated by the frontend; stored text is displayed unchanged.
- Specialties use `name_ar` or `name_en` based on the locale.
- Check every screen in Arabic as you build it, not at the end.

## RTL

- Logical utilities only: `ms-4`, not `ml-4`; `text-start`, not `text-left`; `start-0`, not `left-0`.
- Mirror directional icons with `rtl:rotate-180`.
- Wrap LTR values inside Arabic text. Use `dir="auto"` for user-written text.

## Dates, times, money

- Show values through `Money`, `ClinicDate`, `ClinicTime`, and `Instant` only, which use `lib/format`. Pass `Instant` the clinic's time zone.
- Never call `new Date('2026-11-08')` on a clinic date: it's parsed as UTC, and can show the wrong day.
- Never convert wall-clock times, and handle `24:00`.
- Money stays a string. Format with `Intl.NumberFormat`, which accepts decimal strings. Never use
  `parseFloat` or `Number`.
- Check and compare an amount someone typed with `lib/format/amount.ts`: `normalizeAmount`, `isAmount`, and `compareAmounts`, which
  work on the digits. Show a typed amount with `toMoneyText`. Never work out an amount to show; show the API's.
- Never work out a figure to show: no totals, averages, or rates in the frontend, as reports send their own. A `null` figure is "Not
  available", never `0` or the dash. To size a chart from money, use `toPiastres`, whose exact integers label nothing (ADR 0017).

## Security and privacy

**Never:**

- Put a token in client code, a response to the browser, or any browser storage.
- Add `NEXT_PUBLIC_` to anything that isn't safe to publish.
- Log a request body, a query string, or an API response. Log status, route pattern, and duration only.
- Put patient details in an analytics event, an error report, or a page title.
- Persist the query cache, or store patient data in `localStorage`.
- Use `dangerouslySetInnerHTML` on API data.
- Use real patient data in tests, fixtures, screenshots, or examples.

**Always:**

- Treat a return URL as untrusted: same-origin paths only.
- Cover `401`, `403`, and `404` on every screen.
- Add the "no medical details" hint on time-off reason, appointment note, and charge reason fields.

## Testing

| Change | Minimum tests |
|---|---|
| Logic or formatter | Vitest unit tests, including edge cases |
| Component with data | Loading, error, empty, and success states |
| Form | Valid submit, client validation, server `422` mapping |
| Role-dependent UI | Each role that differs |
| Critical journey | Playwright, per role, in Arabic and English |
| Audited read | Test proves that focus and re-render don't refetch |

- Use accessible queries (`getByRole`) rather than test ids. After a soft navigation, `getByLabel` can also find a hidden page's field, so add `.locator("visible=true")`.
- In Arabic, "الرسوم" is Charges and "سعر الكشف" is a doctor's fee. Keep them apart.
- The backend is called from the server, so Playwright can't intercept it. End-to-end tests control `e2e/support/fake-backend.mjs`
  instead, and `pnpm test:e2e:live` covers the real API.
- Test data is synthetic, and is clearly fake.
- Report what was actually run and its result. A failure is reported, never hidden.

## Git

- Branch from the default branch per feature, following Spec Kit's `NNN-feature` naming.
- Conventional commits, each small and independently understandable.
- Never commit `.env*` files with real values. `.env.example` holds placeholders only.

## Documentation

- Update the affected documents in the same change as the code.
- Any architectural decision gets an ADR, including rejecting something significant.
- When the backend moves on, re-check it and update the analyzed commit in `backend-integration.md`.
