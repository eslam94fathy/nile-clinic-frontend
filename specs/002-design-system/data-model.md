# Data Model: Design System

This phase stores no business data. These are the design-time structures and the one saved preference.

## Design tokens

CSS custom properties, set in `src/app/globals.css` on `:root` and `[data-theme="dark"]`, and exposed to Tailwind through `@theme inline`.
**Values come from the approved visual direction.** The names follow shadcn's so generated components work unchanged.

| Group | Tokens |
|---|---|
| Surfaces | `background`, `card`, `popover`, `muted`, `secondary`, `accent`, `overlay` (the dimmed page behind a dialog; may be translucent, as no text sits on it) |
| Text | `foreground`, `card-foreground`, `popover-foreground`, `muted-foreground`, `secondary-foreground`, `accent-foreground` |
| Action | `primary`, `primary-foreground`, `destructive`, `destructive-foreground` |
| Lines | `border`, `input`, `ring` |
| Status | `status-{neutral,active,success,warning,muted}` and `-foreground` and `-border` for each |
| Scale | `radius`, Tailwind's spacing and type scales |
| Type | `--font-latin`, `--font-arabic`, `--font-sans` |

**Validation**

- Text tokens are solid hex values, with no opacity.
- 4.5:1 for each declared text and background pair; 3:1 for `border` on status badges, `input`, and `ring` against `background`, in both themes.
- No raw colors in components. Arbitrary values built only from token variables are allowed, such as `bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]`. The one exception is the system colors `Canvas` and `CanvasText` on native select options.
- `sidebar-*` and `chart-*` tokens from `init` are removed until something needs them.

## Status mapping

One record per enumeration value, compile-checked against the generated types (research R12).

| Field | Type | Rule |
|---|---|---|
| `kind` | `appointment`, `queue`, `charge`, `record` | Which enumeration |
| `value` | That enumeration's union | Exhaustive: an unmapped value fails type checking |
| `tone` | `neutral`, `active`, `success`, `warning`, `muted` | From FR-018 |
| label | Translation key `shared.status.<kind>.<value>` | In both languages |

`charge` is the union of `ChargeStatus` and the visit's `charge_status`, so it includes `none`.

**At runtime**: a value outside the mapping gets tone `neutral` and the label `shared.status.unknown`.

## Theme choice

| Field | Value |
|---|---|
| Storage | `localStorage`, key `theme` |
| Stored values | `light`, `dark`. No entry means following the device |
| Effective theme | `data-theme` on `<html>`, always `light` or `dark` |

**Rules**

- Any other stored value is treated as no entry.
- Storage failures are ignored, and the device's setting applies.
- While following the device, changes to the device's setting apply live.
- Holds no personal data, and is unaffected by sign-out.

```text
          choose "light"                 choose "dark"
 device ─────────────────► light ◄────────────────────► dark
    ▲                        │                            │
    └────────────── choose "device" ──────────────────────┘
```

## Value inputs

| Display | Accepts | Output | On null or invalid |
|---|---|---|---|
| `Money` | `^-?\d+\.\d{2}$` string | Localized EGP, Western digits, no float | "No value" |
| `ClinicDate` | Valid `YYYY-MM-DD` | Same text, `<time>`, `dir="ltr"` | "No value" |
| `ClinicTime` | `HH:MM` or `24:00` | Same text, `dir="ltr"` | "No value" |
| `Instant` | Either backend spelling, plus required `timeZone` | Localized, in `timeZone`, `<time>` | "No value" |

The "no value" display is an em dash, with a visually hidden translated label.

## Preview setting

| Field | Value |
|---|---|
| Name | `DESIGN_PREVIEW_ENABLED` |
| Values | `true`, or unset or `false` for off |
| Scope | Server only; never `NEXT_PUBLIC_` |
| Validation | Any other value stops startup, with a message naming the setting |
