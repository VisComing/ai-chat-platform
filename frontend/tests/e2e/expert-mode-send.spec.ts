import { test, expect } from '@playwright/test'

test('专家模式发送消息调用深度研究API', async ({ page }) => {
  // 访问首页
  await page.goto('http://localhost:3000')
  await page.waitForLoadState('networkidle')

  // ========== 步骤1: 切换到专家模式 ==========
  console.log('步骤1: 切换到专家模式')
  await page.locator('button:has-text("专家模式")').click()
  await page.waitForTimeout(500)

  await page.screenshot({ path: 'test-results/expert-send-1.png' })

  // 验证专家模式已激活
  const expertBtn = page.locator('button:has-text("专家模式")')
  await expect(expertBtn).toHaveCSS('color', 'rgb(255, 255, 255)')

  // 验证深度研究自动开启且禁用
  const deepResearchBtn = page.locator('button:has-text("深度研究")')
  await expect(deepResearchBtn).toBeVisible()
  await expect(deepResearchBtn).toBeDisabled()

  // ========== 步骤2: 输入问题 ==========
  console.log('步骤2: 输入问题')
  const textarea = page.locator('textarea')
  await textarea.fill('请深度研究人工智能在医疗领域的应用')
  await page.waitForTimeout(300)

  await page.screenshot({ path: 'test-results/expert-send-2.png' })

  // ========== 步骤3: 点击发送并监听API请求 ==========
  console.log('步骤3: 点击发送并监听API请求')

  // 设置请求监听
  let researchRequest: any = null
  let chatRequest: any = null

  page.on('request', request => {
    const url = request.url()
    if (url.includes('/research/tasks') && request.method() === 'POST') {
      console.log('✓ 捕获到深度研究请求:', url)
      researchRequest = {
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      }
    }
    if (url.includes('/chat/stream') && request.method() === 'POST') {
      console.log('✓ 捕获到普通聊天请求:', url)
      chatRequest = {
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      }
    }
  })

  // 找到发送按钮（蓝色背景的按钮）
  const sendButtons = page.locator('button[class*="from-blue-500"]')
  const sendBtnCount = await sendButtons.count()
  console.log('找到蓝色按钮数量:', sendBtnCount)

  // 获取按钮信息
  for (let i = 0; i < sendBtnCount; i++) {
    const btn = sendButtons.nth(i)
    const className = await btn.getAttribute('class')
    const disabled = await btn.isDisabled()
    console.log(`按钮 ${i}:`, { disabled, class: className?.slice(0, 50) })
  }

  // 点击最后一个蓝色按钮（应该是发送按钮）
  const sendBtn = sendButtons.last()
  await sendBtn.click()
  console.log('点击发送按钮')

  // 等待一段时间让请求发送
  await page.waitForTimeout(3000)

  await page.screenshot({ path: 'test-results/expert-send-3.png', fullPage: true })

  // ========== 步骤4: 验证请求 ==========
  console.log('步骤4: 验证请求')

  if (researchRequest) {
    console.log('✓ 深度研究API被调用')
    console.log('请求URL:', researchRequest.url)
    if (researchRequest.postData) {
      const body = JSON.parse(researchRequest.postData)
      console.log('请求体:', JSON.stringify(body, null, 2))
      expect(body).toHaveProperty('query')
      expect(body.query).toBe('请深度研究人工智能在医疗领域的应用')
    }
  } else {
    console.log('✗ 深度研究API未被调用')
  }

  if (chatRequest) {
    console.log('✓ 普通聊天API被调用')
    console.log('请求URL:', chatRequest.url)
  } else {
    console.log('✗ 普通聊天API未被调用')
  }

  // 期望：专家模式应该调用深度研究API
  expect(researchRequest).not.toBeNull()

  // 检查localStorage
  const localStorageData = await page.evaluate(() => {
    return localStorage.getItem('activeResearchTask')
  })
  console.log('localStorage任务ID:', localStorageData)

  console.log('✓ 专家模式发送消息测试完成')
})

