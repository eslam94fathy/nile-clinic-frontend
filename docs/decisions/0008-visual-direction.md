# ADR 0008: Visual direction "Still water", with Western digits in Arabic

**Status:** Accepted, by the project owner, 2026-11-06.

## Context

Decision Q5 in the [roadmap](../roadmap.md) asked for an original, neutral clinical look in light and dark, with no printing. The
blueprint asks for calm and clinical, dense enough for a front desk, and highly legible in both scripts. It also left the style of
digits in Arabic to this phase. The owner compared two directions in both languages and both themes.

## Decision

**Direction A, "Still water", as proposed.** Deep river teal on a cool, quiet ground. Rows are open and ruled at 48 px, with room to
read a name at a glance. Status is a bordered, tinted pill that always holds its label. Corners are 6 px on controls.

**Typefaces.** IBM Plex Sans (variable) for Latin and IBM Plex Sans Arabic (400, 500, 600) for Arabic, drawn as one family. Files come
from pinned packages, and total about 180 KB.

**Digits.** Western digits (`123`) in both languages, controlled by one setting in `lib/format`, so that staff can match what they see
against phone numbers and IDs without translating digits at a busy desk.

**Tokens.** This table is the source for `src/app/globals.css`. All values are solid, except `overlay`.

| Token | Light | Dark |
|---|---|---|
| `background` | `#F4F7F7` | `#0D1B1E` |
| `card`, `popover` | `#FFFFFF` | `#14262A` |
| `foreground`, `card-foreground`, `popover-foreground` | `#10282D` | `#E4EEEF` |
| `muted`, `secondary` | `#E8EEEF` | `#1C3035` |
| `accent` | `#DDE8EA` | `#24393E` |
| `muted-foreground` | `#4A6166` | `#A0B4B8` |
| `secondary-foreground`, `accent-foreground` | `#10282D` | `#E4EEEF` |
| `primary` | `#0A5A66` | `#63C6D1` |
| `primary-foreground` | `#FFFFFF` | `#06282D` |
| `destructive` | `#A3231F` | `#F2A29E` |
| `destructive-foreground` | `#FFFFFF` | `#3A0B09` |
| `border` | `#D3DEDF` | `#27393D` |
| `input` | `#748B90` | `#6E8A90` |
| `ring` | `#0A7786` | `#7FD6E0` |
| `overlay` | `#10282D66` | `#00000099` |
| `status-neutral` / `-foreground` / `-border` | `#E8EEEF` / `#2D4146` / `#6F858A` | `#213338` / `#D5E2E4` / `#7F979C` |
| `status-active` / `-foreground` / `-border` | `#DCEBFA` / `#0F3F73` / `#2F73B8` | `#12304F` / `#BBDBFB` / `#5A9FE0` |
| `status-success` / `-foreground` / `-border` | `#DDF1E4` / `#14532D` / `#2E8550` | `#123521` / `#B4E8C7` / `#4FB378` |
| `status-warning` / `-foreground` / `-border` | `#FCEBCF` / `#6B3E00` / `#B26F00` | `#3D2A08` / `#F6D59A` / `#CF9333` |
| `status-muted` / `-foreground` / `-border` | `#EEF0F0` / `#4E5A5D` / `#8A9699` | `#1C2A2D` / `#A9B6B9` / `#6F7F83` |

`pnpm check:contrast` enforces the contrast of these pairs in both themes.

## Alternatives

**Direction B, "Day sheet".** Ink blue on neutral grey at 34 px rows, with Noto Sans fonts, and status as a shape and a word. It fits
about 40% more rows, but feels busier, and its small text and controls are harder in Arabic and on a doctor's tablet.

**Tightening A's rows to 40 px** was offered and not chosen. Row height is one class in `DataTable`, so revisiting it is cheap.

**Eastern Arabic digits (`١٢٣`)** read more traditionally, but mix digit styles wherever phone numbers and IDs stay as entered.

## Consequences

- Fewer rows fit on one screen than Direction B would allow. Reception's real use may call for tightening, so this is worth watching.
- The Arabic font comes in three files rather than one variable file.
- The proposal was a private page and isn't in the repository. This record is the durable source.
