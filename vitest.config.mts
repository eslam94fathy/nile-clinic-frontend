import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // The real package throws outside a server bundle.
      "server-only": fromRoot("./vitest.server-only-stub.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    restoreMocks: true,
    unstubEnvs: true,
    // next-intl's ESM imports `next/server` without an extension, which only a bundler resolves.
    server: { deps: { inline: ["next-intl"] } },
  },
});
