import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests run against the production build:
 *   npm run build && npm run test:e2e
 * A server is started on port 3400 (or reused if one is already running).
 * Set E2E_BASE_URL to test a server you started yourself.
 */
const PORT = Number(process.env.E2E_PORT ?? 3400);
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: external
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/en`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
