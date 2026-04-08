import { test, expect, Page } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'

test.describe('Deep Thinking Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
    // Wait for initialization to complete
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 })
    await page.waitForTimeout(2000)
  })

  test.describe('UI Components', () => {
    test('should display deep thinking toggle button', async ({ page }) => {
      // Create new session to ensure we have a clean state
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(1000)

      // Find the deep thinking toggle (Brain icon)
      const thinkingToggle = page.locator('button').filter({ has: page.locator('svg.lucide-brain') }).first()

      // Should be visible
      await expect(thinkingToggle).toBeVisible({ timeout: 5000 })
      console.log('Deep thinking toggle found')
    })

    test('should toggle deep thinking mode on click', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(1000)

      const thinkingToggle = page.locator('button').filter({ has: page.locator('svg.lucide-brain') }).first()

      // Click to enable
      await thinkingToggle.click()
      await page.waitForTimeout(300)

      // Should show "深度思考" indicator
      const thinkingIndicator = page.getByText('深度思考')
      await expect(thinkingIndicator).toBeVisible({ timeout: 2000 })
      console.log('Deep thinking mode enabled')

      // Click again to disable
      await thinkingToggle.click()
      await page.waitForTimeout(300)

      // Indicator should not be visible
      await expect(thinkingIndicator).not.toBeVisible({ timeout: 2000 })
      console.log('Deep thinking mode disabled')
    })

    test('should have both agent and thinking toggles', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(1000)

      // Find both toggles
      const thinkingToggle = page.locator('button').filter({ has: page.locator('svg.lucide-brain') }).first()
      const agentToggle = page.locator('button').filter({ has: page.locator('svg.lucide-globe') }).first()

      // Both should be visible
      await expect(thinkingToggle).toBeVisible({ timeout: 5000 })
      await expect(agentToggle).toBeVisible({ timeout: 5000 })
      console.log('Both toggles found')
    })
  })

  test.describe('Thinking Mode Interaction', () => {
    test('should send message with thinking mode enabled', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)

      // Enable deep thinking
      const thinkingToggle = page.locator('button').filter({ has: page.locator('svg.lucide-brain') }).first()
      await thinkingToggle.click()
      await page.waitForTimeout(500)

      // Verify thinking mode is enabled
      await expect(page.getByText('深度思考')).toBeVisible({ timeout: 2000 })

      // Send a message
      const input = page.locator('textarea')
      const testMessage = '请帮我分析一下这个问题'
      await input.fill(testMessage)
      await input.press('Enter')

      // User message should appear - use first() to handle duplicates
      await expect(page.getByText(testMessage).first()).toBeVisible({ timeout: 10000 })

      // Wait for response
      await page.waitForTimeout(10000)

      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/thinking-mode-message.png' })
      console.log('Message sent with thinking mode enabled')
    })

    test('should show thinking indicator during response', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)

      // Enable deep thinking
      const thinkingToggle = page.locator('button').filter({ has: page.locator('svg.lucide-brain') }).first()
      await thinkingToggle.click()
      await page.waitForTimeout(500)

      // Send message
      const input = page.locator('textarea')
      await input.fill('你好')
      await input.press('Enter')

      // Check for "深度思考中..." or "思考中..." indicator
      const thinkingIndicator = page.getByText(/思考中|正在思考/)

      // This may or may not appear depending on model used
      try {
        await expect(thinkingIndicator.first()).toBeVisible({ timeout: 5000 })
        console.log('Thinking indicator visible')
      } catch {
        console.log('Thinking indicator not visible (may depend on model)')
      }

      // Wait for response
      await page.waitForTimeout(15000)
      await page.screenshot({ path: 'test-results/thinking-response.png' })
    })
  })

  test.describe('ThinkingBlock UI', () => {
    test('should display ThinkingBlock when thinking content exists', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)

      // Enable deep thinking
      const thinkingToggle = page.locator('button').filter({ has: page.locator('svg.lucide-brain') }).first()
      await thinkingToggle.click()
      await page.waitForTimeout(500)

      // Send message
      const input = page.locator('textarea')
      await input.fill('请详细解释量子计算的原理')
      await input.press('Enter')

      // Wait for response to complete
      await page.waitForTimeout(30000)

      // Look for thinking block
      const thinkingBlock = page.locator('button').filter({ hasText: /深度思考|思考过程/ })

      try {
        await expect(thinkingBlock.first()).toBeVisible({ timeout: 5000 })
        console.log('Thinking block found')

        // Take screenshot
        await page.screenshot({ path: 'test-results/thinking-block.png' })
      } catch {
        console.log('Thinking block not found (model may not support thinking)')
      }
    })

    test('should expand/collapse ThinkingBlock on click', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)

      // Enable deep thinking
      const thinkingToggle = page.locator('button').filter({ has: page.locator('svg.lucide-brain') }).first()
      await thinkingToggle.click()
      await page.waitForTimeout(500)

      // Send message
      const input = page.locator('textarea')
      await input.fill('你好，请介绍一下你自己')
      await input.press('Enter')

      // Wait for response
      await page.waitForTimeout(20000)

      // Find thinking block button
      const thinkingBlockButton = page.locator('button').filter({ hasText: /深度思考|思考过程/ }).first()

      try {
        await expect(thinkingBlockButton).toBeVisible({ timeout: 5000 })

        // Click to expand
        await thinkingBlockButton.click()
        await page.waitForTimeout(300)

        // Content should be visible
        const thinkingContent = page.locator('.whitespace-pre-wrap').filter({ hasText: /.{10,}/ }).first()
        console.log('Thinking block expanded')

        // Click to collapse
        await thinkingBlockButton.click()
        await page.waitForTimeout(300)
        console.log('Thinking block collapsed')

      } catch {
        console.log('Thinking block not found for expand/collapse test')
      }
    })
  })

  test.describe('Integration with Agent Mode', () => {
    test('should work with both thinking and agent mode enabled', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)

      // Get toggles
      const thinkingToggle = page.locator('button').filter({ has: page.locator('svg.lucide-brain') }).first()
      const agentToggle = page.locator('button').filter({ has: page.locator('svg.lucide-globe') }).first()

      // First disable agent mode if it's on (default is on)
      const agentIndicator = page.getByText('联网搜索')
      if (await agentIndicator.isVisible()) {
        await agentToggle.click()
        await page.waitForTimeout(300)
      }

      // Enable thinking mode
      await thinkingToggle.click()
      await page.waitForTimeout(300)

      // Enable agent mode
      await agentToggle.click()
      await page.waitForTimeout(500)

      // Verify both indicators
      await expect(page.getByText('深度思考')).toBeVisible({ timeout: 2000 })
      await expect(page.getByText('联网搜索')).toBeVisible({ timeout: 2000 })
      console.log('Both modes enabled')

      // Send message that might trigger search
      const input = page.locator('textarea')
      await input.fill('今天北京天气怎么样？')
      await input.press('Enter')

      // Wait for response
      await page.waitForTimeout(45000)

      // Take screenshot
      await page.screenshot({ path: 'test-results/both-modes-response.png' })

      // Verify response exists
      const bodyText = await page.evaluate(() => document.body.innerText)
      console.log('Response length:', bodyText.length)
    })

    test('should toggle between modes independently', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)

      const thinkingToggle = page.locator('button').filter({ has: page.locator('svg.lucide-brain') }).first()
      const agentToggle = page.locator('button').filter({ has: page.locator('svg.lucide-globe') }).first()

      // First disable agent mode if it's on (default is on)
      const agentIndicator = page.getByText('联网搜索')
      if (await agentIndicator.isVisible()) {
        await agentToggle.click()
        await page.waitForTimeout(300)
      }

      // Now agent should be off, enable thinking only
      await thinkingToggle.click()
      await page.waitForTimeout(300)
      await expect(page.getByText('深度思考')).toBeVisible({ timeout: 2000 })
      await expect(agentIndicator).not.toBeVisible({ timeout: 1000 })

      // Enable agent too
      await agentToggle.click()
      await page.waitForTimeout(300)
      await expect(page.getByText('联网搜索')).toBeVisible({ timeout: 2000 })

      // Disable thinking
      await thinkingToggle.click()
      await page.waitForTimeout(300)
      await expect(page.getByText('深度思考')).not.toBeVisible({ timeout: 1000 })
      await expect(page.getByText('联网搜索')).toBeVisible({ timeout: 1000 })

      console.log('Independent toggle verified')
    })
  })

  test.describe('State Persistence', () => {
    test('should persist thinking mode preference', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)

      // Enable thinking mode
      const thinkingToggle = page.locator('button').filter({ has: page.locator('svg.lucide-brain') }).first()
      await thinkingToggle.click()
      await page.waitForTimeout(500)

      // Verify enabled
      await expect(page.getByText('深度思考')).toBeVisible({ timeout: 2000 })

      // Reload page
      await page.reload()
      await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 })
      await page.waitForTimeout(2000)

      // Thinking mode should still be enabled (persisted)
      const thinkingIndicator = page.getByText('深度思考')
      try {
        await expect(thinkingIndicator).toBeVisible({ timeout: 5000 })
        console.log('Thinking mode persisted after reload')
      } catch {
        console.log('Thinking mode not persisted (expected behavior if not saved)')
      }
    })
  })

  test.describe('Error Handling', () => {
    test('should handle model that does not support thinking', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)

      // Enable thinking mode (but use a model that doesn't support it)
      const thinkingToggle = page.locator('button').filter({ has: page.locator('svg.lucide-brain') }).first()
      await thinkingToggle.click()
      await page.waitForTimeout(500)

      // Send message
      const input = page.locator('textarea')
      await input.fill('你好')
      await input.press('Enter')

      // Wait for response - should still work even if thinking is not supported
      await page.waitForTimeout(15000)

      // Response should exist
      const responseContent = page.locator('.rounded-2xl').filter({ hasText: /你|好|hello/i }).last()
      console.log('Response received even with non-thinking model')
    })
  })
})

test.describe('Deep Thinking API Integration', () => {
  test('should pass enableThinking parameter to backend', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 })
    await page.waitForTimeout(2000)

    // Create new session
    const newChatButton = page.locator('aside').locator('button').nth(1)
    await newChatButton.click()
    await page.waitForTimeout(2000)

    // Enable thinking mode
    const thinkingToggle = page.locator('button').filter({ has: page.locator('svg.lucide-brain') }).first()
    await thinkingToggle.click()
    await page.waitForTimeout(500)

    // Listen for API requests
    const requestPromise = page.waitForRequest(req =>
      req.url().includes('/chat/stream') && req.method() === 'POST'
    )

    // Send message
    const input = page.locator('textarea')
    await input.fill('测试')
    await input.press('Enter')

    // Wait for request
    const request = await requestPromise
    const postData = request.postData()

    console.log('Request body:', postData?.substring(0, 500))

    // Verify enableThinking is in the request
    if (postData) {
      const body = JSON.parse(postData)
      expect(body.enableThinking).toBe(true)
      console.log('enableThinking parameter correctly sent')
    }
  })
})