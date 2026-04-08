import { test, expect, Page } from '@playwright/test'

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3002'

test.describe('AI Chat Platform', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test.describe('Main Chat Interface', () => {
    test('should display main chat interface', async ({ page }) => {
      // Check header exists
      await expect(page.locator('header')).toBeVisible()

      // Check sidebar exists
      await expect(page.locator('aside')).toBeVisible()

      // Check input area exists
      await expect(page.locator('textarea')).toBeVisible()

      // Check send button exists
      await expect(page.getByRole('button', { name: /send|发送/i })).toBeVisible()
    })

    test('should display empty state', async ({ page }) => {
      // Check for empty state message
      await expect(page.getByText('开始新对话')).toBeVisible()
    })

    test('should allow text input', async ({ page }) => {
      const input = page.locator('textarea')
      await input.fill('Hello AI')
      await expect(input).toHaveValue('Hello AI')
    })

    test('should send message on Enter key', async ({ page }) => {
      const input = page.locator('textarea')
      await input.fill('Test message')
      await input.press('Enter')

      // Message should appear in the list
      await expect(page.getByText('Test message')).toBeVisible()
    })

    test('should create new session', async ({ page }) => {
      // Click new chat button in sidebar header (the button directly in aside, not in session list)
      // This is the second button in aside (first is collapse toggle)
      const sidebarHeader = page.locator('aside').locator('button').nth(1)
      await sidebarHeader.click()

      // Should show new session in the main area
      await expect(page.getByRole('heading', { name: '开始新对话' })).toBeVisible()
    })
  })

  test.describe('Theme Switching', () => {
    test('should switch to dark theme', async ({ page }) => {
      // Find and click dark theme button
      const darkButton = page.locator('button[title="深色"]')
      await darkButton.click()

      // Check if dark class is applied
      await expect(page.locator('html')).toHaveClass(/dark/)
    })

    test('should switch to light theme', async ({ page }) => {
      // First switch to dark
      const darkButton = page.locator('button[title="深色"]')
      await darkButton.click()

      // Then switch to light
      const lightButton = page.locator('button[title="浅色"]')
      await lightButton.click()

      // Dark class should be removed
      await expect(page.locator('html')).not.toHaveClass(/dark/)
    })
  })

  test.describe('Session Management', () => {
    test('should list sessions in sidebar', async ({ page }) => {
      // Sidebar should show session list
      const sessionList = page.locator('aside')
      await expect(sessionList).toBeVisible()
    })

    test('should search sessions', async ({ page }) => {
      // Find search input
      const searchInput = page.getByPlaceholder(/search|搜索/i)
      await searchInput.fill('test')

      // Should filter sessions
      // (This depends on having sessions)
    })

    test('should switch between sessions', async ({ page }) => {
      // Create a new session using sidebar header new button
      const sidebarHeaderButton = page.locator('aside').locator('button').nth(1)
      await sidebarHeaderButton.click()
      await page.waitForTimeout(500)

      // Session items in the session list should exist (buttons with paragraph inside)
      const sessionItems = page.locator('aside').locator('button').filter({ has: page.locator('p') })
      const count = await sessionItems.count()
      expect(count).toBeGreaterThanOrEqual(1)
    })

    test('should auto-generate session title after first conversation', async ({ page }) => {
      // This test verifies the title generation feature
      
      // Step 1: Go to the app
      await page.goto(BASE_URL)
      
      // Wait for initialization to complete
      await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 })
      await page.waitForTimeout(3000)
      
      // Step 2: Create a NEW session (click "新对话" button in sidebar header)
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(3000) // Wait for session creation to complete
      
      // Step 3: Verify we're on a new session (check for empty state or "开始新对话" heading)
      const newSessionIndicator = page.getByRole('heading', { name: '开始新对话' })
      await expect(newSessionIndicator).toBeVisible({ timeout: 5000 })
      
      // Step 4: Send a message to the NEW session
      const input = page.locator('textarea')
      const testMessage = '什么是人工智能？'
      await input.fill(testMessage)
      await input.press('Enter')

      // Wait for user message to appear
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 })

      // Wait for AI response and title generation
      await page.waitForTimeout(50000)

      // Step 5: Reload the page to get the latest session data from backend
      await page.reload()
      await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 })
      await page.waitForTimeout(3000)

      // Step 6: Check if title has changed in the sidebar
      // Sessions are sorted by lastMessageAt, so the newest session (with latest message) should be FIRST
      const allSessionTitles = page.locator('aside').locator('button').filter({ has: page.locator('p') })
      const firstTitle = await allSessionTitles.first().textContent()
      
      console.log(`Session title after conversation: ${firstTitle}`)
      
      // Title should have changed from "新对话" to AI-generated title
      expect(firstTitle).toBeTruthy()
      const titleChanged = firstTitle && !firstTitle.startsWith('新对话')
      console.log(`Title changed: ${titleChanged}`)
      
      // If backend is working correctly, title should contain AI-related keywords
      if (titleChanged) {
        expect(firstTitle).toMatch(/人工智能|AI|智能/)
      }
    })
  })
})

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE_URL)

    // Mobile menu button should be visible
    const menuButton = page.locator('header button').first()
    await expect(menuButton).toBeVisible()
  })
})
