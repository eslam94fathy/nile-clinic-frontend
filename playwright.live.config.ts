import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const appPort = 3112;

// What the application server prints during the run, which a test searches for patient details (SC-005).
const serverLog = ".next/e2e-live-app-server.log";

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
    // The standalone server the Docker image runs (ADR 0022). It doesn't read `.env.local`, so the settings
    // loaded above are passed on; HOSTNAME is fixed, as Git Bash sets it to the machine's name.
    command: `node .next/standalone/server.js > ${serverLog} 2>&1`,
    url: `http://localhost:${appPort}/ar/sign-in`,
    env: {
      PORT: String(appPort),
      HOSTNAME: "127.0.0.1",
      BACKEND_API_URL: process.env.BACKEND_API_URL ?? "",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "",
      CLINIC_TIMEZONE: process.env.CLINIC_TIMEZONE ?? "Africa/Cairo",
    },
    reuseExistingServer: false,
  },
});
