import { defineConfig, devices } from "@playwright/test";

/**
 * Admin browser tests (Phase A2), separate from the public suite (playwright.config.ts): they need a local MariaDB.
 *   npm run build && npm run test:admin
 * e2e-admin/server.mjs creates a fresh database, applies the migrations and starts server.js on port 3401; the
 * database is dropped afterwards. The tests share that one database, so they run in order, one worker at a time (the
 * "parity" project's spec last, in a worker of its own).
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
      testIgnore: /preview-parity\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } },
    },
    {
      // The preview parity spec (A5) runs after the other specs, in a new worker and so a new browser. In the browser
      // that had just run the other specs' ~100 tests, Chromium 141's headless renderer froze at its first 390 px page
      // in 5 runs of 5: the main thread waiting forever in the compositor (cc::LayerTreeHost::
      // WaitForProtectedSequenceCompletion) during an instant scroll. In a fresh browser, on the same server, it passed.
      name: "parity",
      testMatch: /preview-parity\.spec\.ts$/,
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
