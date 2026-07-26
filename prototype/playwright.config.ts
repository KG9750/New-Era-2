import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4186',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'npm run rc:serve -- --port 4186 --capture-dir test-results/captures',
    port: 4186,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium-1440x900',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--single-process'] },
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'chromium-1280x720',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--single-process'] },
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
})
