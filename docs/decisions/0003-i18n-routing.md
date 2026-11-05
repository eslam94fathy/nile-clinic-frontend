# ADR 0003: Locale in the URL with next-intl

**Status:** Accepted · **Date:** 2026-11-05

## Context

The application must support Arabic and English with full RTL and LTR, in Server and Client Components. The
API selects its language from `Accept-Language` per request, and doesn't store a language per user.

## Decision

Use `next-intl` with a prefixed locale segment on every route: `/en/...` and `/ar/...`. The locale sets
`<html lang dir>` and the `Accept-Language` of API calls. Remember the last choice in a non-sensitive cookie,
for use when a person arrives with no prefix.

The default language is Arabic, with English one click away ([Q3](../roadmap.md#decisions-on-open-questions)).

## Alternatives

| Option | Why not |
|---|---|
| Cookie only, with no URL prefix | Makes rendering depend on a cookie, and a shared link can open in the wrong language |
| Stored per-user preference | The API has no such field, and inventing one isn't allowed |
| Hand-written translation code | `next-intl` already handles ICU plurals, which Arabic needs, and Server Component support |

## Consequences

Every link has to be locale-aware, using next-intl's routing helpers. Switching language keeps the same page
through a navigation. Errors from the API then appear in the new language on the next request.
