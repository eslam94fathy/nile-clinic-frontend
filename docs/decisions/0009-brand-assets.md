# ADR 0009: Brand assets, with the logo drawn inline

**Status:** Proposed. The project owner supplied the logo kit on 2026-11-06. How it is used here awaits their approval.

## Context

The owner designed a logo kit: a water drop with a heartbeat line, the names "Nile Clinic" and "مركز النيل الطبي", and sets of icons. It
is kept outside this repository, in `nile-clinic-logo`. The API has no clinic details (gap G6 in
[backend-integration](../backend-integration.md)), so the frontend holds these.

The kit's logos are SVG files with live text, and they import IBM Plex Sans Arabic from Google Fonts. A browser blocks that import when
an SVG loads as an image, so the text would fall back to whatever font the computer has. Loaded any other way, it would tell another
company about every staff member's visit.

## Decision

**Icons are the kit's files, unchanged,** placed where Next.js looks for them: `favicon/favicon.ico` as `src/app/favicon.ico`,
`favicon/favicon.svg` as `src/app/icon.svg`, and `icon/apple-touch-icon.png` as `src/app/apple-icon.png`.

**The logo is inline SVG, in `components/shared/logo.tsx`,** copying the shapes, positions, and sizes of the kit's `logo-horizontal` for
English and `logo-arabic` for Arabic. Its text uses the fonts the app already bundles, and comes from the translation files. The
accessible name is the clinic's name in the current language.

**Brand colors are their own tokens,** and don't replace `primary`, which the owner accepted separately in
[ADR 0008](0008-visual-direction.md). `pnpm check:contrast` covers them.

| Token | Light | Dark |
|---|---|---|
| `brand` | `#0B6E79` | `#3CC2CC` |
| `brand-foreground` | `#FFFFFF` | `#0F2A33` |
| `brand-name` | `#0F2A33` | `#FFFFFF` |
| `brand-tagline` | `#0B6E79` | `#7FDCE2` |

**The Arabic name is weight 600, where the kit has 700.** The app bundles 400, 500, and 600 (ADR 0008), and a fourth file of about 44 KB
on every first visit is too much for one difference this small.

## Alternatives

**Convert the kit's text to outlines and use the files as images.** This is exact, including the 700 weight. It needs a pair of images
per language, swapped by theme, and new files from a design tool whenever the logo changes. It remains a good option if the owner wants
the exact weight.

**Add a web app manifest,** which would use `icon-192`, `icon-512`, and `icon-maskable-512`. Nothing asks for installing this app yet, so
these aren't added.

## Consequences

- The kit's teal differs slightly from `primary` (`#0B6E79` against `#0A5A66`, and `#3CC2CC` against `#63C6D1` in dark). Both are in use.
- A change to the logo's shape has to be copied by hand from the kit to the component.
- A Content Security Policy (Phase 13) has nothing extra to allow for the logo.
