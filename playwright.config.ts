import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the order state machine e2e suite.
 *
 * - Auto-starts `npm run dev` if nothing is on :3000; reuses an existing
 *   server if there is one (so you can leave `npm run dev` running in
 *   another terminal and just call `npm run test:e2e`).
 * - HTML reporter with inline screenshots — one file summarizes every
 *   run. Open with `npm run test:e2e:report` or the CLI hint shown at
 *   the end of every run.
 * - Screenshot on failure + traces on retry — a broken test attaches
 *   both to the report automatically.
 * - Each spec explicitly `page.screenshot()`s at its terminal state so
 *   the report shows the finished UI for every scenario, pass or fail.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // in-memory store is shared; run serial to avoid cross-test contamination
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
