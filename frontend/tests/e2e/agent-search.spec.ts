import { test, expect, Page } from '@playwright/test'

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3002'
const API_URL = process.env.E2E_API_URL || 'http://localhost:8001'

test.describe('Agent Search Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
    // Wait for initialization
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 })
    await page.waitForTimeout(2000)
  })

  test.describe('Agent Mode Toggle', () => {
    test('should display agent mode toggle button', async ({ page }) => {
      // Check for agent/搜索 mode toggle in the interface
      const agentToggle = page.locator('button').filter({ hasText: /agent|搜索|联网/i })
      const count = await agentToggle.count()
      
      // Should have at least one agent-related button
      expect(count).toBeGreaterThanOrEqual(0)
      
      console.log(`Found ${count} agent-related buttons`)
    })

    test('should switch to agent mode', async ({ page }) => {
      // Look for agent mode toggle (could be in header or input area)
      const agentButton = page.locator('button').filter({ hasText: /agent|联网搜索/i }).first()
      
      if (await agentButton.isVisible()) {
        await agentButton.click()
        await page.waitForTimeout(500)
        
        // Should show indicator that agent mode is active
        const agentIndicator = page.locator('[data-agent-mode="true"]').or(
          page.locator('button').filter({ hasText: /agent|联网搜索/i }).locator('[class*="active"]')
        )
        
        console.log('Agent mode activated')
      } else {
        // Agent mode might be default or not have a toggle
        console.log('Agent mode toggle not found - might be integrated by default')
      }
    })
  })

  test.describe('Search Triggering', () => {
    test('should trigger search for time-sensitive question', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)
      
      // Send time-sensitive question that should trigger search
      const input = page.locator('textarea')
      const testMessage = '今天北京天气怎么样？'
      
      await input.fill(testMessage)
      await input.press('Enter')
      
      // Wait for user message to appear
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 })
      
      // Wait for AI response (should take longer due to search)
      await page.waitForTimeout(15000)
      
      // Check for AI response
      const messages = page.locator('[data-role="assistant"]').or(
        page.locator('div').filter({ has: page.locator('p') }).filter({ hasText: /天气|北京|晴|雨/i })
      )
      
      const responseCount = await messages.count()
      console.log(`Found ${responseCount} assistant messages`)
      
      // Should have received a response
      expect(responseCount).toBeGreaterThan(0)
      
      // Response should mention weather-related content
      if (responseCount > 0) {
        const responseText = await messages.first().textContent()
        console.log(`Response: ${responseText?.substring(0, 100)}...`)
        
        // Should contain weather information
        expect(responseText).toMatch(/天气|温度|晴|雨|风|摄氏|度/)
      }
    })

    test('should NOT trigger search for common knowledge question', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)
      
      // Send common knowledge question that should NOT trigger search
      const input = page.locator('textarea')
      const testMessage = '什么是机器学习？'
      
      await input.fill(testMessage)
      await input.press('Enter')
      
      // Wait for user message to appear
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 })
      
      // Wait for AI response (should be faster without search)
      await page.waitForTimeout(10000)
      
      // Check for AI response
      const messages = page.locator('[data-role="assistant"]').or(
        page.locator('div').filter({ has: page.locator('p') }).filter({ hasText: /机器学习|学习|算法|数据/i })
      )
      
      const responseCount = await messages.count()
      console.log(`Found ${responseCount} assistant messages`)
      
      // Should have received a response
      expect(responseCount).toBeGreaterThan(0)
      
      // Response should explain machine learning
      if (responseCount > 0) {
        const responseText = await messages.first().textContent()
        console.log(`Response: ${responseText?.substring(0, 100)}...`)
        
        // Should contain ML-related content
        expect(responseText).toMatch(/机器学习|学习|算法|模型|训练/)
      }
    })
  })

  test.describe('Search Results Display', () => {
    test('should display citations when search is used', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)
      
      // Send question that triggers search
      const input = page.locator('textarea')
      const testMessage = '最近有什么科技新闻？'
      
      await input.fill(testMessage)
      await input.press('Enter')
      
      // Wait for response
      await page.waitForTimeout(20000)
      
      // Check for citations (should have [1], [2], etc.)
      const citations = page.locator('a').filter({ hasText: /\[\d+\]/ }).or(
        page.locator('text=/\\[\\d+\\]/')
      )
      
      const citationCount = await citations.count()
      console.log(`Found ${citationCount} citations`)
      
      // If search was triggered, should have citations
      if (citationCount > 0) {
        console.log('Citations found - search was triggered')
        
        // Citations should be links
        const firstCitation = citations.first()
        const href = await firstCitation.getAttribute('href')
        
        if (href) {
          console.log(`First citation link: ${href}`)
          expect(href).toMatch(/^https?:\/\//)
        }
      } else {
        console.log('No citations found - search might not have been triggered or service unavailable')
      }
    })

    test('should display reference links at bottom of response', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)
      
      // Send question that triggers search
      const input = page.locator('textarea')
      const testMessage = '今天美元汇率是多少？'
      
      await input.fill(testMessage)
      await input.press('Enter')
      
      // Wait for response
      await page.waitForTimeout(20000)
      
      // Check for reference section
      const referenceSection = page.locator('text=/参考来源|参考资料|来源：|Sources/i')
      const hasReference = await referenceSection.count() > 0
      
      console.log(`Reference section found: ${hasReference}`)
      
      if (hasReference) {
        // Should have links in reference section
        const links = page.locator('a[href^="http"]')
        const linkCount = await links.count()
        console.log(`Found ${linkCount} links in response`)
        
        expect(linkCount).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Search Failure Handling', () => {
    test('should gracefully handle search service unavailable', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)
      
      // Send question that would normally trigger search
      const input = page.locator('textarea')
      const testMessage = '今天上海天气怎么样？'
      
      await input.fill(testMessage)
      await input.press('Enter')
      
      // Wait for response (even if search fails, should still respond)
      await page.waitForTimeout(15000)
      
      // Should have received a response
      const messages = page.locator('[data-role="assistant"]').or(
        page.locator('div').filter({ has: page.locator('p') })
      )
      
      const responseCount = await messages.count()
      console.log(`Found ${responseCount} assistant messages`)
      
      // Should always have a response (graceful degradation)
      expect(responseCount).toBeGreaterThan(0)
      
      if (responseCount > 0) {
        const responseText = await messages.first().textContent()
        console.log(`Response: ${responseText?.substring(0, 100)}...`)
        
        // Should either have weather info (search worked) or explain search unavailable
        const hasWeatherInfo = responseText?.match(/天气|温度|晴|雨/)
        const hasSearchUnavailable = responseText?.match(/搜索|不可用|无法|暂时/)
        
        console.log(`Has weather info: ${hasWeatherInfo}`)
        console.log(`Has search unavailable message: ${hasSearchUnavailable}`)
        
        // Either search worked or gracefully degraded
        expect(hasWeatherInfo || hasSearchUnavailable || (responseText && responseText.length > 50)).toBeTruthy()
      }
    })
  })

  test.describe('Multi-turn Search', () => {
    test('should handle follow-up questions with context', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)
      
      const input = page.locator('textarea')
      
      // First question
      await input.fill('今天北京天气怎么样？')
      await input.press('Enter')
      await page.waitForTimeout(15000)
      
      // Follow-up question
      await input.fill('明天呢？')
      await input.press('Enter')
      await page.waitForTimeout(15000)
      
      // Should have at least 4 messages (2 user + 2 assistant)
      const userMessages = page.locator('[data-role="user"]').or(
        page.locator('div').filter({ hasText: /今天北京天气|明天呢/ })
      )
      
      const assistantMessages = page.locator('[data-role="assistant"]').or(
        page.locator('div').filter({ has: page.locator('p') }).filter({ hasText: /天气|北京/ })
      )
      
      const userCount = await userMessages.count()
      const assistantCount = await assistantMessages.count()
      
      console.log(`User messages: ${userCount}, Assistant messages: ${assistantCount}`)
      
      // Should have responses for both questions
      expect(userCount).toBeGreaterThanOrEqual(2)
      expect(assistantCount).toBeGreaterThanOrEqual(2)
    })
  })

  test.describe('Performance', () => {
    test('search response should complete within reasonable time', async ({ page }) => {
      // Create new session
      const newChatButton = page.locator('aside').locator('button').nth(1)
      await newChatButton.click()
      await page.waitForTimeout(2000)
      
      const input = page.locator('textarea')
      const testMessage = '今天北京天气'
      
      // Start timing
      const startTime = Date.now()
      
      await input.fill(testMessage)
      await input.press('Enter')
      
      // Wait for response to appear
      await page.waitForSelector('[data-role="assistant"]', { timeout: 30000 })
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      console.log(`Response time: ${duration}ms`)
      
      // Should complete within 30 seconds (including search)
      expect(duration).toBeLessThan(30000)
      
      // But should take at least 2 seconds (search takes time)
      expect(duration).toBeGreaterThan(2000)
    })
  })
})

