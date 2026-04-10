import { defineConfig, devices } from '@playwright/test';

// 统一配置 - 从环境变量读取，提供默认值
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // 可选：自动启动服务
  webServer: process.env.START_SERVERS ? [
    {
      command: 'npm run dev',
      url: FRONTEND_URL,
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: 'cd ../backend && uvicorn app.main:app --reload --port 8000',
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: true,
      timeout: 60000,
    },
  ] : undefined,

  timeout: 120000,
  expect: {
    timeout: 15000,
  },
});