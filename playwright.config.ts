import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:1420",
    // Rules are marked seen so first-launch Rules do not block the specs;
    // e2e/settings.spec.ts opts out to cover the fresh install.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:1420",
          localStorage: [
            {
              name: "doku:settings",
              value: JSON.stringify({ haptics: true, seenTutorial: true }),
            },
          ],
        },
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-webkit",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["iPhone 14"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
  },
});
