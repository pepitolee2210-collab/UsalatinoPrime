import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx next dev --turbopack --port 3000',
    port: 3000,
    reuseExistingServer: true,
    timeout: 30000,
  },
})
