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
| [0012](0012-audited-reads-in-the-browser.md) | Audited reads and patient search in the browser, an exception to 0011 that reverses part of 0005 | Proposed |

To add one, copy the structure of an existing record: Status, Context, Decision, Alternatives,
Consequences.
