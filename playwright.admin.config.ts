import { defineConfig, devices } from "@playwright/test";

/**
 * Admin browser tests (Phase A2), separate from the public suite (playwright.config.ts): they need a local MariaDB.
 *   npm run build && npm run test:admin
 * e2e-admin/server.mjs creates a fresh database, applies the migrations and starts server.js on port 3401; the
 * database is dropped afterwards. The tests share that one database, so they run in order on one worker.
 */
const PORT = Number(process.env.ADMIN_E2E_PORT ?? 3401);

export default defineConfig({
  testDir: "./e2e-admin",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } },
    },
  ],
  webServer: {
    command: "node e2e-admin/server.mjs",
    url: `http://localhost:${PORT}/admin/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
  },
});
