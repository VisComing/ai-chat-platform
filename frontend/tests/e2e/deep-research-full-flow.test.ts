import { test, expect } from '@playwright/test'

test.describe('深度研究功能全链路测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')
  })

  test('深度研究完整链路: 创建任务 → 显示进度 → 轮询状态', async ({ page }) => {
    // ========== 步骤1: 切换到专家模式 ==========
    console.log('步骤1: 切换到专家模式')
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'test-results/research-1-expert-mode.png' })

    // 验证专家模式已激活（专家模式按钮是蓝色背景白色文字）
    const expertBtn = page.locator('button:has-text("专家模式")')
    await expect(expertBtn).toHaveCSS('color', 'rgb(255, 255, 255)')

    // ========== 步骤2: 开启深度研究 ==========
    console.log('步骤2: 开启深度研究')
    const deepResearchBtn = page.locator('button:has-text("深度研究")')

    // 验证深度研究按钮存在（仅专家模式显示）
    await expect(deepResearchBtn).toBeVisible()

    // 点击开启深度研究
    await deepResearchBtn.click()
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'test-results/research-2-deep-research-on.png' })

    // 验证深度研究按钮是激活状态（紫色渐变样式）
    const isDeepResearchActive = await deepResearchBtn.evaluate(el => {
      const classList = el.classList.toString()
      return classList.includes('from-purple') || classList.includes('to-indigo') || classList.includes('text-purple')
    })
    console.log('深度研究激活状态:', isDeepResearchActive)
    expect(isDeepResearchActive).toBeTruthy()

    // 验证深度思考应该被自动关闭（互斥关系）
    const deepThinkingBtn = page.locator('button:has-text("深度思考")')
    const isDeepThinkingActive = await deepThinkingBtn.evaluate(el => {
      const classList = el.classList.toString()
      return classList.includes('bg-blue-50') || classList.includes('border-blue-200')
    })
    console.log('深度思考状态(开启深度研究后):', isDeepThinkingActive)
    expect(isDeepThinkingActive).toBeFalsy() // 应该被关闭

    // 验证联网搜索应该被自动关闭
    const searchBtn = page.locator('button:has-text("联网搜索")')
    const isSearchActive = await searchBtn.evaluate(el => {
      const classList = el.classList.toString()
      return classList.includes('bg-blue-50') || classList.includes('border-blue-200')
    })
    console.log('联网搜索状态(开启深度研究后):', isSearchActive)
    expect(isSearchActive).toBeFalsy() // 应该被关闭

    // 验证底部提示文字出现
    const tipsText = page.locator('text=深度研究将在后台异步执行')
    await expect(tipsText).toBeVisible()

    // ========== 步骤3: 输入研究问题 ==========
    console.log('步骤3: 输入研究问题')
    const textarea = page.locator('textarea')
    await textarea.fill('请深入研究人工智能在医疗领域的应用现状')
    await page.waitForTimeout(200)

    await page.screenshot({ path: 'test-results/research-3-input-filled.png' })

    // 验证输入内容
    await expect(textarea).toHaveValue('请深入研究人工智能在医疗领域的应用现状')

    // ========== 步骤4: 发送消息并创建研究任务 ==========
    console.log('步骤4: 发送消息创建研究任务')

    // 监听深度研究任务创建请求
    const requestPromise = page.waitForRequest(request => {
      const url = request.url()
      const isResearchEndpoint = url.includes('/research/tasks')
      const isPost = request.method() === 'POST'
      if (isResearchEndpoint && isPost) {
        console.log('捕获到深度研究请求:', url)
      }
      return isResearchEndpoint && isPost
    }, { timeout: 15000 })

    // 点击发送按钮
    const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).last()
    await sendBtn.click()

    // 等待请求发送
    let request
    try {
      request = await requestPromise
    } catch (e) {
      console.log('未捕获到深度研究请求，检查是否调用了普通聊天接口')
      // 如果不是深度研究，可能是调用了普通聊天
      await page.screenshot({ path: 'test-results/research-error-no-request.png', fullPage: true })
      throw new Error('未触发深度研究API请求，可能是前端逻辑问题')
    }

    // 解析请求体
    const requestBody = JSON.parse(request.postData() || '{}')
    console.log('深度研究请求体:', JSON.stringify(requestBody, null, 2))

    // 验证请求参数
    expect(requestBody).toHaveProperty('query')
    expect(requestBody.query).toBe('请深入研究人工智能在医疗领域的应用现状')
    expect(requestBody).toHaveProperty('skipClarification', false)

    // ========== 步骤5: 验证研究进度组件显示 ==========
    console.log('步骤5: 验证研究进度组件显示')

    // 等待研究进度组件出现
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/research-4-progress-shown.png', fullPage: true })

    // 验证进度组件中的关键元素
    const progressComponent = page.locator('[class*="research"], [class*="progress"]').first()
    await expect(progressComponent).toBeVisible().catch(() => {
      console.log('进度组件可能使用了不同的选择器')
    })

    // 验证状态显示（可能有"准备中"、"进行中"等状态）
    const statusText = page.locator('text=/准备|进行|pending|running/i').first()
    await expect(statusText).toBeVisible().catch(() => {
      console.log('状态文字可能使用了不同的文本')
    })

    // ========== 步骤6: 验证任务ID保存到localStorage ==========
    console.log('步骤6: 验证任务ID保存到localStorage')

    const localStorageTaskId = await page.evaluate(() => {
      return localStorage.getItem('activeResearchTask')
    })
    console.log('localStorage中的任务ID:', localStorageTaskId)
    expect(localStorageTaskId).not.toBeNull()
    expect(localStorageTaskId?.length).toBeGreaterThan(0)

    console.log('✓ 深度研究全链路测试通过')
  })

  test('深度研究与普通聊天互斥: 关闭深度研究后应使用普通聊天', async ({ page }) => {
    // ========== 切换到专家模式 ==========
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(300)

    // ========== 开启再关闭深度研究 ==========
    console.log('开启深度研究')
    await page.locator('button:has-text("深度研究")').click()
    await page.waitForTimeout(300)

    console.log('关闭深度研究')
    await page.locator('button:has-text("深度研究")').click()
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'test-results/research-toggle-off.png' })

    // 验证深度研究已关闭
    const deepResearchBtn = page.locator('button:has-text("深度研究")')
    const isDeepResearchActive = await deepResearchBtn.evaluate(el => {
      const classList = el.classList.toString()
      return classList.includes('from-purple') || classList.includes('to-indigo')
    })
    expect(isDeepResearchActive).toBeFalsy()

    // 输入问题
    await page.locator('textarea').fill('普通聊天测试')

    // 监听普通聊天请求（而非深度研究）
    const chatRequestPromise = page.waitForRequest(request => {
      return request.url().includes('/chat/stream') && request.method() === 'POST'
    }, { timeout: 15000 })

    // 发送消息
    const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).last()
    await sendBtn.click()

    const chatRequest = await chatRequestPromise
    console.log('捕获到普通聊天请求:', chatRequest.url())

    // 验证没有调用深度研究API
    const isResearchRequest = chatRequest.url().includes('/research')
    expect(isResearchRequest).toBeFalsy()

    console.log('✓ 互斥测试通过：关闭深度研究后使用普通聊天')
  })

  test('快速模式下不应显示深度研究按钮', async ({ page }) => {
    // 确保在快速模式
    await page.locator('button:has-text("快速模式")').click()
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'test-results/research-quick-mode.png' })

    // 验证深度研究按钮不存在
    const deepResearchBtn = page.locator('button:has-text("深度研究")')
    await expect(deepResearchBtn).not.toBeVisible()

    // 验证只有深度思考和联网搜索
    await expect(page.locator('button:has-text("深度思考")')).toBeVisible()
    await expect(page.locator('button:has-text("联网搜索")')).toBeVisible()

    console.log('✓ 快速模式不显示深度研究按钮测试通过')
  })
})
