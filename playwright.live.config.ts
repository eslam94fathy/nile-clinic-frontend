import { defineConfig, devices } from "@playwright/test";

const appPort = 3112;

// Runs against the real backend: `next start` reads BACKEND_API_URL from `.env.local`.
export default defineConfig({
  testDir: "./e2e/live",
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${appPort}`,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${appPort}`,
    url: `http://localhost:${appPort}/ar`,
    reuseExistingServer: false,
  },
});
