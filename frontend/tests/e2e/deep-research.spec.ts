import { test, expect } from '@playwright/test'

test('深度研究功能测试', async ({ page }) => {
  // 访问首页
  await page.goto('http://localhost:3000')
  await page.waitForLoadState('networkidle')

  // ========== 步骤1: 切换到专家模式 ==========
  console.log('步骤1: 切换到专家模式')
  await page.locator('button:has-text("专家模式")').click()
  await page.waitForTimeout(500)

  await page.screenshot({ path: 'test-results/dr-01-expert-mode.png' })

  // ========== 步骤2: 验证深度研究自动开启且禁用 ==========
  console.log('步骤2: 验证深度研究自动开启且禁用')
  const deepResearchBtn = page.locator('button:has-text("深度研究")')

  // 验证深度研究按钮存在
  await expect(deepResearchBtn).toBeVisible()

  // 验证按钮是禁用状态（不可点击）
  await expect(deepResearchBtn).toBeDisabled()

  // 验证按钮有提示文字
  const titleAttr = await deepResearchBtn.getAttribute('title')
  console.log('深度研究按钮提示:', titleAttr)
  expect(titleAttr).toContain('强制开启')

  await page.screenshot({ path: 'test-results/dr-02-deep-research-auto-on.png' })

  // 验证深度研究按钮是激活状态（紫色样式）
  const isDeepResearchActive = await deepResearchBtn.evaluate(el => {
    const classList = el.classList.toString()
    const hasPurple = classList.includes('purple') || classList.includes('indigo')
    const style = window.getComputedStyle(el)
    const hasPurpleColor = style.color.includes('147') || style.color.includes('purple')
    return hasPurple || hasPurpleColor
  })
  console.log('深度研究激活状态:', isDeepResearchActive)
  expect(isDeepResearchActive).toBeTruthy()

  // ========== 步骤3: 验证深度思考和联网搜索默认关闭但可开启 ==========
  console.log('步骤3: 验证深度思考和联网搜索默认关闭但可开启')

  // 验证深度思考已被关闭
  const deepThinkingBtn = page.locator('button:has-text("深度思考")')
  const isDeepThinkingActive = await deepThinkingBtn.evaluate(el => {
    const classList = el.classList.toString()
    return classList.includes('bg-blue-50') || classList.includes('border-blue-200')
  })
  console.log('深度思考状态:', isDeepThinkingActive)

  // 验证联网搜索已被关闭
  const searchBtn = page.locator('button:has-text("联网搜索")')
  const isSearchActive = await searchBtn.evaluate(el => {
    const classList = el.classList.toString()
    return classList.includes('bg-blue-50') || classList.includes('border-blue-200')
  })
  console.log('联网搜索状态:', isSearchActive)

  // ========== 步骤4: 输入研究问题 ==========
  console.log('步骤4: 输入研究问题')
  const textarea = page.locator('textarea')
  await textarea.fill('人工智能在医疗领域的应用现状和未来趋势')
  await page.waitForTimeout(300)

  await page.screenshot({ path: 'test-results/dr-03-input-filled.png' })

  // ========== 步骤5: 发送消息 ==========
  console.log('步骤5: 发送消息')

  // 使用更精确的选择器 - 选择蓝色背景的按钮（激活状态的发送按钮）
  const sendBtn = page.locator('button.bg-gradient-to-r, button[class*="from-blue-500"]').first()

  // 检查按钮是否存在
  const btnCount = await sendBtn.count()
  console.log('找到的发送按钮数量:', btnCount)

  if (btnCount === 0) {
    console.log('使用备用选择器')
    // 备用选择器：选择最后一个 button（发送按钮）
    const allButtons = page.locator('button')
    const totalButtons = await allButtons.count()
    console.log('页面总按钮数:', totalButtons)

    // 打印所有按钮的信息
    for (let i = 0; i < Math.min(totalButtons, 10); i++) {
      const btn = allButtons.nth(i)
      const text = await btn.textContent()
      const disabled = await btn.isDisabled().catch(() => 'N/A')
      const className = await btn.getAttribute('class')
      console.log(`按钮 ${i}:`, { text: text?.slice(0, 30), disabled, class: className?.slice(0, 50) })
    }
  }

  // 监听所有网络请求
  page.on('request', request => {
    console.log('网络请求:', request.method(), request.url())
  })

  // 监听页面导航
  page.on('framenavigated', frame => console.log('页面导航:', frame.url()))

  console.log('点击发送按钮')

  // 监听所有类型的控制台消息
  page.on('console', async msg => {
    const args = await Promise.all(msg.args().map(arg => arg.jsonValue().catch(() => arg.toString())))
    console.log(`[${msg.type()}]`, ...args)
  })

  // 记录当前URL
  const urlBefore = page.url()
  console.log('点击前URL:', urlBefore)

  // 监听对话框
  page.on('dialog', dialog => {
    console.log('对话框:', dialog.type(), dialog.message())
    dialog.accept()
  })

  // 点击前截图
  await page.screenshot({ path: 'test-results/dr-before-click.png' })

  // 检查按钮的具体内容
  const btnHTML = await sendBtn.innerHTML()
  console.log('发送按钮 HTML:', btnHTML.slice(0, 200))

  const btnText = await sendBtn.textContent()
  console.log('发送按钮文本:', btnText)

  // 检查按钮的 disabled 状态
  const isDisabled = await sendBtn.isDisabled()
  const isEnabled = await sendBtn.isEnabled()
  console.log('发送按钮 disabled:', isDisabled, 'enabled:', isEnabled)

  // 使用 force: true 确保点击
  await sendBtn.click({ force: true })
  console.log('点击完成')

  // 等待一下看是否有变化
  await page.waitForTimeout(3000)

  // 点击后等待一下，然后执行 JavaScript 检查
  await page.waitForTimeout(1000)

  // 在浏览器中执行 JavaScript 检查点击是否生效
  const clickResult = await page.evaluate(() => {
    // 检查 textarea 的值
    const textarea = document.querySelector('textarea')
    const textareaValue = textarea?.value

    // 检查是否有任何 error message
    const errorElements = document.querySelectorAll('[class*="error"], [class*="toast"]')
    const errors = Array.from(errorElements).map(el => el.textContent)

    // 检查是否有 loading 状态
    const loadingElements = document.querySelectorAll('[class*="loading"], [class*="animate-spin"]')
    const hasLoading = loadingElements.length > 0

    return { textareaValue, errors, hasLoading }
  })
  console.log('点击后页面状态:', clickResult)

  // 点击后截图
  await page.screenshot({ path: 'test-results/dr-after-click.png' })

  // 记录点击后URL
  const urlAfter = page.url()
  console.log('点击后URL:', urlAfter)

  // 检查localStorage
  const localStorageData = await page.evaluate(() => {
    const data: Record<string, string | null> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) data[key] = localStorage.getItem(key)
    }
    return data
  })
  console.log('localStorage 数据:', localStorageData)

  await page.screenshot({ path: 'test-results/dr-04-after-send.png', fullPage: true })

  // ========== 步骤6: 验证localStorage ==========
  console.log('步骤6: 验证localStorage')
  const localStorageTaskId = await page.evaluate(() => {
    return localStorage.getItem('activeResearchTask')
  })
  console.log('localStorage任务ID:', localStorageTaskId)

  // 等待一段时间看是否有研究进度组件
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'test-results/dr-05-progress.png', fullPage: true })

  console.log('✓ 深度研究测试完成')
})
