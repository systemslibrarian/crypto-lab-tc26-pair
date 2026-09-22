import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 180_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4698/crypto-lab-tc26-pair/',
    colorScheme: 'dark',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4698 --strictPort',
    url: 'http://localhost:4698/crypto-lab-tc26-pair/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});