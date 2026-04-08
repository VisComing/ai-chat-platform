import { test, expect } from '@playwright/test'

const API_URL = 'http://127.0.0.1:8001/api/v1'

test.describe('Backend API Tests', () => {
  
  test('health check', async ({ request }) => {
    const response = await request.get('http://127.0.0.1:8001/health')
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.status).toBe('healthy')
  })

  test('register user', async ({ request }) => {
    const timestamp = Date.now()
    const response = await request.post(`${API_URL}/auth/register`, {
      data: {
        email: `test-${timestamp}@example.com`,
        username: `user${timestamp}`,
        password: 'TestPassword123!'
      }
    })
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.accessToken).toBeDefined()
  })
})

test.describe('Frontend UI Tests', () => {
  
  test('homepage loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/AI Chat|对话/i)
  })

  test('input area visible', async ({ page }) => {
    await page.goto('/')
    // Wait for page to load
    await page.waitForTimeout(2000)
    // Check for textarea or input
    const input = page.locator('textarea').first()
    await expect(input).toBeVisible({ timeout: 10000 })
  })
})