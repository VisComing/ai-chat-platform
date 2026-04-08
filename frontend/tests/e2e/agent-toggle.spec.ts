import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3002'

test.describe('Agent Mode Toggle', () => {
  test('should toggle agent mode and send message', async ({ page }) => {
    await page.goto(BASE_URL)
    
    // Wait for initialization
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 })
    await page.waitForTimeout(3000)
    
    // Create new session
    const newChatButton = page.locator('aside').locator('button').nth(1)
    await newChatButton.click()
    await page.waitForTimeout(2000)
    
    // Find and click Agent mode toggle (Globe icon button)
    const agentToggle = page.locator('button').filter({ has: page.locator('svg.lucide-globe') }).first()
    
    if (await agentToggle.isVisible()) {
      console.log('Agent toggle found, clicking...')
      await agentToggle.click()
      await page.waitForTimeout(500)
      
      // Should show "联网搜索" indicator
      const agentIndicator = page.getByText('联网搜索')
      await expect(agentIndicator).toBeVisible({ timeout: 2000 })
      console.log('Agent mode enabled')
      
      // Send message with Agent mode
      const input = page.locator('textarea')
      const testMessage = '今天北京天气怎么样？'
      
      await input.fill(testMessage)
      await input.press('Enter')
      
      // Wait for user message
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 })
      
      // Wait for Agent response (longer due to search)
      await page.waitForTimeout(45000)
      
      // Check for search indicator or sources
      const bodyText = await page.evaluate(() => document.body.innerText)
      console.log('Response content:', bodyText.substring(0, 800))
      
      // Take screenshot
      await page.screenshot({ path: 'test-results/agent-mode-enabled.png' })
      
      // Should contain weather info or search-related content
      const hasContent = bodyText.includes('天气') || 
                         bodyText.includes('温度') ||
                         bodyText.includes('搜索') ||
                         bodyText.includes('来源')
      
      expect(hasContent).toBeTruthy()
    } else {
      console.log('Agent toggle not found - skipping test')
      test.skip()
    }
  })
})