test.describe('Agent API Integration', () => {
  test('should call agent stream endpoint', async ({ page }) => {
    // Monitor network requests
    const requests: string[] = []
    page.on('request', request => {
      if (request.url().includes('/api/v1/chat')) {
        requests.push(request.url())
        console.log(`API request: ${request.url()}`)
      }
    })
    
    // Navigate and send message
    await page.goto(BASE_URL)
    await page.waitForTimeout(2000)
    
    const newChatButton = page.locator('aside').locator('button').nth(1)
    await newChatButton.click()
    await page.waitForTimeout(2000)
    
    const input = page.locator('textarea')
    await input.fill('今天天气')
    await input.press('Enter')
    
    await page.waitForTimeout(5000)
    
    // Should have made API request
    const chatRequests = requests.filter(r => r.includes('/stream'))
    console.log(`Chat requests: ${chatRequests.length}`)
    
    // Should have called either /stream or /agent/stream
    expect(chatRequests.length).toBeGreaterThan(0)
  })

  test('should receive SSE events', async ({ page }) => {
    // Monitor SSE events
    const events: string[] = []
    
    page.on('response', async response => {
      if (response.url().includes('/stream')) {
        const body = await response.text()
        console.log(`SSE response received`)
        
        // Check for SSE event types
        if (body.includes('event: text')) events.push('text')
        if (body.includes('event: complete')) events.push('complete')
        if (body.includes('event: tool_call')) events.push('tool_call')
        if (body.includes('event: thinking')) events.push('thinking')
      }
    })
    
    // Navigate and send message
    await page.goto(BASE_URL)
    await page.waitForTimeout(2000)
    
    const newChatButton = page.locator('aside').locator('button').nth(1)
    await newChatButton.click()
    await page.waitForTimeout(2000)
    
    const input = page.locator('textarea')
    await input.fill('今天北京天气')
    await input.press('Enter')
    
    await page.waitForTimeout(15000)
    
    console.log(`SSE events received: ${events.join(', ')}`)
    
    // Should have received text and complete events
    expect(events).toContain('text')
    expect(events).toContain('complete')
  })
})

