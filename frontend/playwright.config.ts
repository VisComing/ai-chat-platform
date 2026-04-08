import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Don't start servers - assume they're already running
  // webServer: [
  //   {
  //     command: 'npm run dev',
  //     url: 'http://localhost:3002',
  //     reuseExistingServer: true,
  //   },
  //   {
  //     command: 'cd ../backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001',
  //     url: 'http://127.0.0.1:8001/health',
  //     reuseExistingServer: true,
  //   },
  // ],
  
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});