import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // See docs/decisions/0006-cache-components.md for the rules these bring.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Request logs include query strings, which can hold patient details (constitution, principle II).
  logging: { incomingRequests: false },
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
