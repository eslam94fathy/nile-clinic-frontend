# ADR 0017: Charts without a library

**Status:** Accepted, by the project owner with Phase 10's plan, 2026-11-08

See [research](../../specs/010-reports/research.md), R5. Settles the deferred `recharts` entry in `docs/tech-stack.md`.

## Context

The roadmap left the charting library to Phase 10. The owner chose a single chart: Money collected's net by day, beside a table of the
same figures (Phase 10 clarification 2). The chart must follow the reading direction, use the design tokens in both themes, meet WCAG 2.2
AA, and never let a bar contradict the API's exact amount.

## Decision

- No charting library. The chart is plain HTML and CSS in `features/reports`: one column per day in a flex row, which follows `dir`, around
  a zero line.
- Heights come from whole piastres read from the API's string digits, compared as exact integers. Labels are the API's own strings.
- Bars use design tokens, and negative bars differ by position and pattern as well as color. `check:contrast` checks both against `card`.
- The chart is one labelled image for assistive technology; its table is the way to read every figure.
- `recharts` is rejected in `docs/tech-stack.md`. A later need for several chart types, axes, or interaction would reopen this.

## Alternatives

| Option | Why not |
|---|---|
| `recharts` | A large dependency, with its `d3` packages, for one bar chart. Its axes don't follow `dir`, it works in floating-point numbers, and its tooltips and focus would need WCAG checking |
| Hand-drawn SVG | Doesn't follow the reading direction or wrap labels by itself |
| No chart | The owner chose one |

## Consequences

- About a hundred lines of code and their tests instead of a dependency.
- A second, different chart would be the point to reconsider, under constitution IX's rule of two uses.
