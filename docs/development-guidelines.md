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

## Proxy and caching

- Never re-create the request in `src/proxy.ts`; see the [architecture](architecture.md#internationalization-and-direction).
- Never use `use cache` on per-user, patient, or clinical data ([ADR 0006](decisions/0006-cache-components.md)).
- Dynamic data stays inside `<Suspense>`, so it can't end up in a static shell.

## Forms

- React Hook Form + Zod, always through the shared field components.
- Zod checks shape and required fields for fast feedback. Rules needing server knowledge belong to the
  API: uniqueness, slots, balances, permissions.
- On `422`, map each `errors` key to its field, including nested keys, and show the rest at form level.
- Disable submit while pending.
- Show backend messages as sent. Never compare message text in code.

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

- Use accessible queries (`getByRole`) rather than test ids.
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
