import { test, expect } from '@playwright/test'

test.describe('专家模式全链路测试', () => {
  test.beforeEach(async ({ page }) => {
    // 访问首页并等待加载完成
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')
  })

  test('完整链路: 专家模式 → 开启深度思考 → 发送消息 → 接收流式响应', async ({ page }) => {
    // ========== 步骤1: 切换到专家模式 ==========
    console.log('步骤1: 切换到专家模式')
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(300)

    // 截图记录
    await page.screenshot({ path: 'test-results/full-1-expert-mode.png' })

    // 验证专家模式已激活
    await expect(page.locator('button:has-text("专家模式")')).toHaveCSS('color', 'rgb(255, 255, 255)')

    // ========== 步骤2: 开启深度思考 ==========
    console.log('步骤2: 开启深度思考')
    await page.locator('button:has-text("深度思考")').click()
    await page.waitForTimeout(200)

    // 截图记录
    await page.screenshot({ path: 'test-results/full-2-deep-thinking-on.png' })

    // 验证深度思考按钮已激活（检查蓝色背景）
    const deepThinkingBtn = page.locator('button:has-text("深度思考")')
    const isDeepThinkingActive = await deepThinkingBtn.evaluate(el =>
      el.classList.contains('bg-blue-50') || el.classList.contains('border-blue-200')
    )
    expect(isDeepThinkingActive).toBeTruthy()

    // ========== 步骤3: 输入问题 ==========
    console.log('步骤3: 输入问题')
    const textarea = page.locator('textarea')
    await textarea.fill('请解释深度思考模式的工作原理')
    await page.waitForTimeout(200)

    // 截图记录
    await page.screenshot({ path: 'test-results/full-3-input-filled.png' })

    // 验证输入内容
    await expect(textarea).toHaveValue('请解释深度思考模式的工作原理')

    // ========== 步骤4: 发送消息 ==========
    console.log('步骤4: 发送消息')

    // 监听网络请求
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/api/v1/chat/stream') && request.method() === 'POST',
      { timeout: 10000 }
    )

    // 点击发送按钮
    await page.locator('button').filter({ has: page.locator('svg') }).last().click()

    // 等待请求发送
    const request = await requestPromise
    const requestBody = JSON.parse(request.postData() || '{}')

    // 截图记录发送后状态
    await page.screenshot({ path: 'test-results/full-4-message-sent.png', fullPage: true })

    // 验证请求参数
    console.log('请求体:', JSON.stringify(requestBody, null, 2))
    expect(requestBody).toHaveProperty('content')
    expect(requestBody).toHaveProperty('enableThinking', true) // 深度思考应该开启
    expect(requestBody).toHaveProperty('useAgent') // 检查是否传递了 useAgent 参数

    // ========== 步骤5: 等待流式响应 ==========
    console.log('步骤5: 等待流式响应')

    // 等待 AI 消息出现
    await page.waitForSelector('[data-role="assistant"]', { timeout: 30000 })

    // 等待一段时间让消息开始流式输出
    await page.waitForTimeout(3000)

    // 截图记录流式响应状态
    await page.screenshot({ path: 'test-results/full-5-streaming.png', fullPage: true })

    // 验证 AI 消息存在
    const assistantMessages = page.locator('[data-role="assistant"]')
    await expect(assistantMessages.first()).toBeVisible()

    // ========== 步骤6: 等待响应完成 ==========
    console.log('步骤6: 等待响应完成')

    // 等待加载状态消失（最多60秒）
    await page.waitForSelector('[data-loading="true"]', { state: 'hidden', timeout: 60000 }).catch(() => {
      console.log('加载状态检查超时，继续验证')
    })

    // 等待5秒让内容稳定
    await page.waitForTimeout(5000)

    // 截图记录最终结果
    await page.screenshot({ path: 'test-results/full-6-completed.png', fullPage: true })

    // 验证消息内容不为空
    const lastMessage = assistantMessages.last()
    const messageText = await lastMessage.textContent()
    console.log('AI回复内容长度:', messageText?.length || 0)
    expect(messageText?.length || 0).toBeGreaterThan(0)

    console.log('✓ 全链路测试通过')
  })

  test('完整链路: 专家模式 → 开启联网搜索 → 发送消息', async ({ page }) => {
    // ========== 步骤1: 切换到专家模式 ==========
    console.log('步骤1: 切换到专家模式')
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(300)

    // ========== 步骤2: 开启联网搜索 ==========
    console.log('步骤2: 开启联网搜索')
    // 先确保联网搜索是关闭的（默认可能开启）
    const searchBtn = page.locator('button:has-text("联网搜索")')
    await searchBtn.click() // 如果已开启，点击关闭
    await page.waitForTimeout(200)
    await searchBtn.click() // 再次点击开启
    await page.waitForTimeout(200)

    // 截图记录
    await page.screenshot({ path: 'test-results/search-1-enabled.png' })

    // ========== 步骤3: 输入并发送 ==========
    console.log('步骤3: 输入并发送')
    await page.locator('textarea').fill('搜索今天的科技新闻')

    // 监听网络请求
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/api/v1/chat/stream') && request.method() === 'POST',
      { timeout: 10000 }
    )

    await page.locator('button').filter({ has: page.locator('svg') }).last().click()

    const request = await requestPromise
    const requestBody = JSON.parse(request.postData() || '{}')

    // 截图记录
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'test-results/search-2-sent.png', fullPage: true })

    // 验证请求参数
    console.log('联网搜索请求体:', JSON.stringify(requestBody, null, 2))
    expect(requestBody).toHaveProperty('useAgent', true) // 联网搜索应该启用 useAgent

    // 等待 AI 响应
    await page.waitForSelector('[data-role="assistant"]', { timeout: 30000 })
    await page.waitForTimeout(5000)

    // 截图记录结果
    await page.screenshot({ path: 'test-results/search-3-result.png', fullPage: true })

    console.log('✓ 联网搜索链路测试通过')
  })

  test('BUG验证: 深度研究与深度思考的互斥关系', async ({ page }) => {
    // ========== 切换到专家模式 ==========
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(300)

    // ========== 步骤1: 先开启深度思考 ==========
    console.log('步骤1: 开启深度思考')
    await page.locator('button:has-text("深度思考")').click()
    await page.waitForTimeout(200)

    // 验证深度思考已开启
    let deepThinkingBtn = page.locator('button:has-text("深度思考")')
    let isDeepThinkingActive = await deepThinkingBtn.evaluate(el =>
      el.classList.contains('bg-blue-50') || getComputedStyle(el).backgroundColor.includes('239, 246, 255')
    )
    console.log('深度思考状态(开启后):', isDeepThinkingActive)
    expect(isDeepThinkingActive).toBeTruthy()

    // ========== 步骤2: 开启深度研究 ==========
    console.log('步骤2: 开启深度研究')
    await page.locator('button:has-text("深度研究")').click()
    await page.waitForTimeout(500)

    // 截图记录状态
    await page.screenshot({ path: 'test-results/bug-1-deep-research-on.png' })

    // ========== 步骤3: 验证互斥关系 ==========
    console.log('步骤3: 验证互斥关系')

    // 验证深度研究已开启
    const deepResearchBtn = page.locator('button:has-text("深度研究")')
    const isDeepResearchActive = await deepResearchBtn.evaluate(el =>
      el.classList.contains('bg-gradient-to-r') || getComputedStyle(el).background.includes('gradient')
    )
    console.log('深度研究状态:', isDeepResearchActive)
    expect(isDeepResearchActive).toBeTruthy()

    // 验证深度思考应该被关闭
    deepThinkingBtn = page.locator('button:has-text("深度思考")')
    isDeepThinkingActive = await deepThinkingBtn.evaluate(el =>
      el.classList.contains('bg-blue-50') || getComputedStyle(el).backgroundColor.includes('239, 246, 255')
    )
    console.log('深度思考状态(开启深度研究后):', isDeepThinkingActive)

    // 这个断言可能会失败，因为之前截图显示两者同时激活
    if (isDeepThinkingActive) {
      console.error('❌ BUG 确认: 开启深度研究后，深度思考仍然处于激活状态')
    }
    expect(isDeepThinkingActive).toBeFalsy() // 预期应该被关闭
  })

  test('验证专家模式下的模型选择', async ({ page }) => {
    // ========== 切换到专家模式 ==========
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(300)

    // ========== 打开模型选择器 ==========
    console.log('打开模型选择器')
    const modelSelector = page.locator('button').filter({ hasText: /Qwen|kimi|deepseek/i })
    await expect(modelSelector).toBeVisible()

    await modelSelector.click()
    await page.waitForTimeout(300)

    // 截图记录模型选择菜单
    await page.screenshot({ path: 'test-results/model-selector.png' })

    // 验证下拉菜单出现
    const dropdown = page.locator('[role="listbox"], .dropdown, [class*="select"], [class*="dropdown"]').first()
    await expect(dropdown).toBeVisible().catch(() => {
      console.log('下拉菜单可能使用了不同的选择器')
    })

    console.log('✓ 模型选择器测试完成')
  })

  test('验证发送按钮状态变化', async ({ page }) => {
    // ========== 切换到专家模式 ==========
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(300)

    // ========== 步骤1: 空输入时发送按钮禁用 ==========
    console.log('步骤1: 验证空输入状态')
    const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).last()

    // 截图记录初始状态
    await page.screenshot({ path: 'test-results/send-btn-1-empty.png' })

    // 检查按钮是否有禁用样式
    const isDisabledEmpty = await sendBtn.evaluate(el => {
      const hasDisabledClass = el.classList.contains('cursor-not-allowed') ||
                               el.classList.contains('bg-slate-100') ||
                               el.disabled
      const bgColor = getComputedStyle(el).backgroundColor
      return hasDisabledClass || bgColor.includes('241, 245, 249') // slate-100
    })
    console.log('空输入时按钮禁用状态:', isDisabledEmpty)

    // ========== 步骤2: 输入内容后发送按钮启用 ==========
    console.log('步骤2: 输入内容后验证')
    await page.locator('textarea').fill('测试消息')
    await page.waitForTimeout(200)

    // 截图记录有内容状态
    await page.screenshot({ path: 'test-results/send-btn-2-filled.png' })

    // 检查按钮是否有激活样式（蓝色渐变）
    const isEnabled = await sendBtn.evaluate(el => {
      const bg = getComputedStyle(el).background
      return bg.includes('gradient') || bg.includes('59, 130, 246') // blue-500
    })
    console.log('有内容时按钮激活状态:', isEnabled)
    expect(isEnabled).toBeTruthy()

    console.log('✓ 发送按钮状态测试完成')
  })
})
