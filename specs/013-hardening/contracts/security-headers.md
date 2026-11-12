# Contract: Security headers

Reasons in [research R1 and R2](../research.md#r1-how-the-content-security-policy-treats-scripts).

## Set by the application, on every response

Through `headers()` in `next.config.ts`, source `/:path*`, so pages, route handlers, and static files all carry them. Production values;
in `next dev`, `script-src` also allows `'unsafe-eval'`, which React needs there, and nothing else differs.

| Header | Value |
|---|---|
| `Content-Security-Policy` | See below |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `same-origin` |
| `X-Frame-Options` | `DENY` (for browsers without `frame-ancestors`) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), display-capture=(), browsing-topics=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

### Content security policy

```text
default-src 'none';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self';
manifest-src 'self';
form-action 'self';
frame-ancestors 'none';
base-uri 'none';
object-src 'none'
```

- `default-src 'none'`: anything not listed is refused, including frames, workers, and media.
- `style-src 'unsafe-inline'`: server-rendered `style` attributes (F6) and the `<style>` elements libraries add at runtime.
- `img-src data: blob:`: the inline logo and icons. No image from another site.
- Only the backend's own address is never contacted from the browser: every call goes through `/api/backend` (ADR 0001), so
  `connect-src 'self'` is enough.

## Already sent, unchanged

| Where | Header |
|---|---|
| Pages | `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` (Next.js, F5) |
| Route handlers | `Cache-Control: no-store` |
| Static files under `/_next/static` | `Cache-Control: public, max-age=31536000, immutable` (no personal data; content-hashed names) |

A test asserts the page and route values above, so a later change can't make a personal response storable by a shared cache (FR-011).

## Set by the reverse proxy only

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000` (no `includeSubDomains` or `preload` unless IT decides so for the whole domain) |

The proxy also redirects plain HTTP to HTTPS, replaces `X-Forwarded-For` (R5), and passes `Host` unchanged (F12). It must not add a second
`Content-Security-Policy`, which browsers would combine, making the stricter of the two win.

## Rules the code keeps

- `react/no-danger` is an error, with one documented exception: `theme-script.tsx`.
- No `eval`, `new Function`, or string `setTimeout` in source (already blocked by lint).
- No resource from another origin: fonts are bundled, and there is no analytics or third-party script.

## Tests

- Every route kind (public page, signed-in page, not-found, an `/api/auth` route, `/api/backend`, `/api/health`, a static chunk) carries
  each header above with exactly these values.
- Every screen in both locales and themes logs no `securitypolicyviolation` event, in the accessibility sweep and the live journeys.
- The theme is right on first paint with the policy in force (no flash), in both themes.
