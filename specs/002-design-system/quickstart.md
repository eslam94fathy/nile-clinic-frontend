# Quickstart: Validating the Design System

How to confirm this phase works. Details are in [the contract](contracts/shared-components.md) and [research](research.md).

## Automated

```powershell
pnpm check
```

This must pass, and now also includes the contrast check. End-to-end tests start two servers from one build: the preview on and the preview off.

| Scenario | Proves | Expected |
|---|---|---|
| Axe on the preview, in `ar` and `en`, light and dark | SC-003, SC-002 | No serious or critical issues in all four |
| Axe on Phase 1's pages | SC-003 | Same; their existing tests still pass unchanged |
| Contrast script | SC-004 | Every declared pair passes, in both themes |
| Preview off | SC-008 | `404` matching an unknown address; a sentinel value is absent from responses, prerendered files, and `.next/static` |
| Browser zones: Los Angeles, UTC, Tokyo | SC-006 | Dates, times, and instants match the expected text |
| Very large amount | SC-006 | All digits intact |
| Saved theme on a device set the other way | FR-008, FR-009 | Correct before hydration, with no console errors |
| Language switch with a saved theme | Research R5 | Theme kept |
| Arabic page | Research R4 | The Arabic font is really loaded, checked through `document.fonts` |
| Open dialog, Tab repeatedly | FR-030 | Focus never leaves. Escape returns it to the trigger |
| Pending dialog | FR-025 | Second confirm and Escape do nothing |
| Tab through the preview, both directions | SC-005 | Every interactive element reached, with a visible focus style |
| Widths from 768 to 1920 px, both directions | SC-009 | No sideways page scrolling, including with long unbroken values |
| Width of 600 px, both directions | US5 scenario 2 | The table is replaced by readable cards, with no sideways page scrolling |
| Tab through the preview with a notice open | FR-029 | The focused element is never covered by the notice |
| Removing a status from the mapping | FR-019 | Type checking fails. Show this once and record it |

## By hand

Add `DESIGN_PREVIEW_ENABLED=true` to `.env.local`, then:

```powershell
pnpm dev
```

Open <http://localhost:3000/ar/design-preview> and check, in each of the four combinations:

1. Arabic text looks right, with marks unclipped and line height comfortable.
2. Directional icons mirror, and others don't.
3. Dark theme has no unreadable text or hard-to-see borders.
4. At 200% browser zoom, content stays usable (SC-009).
5. With your computer's color filter on grayscale, each status is identifiable by its label (SC-007).
6. With your operating system's reduced-motion setting on, animations are removed or reduced.

Remove the setting and restart: the same address shows the ordinary not-found page.

## Owner approval

| Gate | When | Evidence |
|---|---|---|
| Visual direction approved | Before any shared component is built | ADR with date (SC-001) |
| Phase accepted | After the checks above | Results in `tasks.md`; roadmap updated |
