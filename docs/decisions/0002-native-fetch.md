# ADR 0002: Native `fetch`, not Axios

**Status:** Accepted · **Date:** 2026-11-05

## Context

The brief leaves this choice open. Axios's main advantages are interceptors, automatic JSON handling, and
request cancellation. Under [ADR 0001](0001-authentication-bff.md), the token and locale headers are added
in one place, the proxy, so client code has no auth headers to manage. Next.js also integrates with `fetch`
on the server.

## Decision

Use native `fetch`, wrapped by two small functions in `lib/api`: a server client and a browser client. Both
parse JSON and throw a single typed `ApiError`, with status, `message`, `errors`, and `reason`.

## Alternatives

**Axios.** Adds a runtime dependency for features that would hardly be used. Its interceptors are not needed
for auth, and `AbortController` and TanStack Query already cover cancellation.

## Consequences

One fewer dependency in a medical application. `fetch` doesn't reject on `4xx` or `5xx`, so the wrappers must
check `response.ok`; this is contained in one place and is tested. Upload progress isn't available with
`fetch`, but the API has no upload endpoints.
