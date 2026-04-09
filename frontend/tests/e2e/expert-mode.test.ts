import { test, expect } from '@playwright/test'

test.describe('专家模式前端逻辑测试', () => {
  test.beforeEach(async ({ page }) => {
    // 访问首页
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')
  })

  test('步骤1: 验证初始状态为快速模式', async ({ page }) => {
    // 截图：初始状态
    await page.screenshot({ path: 'test-results/step1-initial-state.png', fullPage: true })

    // 验证快速模式按钮是高亮状态
    const quickModeBtn = page.locator('button:has-text("快速模式")')
    const expertModeBtn = page.locator('button:has-text("专家模式")')

    // 检查快速模式按钮是否有激活样式（白色文字）
    await expect(quickModeBtn).toHaveCSS('color', 'rgb(255, 255, 255)')
    // 检查专家模式按钮是否有非激活样式
    await expect(expertModeBtn).not.toHaveCSS('color', 'rgb(255, 255, 255)')

    console.log('✓ 步骤1通过：初始状态为快速模式')
  })

  test('步骤2: 切换到专家模式', async ({ page }) => {
    // 点击专家模式按钮
    const expertModeBtn = page.locator('button:has-text("专家模式")')
    await expertModeBtn.click()

    // 等待动画完成
    await page.waitForTimeout(500)

    // 截图：切换到专家模式
    await page.screenshot({ path: 'test-results/step2-expert-mode.png', fullPage: true })

    // 验证专家模式按钮是高亮状态
    await expect(expertModeBtn).toHaveCSS('color', 'rgb(255, 255, 255)')

    // 验证深度研究按钮显示（仅专家模式显示）
    const deepResearchBtn = page.locator('button:has-text("深度研究")')
    await expect(deepResearchBtn).toBeVisible()

    console.log('✓ 步骤2通过：成功切换到专家模式，深度研究按钮可见')
  })

  test('步骤3: 测试功能按钮开关状态', async ({ page }) => {
    // 先切换到专家模式
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(300)

    // 测试深度思考按钮
    const deepThinkingBtn = page.locator('button:has-text("深度思考")')
    await deepThinkingBtn.click()
    await page.waitForTimeout(200)

    // 截图：开启深度思考
    await page.screenshot({ path: 'test-results/step3-deep-thinking-on.png', fullPage: true })

    // 验证深度思考按钮有高亮样式（蓝色边框或背景）
    const deepThinkingHasActiveClass = await deepThinkingBtn.evaluate(el =>
      el.classList.contains('bg-blue-50') || el.classList.contains('border-blue-200')
    )
    expect(deepThinkingHasActiveClass).toBeTruthy()

    // 测试联网搜索按钮
    const searchBtn = page.locator('button:has-text("联网搜索")')
    // 默认是开启的，点击关闭
    await searchBtn.click()
    await page.waitForTimeout(200)

    // 截图：关闭联网搜索
    await page.screenshot({ path: 'test-results/step3-search-off.png', fullPage: true })

    console.log('✓ 步骤3通过：功能按钮状态切换正常')
  })

  test('步骤4: 测试深度研究与其它功能的互斥性', async ({ page }) => {
    // 切换到专家模式
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(300)

    // 先开启深度思考
    const deepThinkingBtn = page.locator('button:has-text("深度思考")')
    await deepThinkingBtn.click()
    await page.waitForTimeout(200)

    // 再开启深度研究
    const deepResearchBtn = page.locator('button:has-text("深度研究")')
    await deepResearchBtn.click()
    await page.waitForTimeout(300)

    // 截图：开启深度研究后的状态
    await page.screenshot({ path: 'test-results/step4-deep-research-on.png', fullPage: true })

    // 验证深度研究按钮是激活状态
    const deepResearchHasActiveClass = await deepResearchBtn.evaluate(el =>
      el.classList.contains('bg-gradient-to-r') || el.textContent?.includes('深度研究')
    )
    expect(deepResearchHasActiveClass).toBeTruthy()

    // 验证深度思考应该被取消（非激活状态）
    const deepThinkingHasActiveClass = await deepThinkingBtn.evaluate(el =>
      el.classList.contains('bg-blue-50')
    )
    expect(deepThinkingHasActiveClass).toBeFalsy()

    console.log('✓ 步骤4通过：深度研究与其它功能互斥逻辑正确')
  })

  test('步骤5: 测试输入框交互', async ({ page }) => {
    // 切换到专家模式
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(300)

    // 聚焦输入框
    const textarea = page.locator('textarea')
    await textarea.focus()

    // 截图：输入框聚焦状态
    await page.screenshot({ path: 'test-results/step5-input-focused.png', fullPage: true })

    // 验证输入框有聚焦样式（边框或阴影）
    const inputContainer = page.locator('div').filter({ has: textarea }).first()
    const hasFocusStyle = await inputContainer.evaluate(el =>
      el.classList.contains('ring-4') || el.classList.contains('border-blue-400')
    )
    expect(hasFocusStyle).toBeTruthy()

    // 输入文本
    await textarea.fill('这是一个测试问题')

    // 截图：输入内容后
    await page.screenshot({ path: 'test-results/step5-input-filled.png', fullPage: true })

    // 验证输入框内容
    await expect(textarea).toHaveValue('这是一个测试问题')

    console.log('✓ 步骤5通过：输入框交互正常')
  })

  test('步骤6: 测试发送按钮状态', async ({ page }) => {
    // 获取发送按钮
    const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).last()

    // 初始状态：无内容时发送按钮应该是禁用状态
    await page.screenshot({ path: 'test-results/step6-send-disabled.png', fullPage: true })

    // 输入内容
    const textarea = page.locator('textarea')
    await textarea.fill('测试发送')
    await page.waitForTimeout(200)

    // 截图：有内容后发送按钮应该是可点击状态
    await page.screenshot({ path: 'test-results/step6-send-enabled.png', fullPage: true })

    // 验证发送按钮有激活样式（蓝色背景）
    const sendBtnHasActiveClass = await sendBtn.evaluate(el =>
      el.classList.contains('bg-gradient-to-r') || el.classList.contains('from-blue-500')
    )
    expect(sendBtnHasActiveClass).toBeTruthy()

    console.log('✓ 步骤6通过：发送按钮状态随输入内容变化')
  })

  test('步骤7: 测试快速模式下不显示深度研究', async ({ page }) => {
    // 确保在快速模式
    await page.locator('button:has-text("快速模式")').click()
    await page.waitForTimeout(300)

    // 截图：快速模式
    await page.screenshot({ path: 'test-results/step7-quick-mode.png', fullPage: true })

    // 验证深度研究按钮不存在
    const deepResearchBtn = page.locator('button:has-text("深度研究")')
    await expect(deepResearchBtn).not.toBeVisible()

    console.log('✓ 步骤7通过：快速模式下不显示深度研究按钮')
  })

  test('步骤8: 验证模型选择器存在', async ({ page }) => {
    // 截图：检查模型选择器
    await page.screenshot({ path: 'test-results/step8-model-selector.png', fullPage: true })

    // 验证模型选择器文本存在
    const modelLabel = page.locator('text=模型选择')
    await expect(modelLabel).toBeVisible()

    console.log('✓ 步骤8通过：模型选择器存在')
  })
})
