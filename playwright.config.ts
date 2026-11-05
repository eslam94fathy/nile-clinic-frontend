import { defineConfig, devices } from "@playwright/test";
import { appPort, backendControlUrl, backendPort } from "./e2e/support/ports";

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
      command: `node node_modules/next/dist/bin/next start -p ${appPort}`,
      url: `http://localhost:${appPort}/ar`,
      env: {
        BACKEND_API_URL: `http://127.0.0.1:${backendPort}/api/v1`,
        CLINIC_TIMEZONE: "Africa/Cairo",
      },
      reuseExistingServer: false,
    },
  ],
});
