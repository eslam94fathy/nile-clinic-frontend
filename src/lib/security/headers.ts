// Every response's security headers (ADR 0021, contracts/security-headers.md in Phase 13's spec). Plain
// TypeScript, as `next.config.ts` imports it. Strict transport security is the reverse proxy's, because the
// application is also reached over plain HTTP inside the host and in tests.

/**
 * Inline scripts are allowed because every page streams scripts written at request time, which no hash can
 * match, and prerendered shells can't carry a per-request nonce. Everything else stays closed.
 */
function contentSecurityPolicy(isDev: boolean): string {
  return [
    "default-src 'none'",
    // React needs eval in development only, to rebuild server error stacks.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    // Server-rendered style attributes, and the style elements libraries add while running.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // The browser only talks to this application, which reaches the backend for it (ADR 0001).
    "connect-src 'self'",
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join("; ");
}

const PERMISSIONS_POLICY = [
  "camera",
  "microphone",
  "geolocation",
  "payment",
  "usb",
  "serial",
  "bluetooth",
  "hid",
  "display-capture",
  "browsing-topics",
]
  .map((feature) => `${feature}=()`)
  .join(", ");

export function securityHeaders(
  isDev: boolean,
): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Addresses can hold search terms, so they never go to another site.
    { key: "Referrer-Policy", value: "same-origin" },
    // For browsers that don't know `frame-ancestors`.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ];
}