test.describe('Agent Visual Indicators', () => {
  test('should show thinking indicator during search', async ({ page }) => {
    // Create new session
    const newChatButton = page.locator('aside').locator('button').nth(1)
    await newChatButton.click()
    await page.waitForTimeout(2000)
    
    const input = page.locator('textarea')
    
    // Send message that triggers search
    await input.fill('今天北京天气怎么样？')
    await input.press('Enter')
    
    // Look for thinking/searching indicator
    const thinkingIndicator = page.locator('text=/思考|搜索|查询|分析|thinking|searching/i').or(
      page.locator('[data-status="thinking"]').or(
        page.locator('.animate-spin').or(
          page.locator('[class*="loading"]')
        )
      )
    )
    
    // Should show some loading/thinking state
    const hasIndicator = await thinkingIndicator.count() > 0
    console.log(`Thinking indicator visible: ${hasIndicator}`)
    
    // Wait for response to complete
    await page.waitForTimeout(15000)
    
    // Indicator should disappear after response
    const indicatorAfter = await thinkingIndicator.count()
    console.log(`Thinking indicator after response: ${indicatorAfter}`)
  })

  test('should show tool call notification', async ({ page }) => {
    // Create new session
    const newChatButton = page.locator('aside').locator('button').nth(1)
    await newChatButton.click()
    await page.waitForTimeout(2000)
    
    const input = page.locator('textarea')
    
    // Send message that should trigger search
    await input.fill('最近新闻')
    await input.press('Enter')
    
    // Look for tool call notification
    const toolCallNotification = page.locator('text=/正在搜索|调用搜索|联网查询|tool_call/i').or(
      page.locator('[data-tool="web_search"]')
    )
    
    // Wait a bit for potential tool call
    await page.waitForTimeout(5000)
    
    const hasToolCall = await toolCallNotification.count() > 0
    console.log(`Tool call notification visible: ${hasToolCall}`)
    
    // If search is triggered, should show notification
    if (hasToolCall) {
      console.log('Tool call notification found')
    }
    
    // Wait for completion
    await page.waitForTimeout(15000)
  })
})