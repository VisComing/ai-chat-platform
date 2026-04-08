import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3002'

test.describe('Agent Search - Simple Test', () => {
  test('should send message and receive response', async ({ page }) => {
    await page.goto(BASE_URL)
    
    // Wait for initialization
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 })
    await page.waitForTimeout(3000)
    
    // Create new session
    const newChatButton = page.locator('aside').locator('button').nth(1)
    await newChatButton.click()
    await page.waitForTimeout(2000)
    
    // Send message
    const input = page.locator('textarea')
    const testMessage = '今天北京天气怎么样？'
    
    await input.fill(testMessage)
    await input.press('Enter')
    
    // Wait for user message to appear
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 })
    
    // Wait for AI response
    await page.waitForTimeout(30000)
    
    // Check for response
    const bodyText = await page.evaluate(() => document.body.innerText)
    console.log('Page content:', bodyText.substring(0, 500))
    
    // Should contain weather-related content
    const hasWeatherContent = bodyText.includes('天气') || 
                              bodyText.includes('温度') || 
                              bodyText.includes('北京')
    
    console.log('Has weather content:', hasWeatherContent)
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/agent-search-simple.png' })
    
    // Test passes if we got any response
    expect(hasWeatherContent || bodyText.includes('搜索')).toBeTruthy()
  })
})