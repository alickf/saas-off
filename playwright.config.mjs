import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:8787', trace: 'retain-on-failure' },
  projects: [ { name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } } ],
  webServer: { command: 'node scripts/dev.mjs', url: 'http://localhost:8787', reuseExistingServer: !process.env.CI, env: { DB_PATH: ':memory:' } },
  reporter: [['list'], ['html', { open: 'never' }]]
});
