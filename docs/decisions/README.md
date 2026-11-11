# Architecture Decision Records

One file per significant decision. **Proposed** means awaiting the project owner's approval;
**Accepted** means approved. Superseded records are kept, with a link to their replacement.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-authentication-bff.md) | Authenticate through a Next.js BFF with a sealed HttpOnly cookie | Accepted |
| [0002](0002-native-fetch.md) | Native `fetch`, not Axios | Accepted |
| [0003](0003-i18n-routing.md) | Locale in the URL with next-intl | Accepted |
| [0004](0004-api-types-from-contracts.md) | Generate API types from the backend's OpenAPI contracts | Accepted |
| [0005](0005-audit-safe-data-fetching.md) | Query policy that protects the audit trail | Accepted |
| [0006](0006-cache-components.md) | Adopt Next.js Cache Components, with privacy rules | Accepted |
| [0007](0007-design-system-foundation.md) | shadcn on Radix, native selects, own theme code, pinned fonts, two-gate preview | Accepted |
| [0008](0008-visual-direction.md) | Visual direction "Still water", with Western digits in Arabic | Accepted |
| [0009](0009-brand-assets.md) | Brand assets, with the logo drawn inline | Accepted |
| [0010](0010-session-and-guards.md) | How sessions are read, ended, and checked | Accepted |
| [0011](0011-server-reads-and-refresh.md) | Server reads, then refresh, with no client cache yet | Accepted |
| [0012](0012-audited-reads-in-the-browser.md) | Audited reads and patient search in the browser, an exception to 0011 that reverses part of 0005 | Accepted |
| [0013](0013-live-reads.md) | Live reads through TanStack Query, on the queue's pages only | Accepted |
| [0014](0014-writing-medical-records.md) | Saving by a person's action only, a guard on leaving, and answering a `401` while writing a record | Accepted |
| [0015](0015-live-reads-beyond-the-queue.md) | Billing reads live for today and on demand otherwise; the live pieces move to shared places | Accepted |
| [0016](0016-reports-read-on-demand.md) | Reports read in the browser on demand, never by themselves | Accepted |
| [0017](0017-charts-without-a-library.md) | The one chart is drawn without a library; `recharts` rejected | Accepted |
| [0018](0018-audit-search-on-press.md) | The audit search reads only on a person's press, in memory, with no effect or cache | Accepted |
| [0019](0019-dashboards-read-in-panels.md) | Dashboards read in panels: live for the desk and doctors, on demand for administrators | Accepted |

To add one, copy the structure of an existing record: Status, Context, Decision, Alternatives,
Consequences.
