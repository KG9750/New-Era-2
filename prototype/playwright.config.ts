import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4186',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'VITE_GIT_SHA=e2e-git-sha VITE_ARTIFACT_HASH=e2e-artifact-hash npm run build && npm exec vite preview -- --host 127.0.0.1 --port 4186',
    port: 4186,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
})
