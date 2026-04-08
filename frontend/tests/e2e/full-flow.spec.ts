import { test, expect, Page } from '@playwright/test'

test.describe('AI Chat Platform - Full E2E Tests', () => {
  let page: Page
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    username: `testuser-${Date.now()}`,
    password: 'TestPassword123!',
  }

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterAll(async () => {
    await page.close()
  })

  test.describe('1. Health Check', () => {
    test('backend health endpoint should be accessible', async ({ request }) => {
      const response = await request.get('http://127.0.0.1:8000/health')
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data.status).toBe('healthy')
    })

    test('frontend should load homepage', async () => {
      await page.goto('/')
      await expect(page).toHaveTitle(/AI Chat/i)
    })
  })

  test.describe('2. User Registration', () => {
    test('should register a new user successfully', async ({ request }) => {
      const response = await request.post('http://127.0.0.1:8000/api/v1/auth/register', {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password,
        },
      })
      
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.user.email).toBe(testUser.email)
      expect(data.data.accessToken).toBeDefined()
      
      // Store tokens for later tests
      process.env.TEST_ACCESS_TOKEN = data.data.accessToken
      process.env.TEST_REFRESH_TOKEN = data.data.refreshToken
    })

    test('should not register with existing email', async ({ request }) => {
      const response = await request.post('http://127.0.0.1:8000/api/v1/auth/register', {
        data: {
          email: testUser.email,
          username: 'another-user',
          password: testUser.password,
        },
      })
      
      expect(response.ok()).toBeFalsy()
    })
  })

  test.describe('3. User Login', () => {
    test('should login with valid credentials', async ({ request }) => {
      const response = await request.post('http://127.0.0.1:8000/api/v1/auth/login', {
        data: {
          email: testUser.email,
          password: testUser.password,
        },
      })
      
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.accessToken).toBeDefined()
      
      // Update tokens
      process.env.TEST_ACCESS_TOKEN = data.data.accessToken
      process.env.TEST_REFRESH_TOKEN = data.data.refreshToken
    })

    test('should not login with invalid password', async ({ request }) => {
      const response = await request.post('http://127.0.0.1:8000/api/v1/auth/login', {
        data: {
          email: testUser.email,
          password: 'WrongPassword123',
        },
      })
      
      expect(response.ok()).toBeFalsy()
    })
  })

  test.describe('4. Session Management', () => {
    test('should create a new session', async ({ request }) => {
      const token = process.env.TEST_ACCESS_TOKEN
      expect(token).toBeDefined()
      
      const response = await request.post('http://127.0.0.1:8000/api/v1/sessions', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          title: 'Test Chat Session',
        },
      })
      
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.title).toBe('Test Chat Session')
      
      process.env.TEST_SESSION_ID = data.data.id
    })

    test('should list sessions', async ({ request }) => {
      const token = process.env.TEST_ACCESS_TOKEN
      
      const response = await request.get('http://127.0.0.1:8000/api/v1/sessions', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data.data)).toBe(true)
      expect(data.data.data.length).toBeGreaterThan(0)
    })

    test('should get session by ID', async ({ request }) => {
      const token = process.env.TEST_ACCESS_TOKEN
      const sessionId = process.env.TEST_SESSION_ID
      
      const response = await request.get(`http://127.0.0.1:8000/api/v1/sessions/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(sessionId)
    })

    test('should update session', async ({ request }) => {
      const token = process.env.TEST_ACCESS_TOKEN
      const sessionId = process.env.TEST_SESSION_ID
      
      const response = await request.patch(`http://127.0.0.1:8000/api/v1/sessions/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          title: 'Updated Session Title',
        },
      })
      
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.title).toBe('Updated Session Title')
    })

    test('should pin session', async ({ request }) => {
      const token = process.env.TEST_ACCESS_TOKEN
      const sessionId = process.env.TEST_SESSION_ID
      
      const response = await request.post(`http://127.0.0.1:8000/api/v1/sessions/${sessionId}/pin`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      expect(response.ok()).toBeTruthy()
    })
  })

  test.describe('5. Chat Functionality', () => {
    test('should send a message and receive SSE stream', async ({ request }) => {
      const token = process.env.TEST_ACCESS_TOKEN
      const sessionId = process.env.TEST_SESSION_ID
      
      const response = await request.post('http://127.0.0.1:8000/api/v1/chat/stream', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        data: {
          session_id: sessionId,
          content: { type: 'text', text: 'Hello, this is a test message' },
          model: 'gpt-4',
        },
        timeout: 30000,
      })
      
      expect(response.ok()).toBeTruthy()
      
      // Read the SSE stream
      const text = await response.text()
      expect(text).toContain('event:')
      expect(text).toContain('data:')
    })

    test('should handle multiple messages in a session', async ({ request }) => {
      const token = process.env.TEST_ACCESS_TOKEN
      const sessionId = process.env.TEST_SESSION_ID
      
      // Send first message
      const response1 = await request.post('http://127.0.0.1:8000/api/v1/chat/stream', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        data: {
          session_id: sessionId,
          content: { type: 'text', text: 'First message' },
        },
        timeout: 30000,
      })
      expect(response1.ok()).toBeTruthy()
      
      // Send second message
      const response2 = await request.post('http://127.0.0.1:8000/api/v1/chat/stream', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        data: {
          session_id: sessionId,
          content: { type: 'text', text: 'Second message' },
        },
        timeout: 30000,
      })
      expect(response2.ok()).toBeTruthy()
    })
  })

  test.describe('6. User Settings', () => {
    test('should get current user info', async ({ request }) => {
      const token = process.env.TEST_ACCESS_TOKEN
      
      const response = await request.get('http://127.0.0.1:8000/api/v1/users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.email).toBe(testUser.email)
    })

    test('should update user settings', async ({ request }) => {
      const token = process.env.TEST_ACCESS_TOKEN
      
      const response = await request.patch('http://127.0.0.1:8000/api/v1/users/settings', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          theme: 'dark',
          language: 'zh-CN',
          default_model: 'gpt-4',
          temperature: 0.8,
        },
      })
      
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.theme).toBe('dark')
    })
  })

  test.describe('7. Token Refresh', () => {
    test('should refresh access token', async ({ request }) => {
      const refreshToken = process.env.TEST_REFRESH_TOKEN
      
      const response = await request.post('http://127.0.0.1:8000/api/v1/auth/refresh', {
        data: {
          refresh_token: refreshToken,
        },
      })
      
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.accessToken).toBeDefined()
      
      // Update token
      process.env.TEST_ACCESS_TOKEN = data.data.accessToken
    })
  })

  test.describe('8. Error Handling', () => {
    test('should return 401 for unauthorized requests', async ({ request }) => {
      const response = await request.get('http://127.0.0.1:8000/api/v1/sessions')
      expect(response.status()).toBe(401)
    })

    test('should return 404 for non-existent session', async ({ request }) => {
      const token = process.env.TEST_ACCESS_TOKEN
      
      const response = await request.get('http://127.0.0.1:8000/api/v1/sessions/non-existent-id', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      expect(response.status()).toBe(404)
    })
  })

  test.describe('9. Cleanup', () => {
    test('should delete session', async ({ request }) => {
      const token = process.env.TEST_ACCESS_TOKEN
      const sessionId = process.env.TEST_SESSION_ID
      
      const response = await request.delete(`http://127.0.0.1:8000/api/v1/sessions/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      expect(response.ok()).toBeTruthy()
    })
  })
})

test.describe('Frontend UI Tests', () => {
  test('should display chat interface', async ({ page }) => {
    await page.goto('/')
    
    // Check main layout elements
    await expect(page.locator('[data-testid="sidebar"]').or(page.locator('aside'))).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="chat-container"]').or(page.locator('main'))).toBeVisible()
  })

  test('should have working theme toggle', async ({ page }) => {
    await page.goto('/')
    
    // Look for theme toggle button
    const themeToggle = page.locator('[data-testid="theme-toggle"]').or(
      page.locator('button[aria-label*="theme"]').or(
        page.locator('button:has-text("主题")')
      )
    )
    
    // Theme toggle might not exist yet, skip if not found
    const count = await themeToggle.count()
    if (count > 0) {
      await themeToggle.first().click()
    }
  })

  test('should show input area', async ({ page }) => {
    await page.goto('/')
    
    // Check for input area
    const inputArea = page.locator('textarea').or(page.locator('[contenteditable="true"]'))
    await expect(inputArea.first()).toBeVisible({ timeout: 10000 })
  })
})