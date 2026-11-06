import { defineConfig, devices } from "@playwright/test";
import {
  appPort,
  backendControlUrl,
  backendPort,
  appServerLog,
  previewOffPort,
} from "./e2e/support/ports";

// Fixed and fake: it only seals sessions for the fake backend.
const SESSION_SECRET = "synthetic-session-secret-for-end-to-end-tests";

// Runs against the production build (`pnpm test:e2e` builds first) and the fake backend. Tests
// run one at a time, because they share the fake backend's mode.
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "live/**",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${appPort}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "node e2e/support/fake-backend.mjs",
      url: `${backendControlUrl}/stats`,
      env: { PORT: String(backendPort) },
      reuseExistingServer: false,
    },
    {
      // Written to a file, so a test can check that no secret reaches the server's output.
      command: `node node_modules/next/dist/bin/next start -p ${appPort} > ${appServerLog} 2>&1`,
      url: `http://localhost:${appPort}/ar`,
      env: {
        BACKEND_API_URL: `http://127.0.0.1:${backendPort}/api/v1`,
        CLINIC_TIMEZONE: "Africa/Cairo",
        SESSION_SECRET,
        DESIGN_PREVIEW_ENABLED: "true",
      },
      reuseExistingServer: false,
    },
    {
      // The same build with the design preview off, to prove it's private.
      command: `node node_modules/next/dist/bin/next start -p ${previewOffPort}`,
      url: `http://localhost:${previewOffPort}/ar`,
      env: {
        BACKEND_API_URL: `http://127.0.0.1:${backendPort}/api/v1`,
        CLINIC_TIMEZONE: "Africa/Cairo",
        SESSION_SECRET,
        // Explicit, or a developer's .env.local could turn it on and fail these tests.
        DESIGN_PREVIEW_ENABLED: "false",
      },
      reuseExistingServer: false,
    },
  ],
});