test('快速模式发送消息调用普通聊天API', async ({ page }) => {
  // 访问首页
  await page.goto('http://localhost:3000')
  await page.waitForLoadState('networkidle')

  // ========== 步骤1: 确保在快速模式 ==========
  console.log('步骤1: 确保在快速模式')
  await page.locator('button:has-text("快速模式")').click()
  await page.waitForTimeout(500)

  await page.screenshot({ path: 'test-results/quick-send-1.png' })

  // 验证深度研究按钮不存在
  const deepResearchBtn = page.locator('button:has-text("深度研究")')
  await expect(deepResearchBtn).not.toBeVisible()

  // ========== 步骤2: 输入问题 ==========
  console.log('步骤2: 输入问题')
  const textarea = page.locator('textarea')
  await textarea.fill('你好，请介绍一下自己')
  await page.waitForTimeout(300)

  // ========== 步骤3: 点击发送并监听API请求 ==========
  console.log('步骤3: 点击发送并监听API请求')

  let researchRequest: any = null
  let chatRequest: any = null

  page.on('request', request => {
    const url = request.url()
    if (url.includes('/research/tasks') && request.method() === 'POST') {
      console.log('捕获到深度研究请求:', url)
      researchRequest = { url: request.url(), method: request.method() }
    }
    if (url.includes('/chat/stream') && request.method() === 'POST') {
      console.log('✓ 捕获到普通聊天请求:', url)
      chatRequest = { url: request.url(), method: request.method() }
    }
  })

  // 点击发送按钮
  const sendBtn = page.locator('button[class*="from-blue-500"]').last()
  await sendBtn.click()

  await page.waitForTimeout(3000)

  await page.screenshot({ path: 'test-results/quick-send-2.png', fullPage: true })

  // ========== 步骤4: 验证请求 ==========
  console.log('步骤4: 验证请求')

  // 期望：快速模式不应该调用深度研究API
  expect(researchRequest).toBeNull()
  // 期望：快速模式应该调用普通聊天API
  expect(chatRequest).not.toBeNull()

  console.log('✓ 快速模式发送消息测试完成')
})

test('专家模式下深度思考和联网搜索可手动开启', async ({ page }) => {
  // 访问首页
  await page.goto('http://localhost:3000')
  await page.waitForLoadState('networkidle')

  // 切换到专家模式
  await page.locator('button:has-text("专家模式")').click()
  await page.waitForTimeout(500)

  // ========== 步骤1: 验证默认状态 ==========
  console.log('步骤1: 验证默认状态')

  const deepThinkingBtn = page.locator('button:has-text("深度思考")')
  const searchBtn = page.locator('button:has-text("联网搜索")')

  // 默认应该是关闭的
  const isDeepThinkingActive = await deepThinkingBtn.evaluate(el => {
    return el.classList.contains('bg-blue-50') || el.classList.contains('border-blue-200')
  })
  const isSearchActive = await searchBtn.evaluate(el => {
    return el.classList.contains('bg-blue-50') || el.classList.contains('border-blue-200')
  })

  console.log('深度思考默认状态:', isDeepThinkingActive)
  console.log('联网搜索默认状态:', isSearchActive)

  expect(isDeepThinkingActive).toBeFalsy()
  expect(isSearchActive).toBeFalsy()

  // ========== 步骤2: 手动开启深度思考 ==========
  console.log('步骤2: 手动开启深度思考')
  await deepThinkingBtn.click()
  await page.waitForTimeout(300)

  await page.screenshot({ path: 'test-results/expert-toggle-1.png' })

  const isDeepThinkingNowActive = await deepThinkingBtn.evaluate(el => {
    return el.classList.contains('bg-blue-50') || el.classList.contains('border-blue-200')
  })
  console.log('深度思考开启后状态:', isDeepThinkingNowActive)
  expect(isDeepThinkingNowActive).toBeTruthy()

  // ========== 步骤3: 手动开启联网搜索 ==========
  console.log('步骤3: 手动开启联网搜索')
  await searchBtn.click()
  await page.waitForTimeout(300)

  await page.screenshot({ path: 'test-results/expert-toggle-2.png' })

  const isSearchNowActive = await searchBtn.evaluate(el => {
    return el.classList.contains('bg-blue-50') || el.classList.contains('border-blue-200')
  })
  console.log('联网搜索开启后状态:', isSearchNowActive)
  expect(isSearchNowActive).toBeTruthy()

  console.log('✓ 专家模式功能切换测试完成')
})
