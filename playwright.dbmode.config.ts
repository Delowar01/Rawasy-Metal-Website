import { defineConfig, devices } from "@playwright/test";

/**
 * Database-mode end-to-end tests (A9 acceptance): the admin and the public website from one database-content release,
 * on a disposable local MariaDB database filled by the real content import.
 *   CONTENT_SOURCE=database NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build && npm run test:dbmode
 * e2e-dbmode/server.mjs refuses a static build. One worker: the tests share one database and run in order. Never run it
 * at the same time as the admin suite (they share the run's state file).
 */
const PORT = Number(process.env.DBMODE_E2E_PORT ?? 3402);

export default defineConfig({
  testDir: "./e2e-dbmode",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } }],
  webServer: {
    command: "node e2e-dbmode/server.mjs",
    url: `http://localhost:${PORT}/admin/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
  },
});
