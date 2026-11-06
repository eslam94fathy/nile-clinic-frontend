import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const appPort = 3112;

// The live tests' setup needs the backend's address and the synthetic administrator from here too.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Runs against the real backend: `next start` reads BACKEND_API_URL from `.env.local`.
export default defineConfig({
  testDir: "./e2e/live",
  globalSetup: "./e2e/live/setup.ts",
  globalTeardown: "./e2e/live/teardown.ts",
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: "list",
  // All staff share one sign-in limit through this server, so a test may have to wait it out.
  timeout: 180_000,
  use: {
    baseURL: `http://localhost:${appPort}`,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${appPort}`,
    url: `http://localhost:${appPort}/ar/sign-in`,
    reuseExistingServer: false,
  },
});
