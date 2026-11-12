import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./src/lib/security/headers";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // The Docker image runs only what the server needs (ADR 0022).
  output: "standalone",
  // See docs/decisions/0006-cache-components.md for the rules these bring.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Request logs include query strings, which can hold patient details (constitution, principle II).
  logging: { incomingRequests: false },
  // On every response: pages, route handlers, and static files (ADR 0021).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV === "development"),
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
