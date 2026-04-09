import { test, expect } from '@playwright/test'

test.describe('深度研究全链路验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')
  })

  test('完整链路: 输入 → 创建任务 → 显示在列表 → 查看进度', async ({ page }) => {
    // ========== 步骤1: 切换到专家模式 ==========
    console.log('步骤1: 切换到专家模式')
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'test-results/full-flow-1-expert.png' })

    // 验证深度研究自动开启
    const deepResearchBtn = page.locator('button:has-text("深度研究")')
    await expect(deepResearchBtn).toBeVisible()
    await expect(deepResearchBtn).toBeDisabled()

    // ========== 步骤2: 输入研究问题 ==========
    console.log('步骤2: 输入研究问题')
    const textarea = page.locator('textarea')
    const researchQuery = '深度学习在计算机视觉中的应用现状'
    await textarea.fill(researchQuery)
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'test-results/full-flow-2-input.png' })

    // ========== 步骤3: 发送消息创建任务 ==========
    console.log('步骤3: 发送消息创建任务')

    let taskId: string | null = null
    page.on('response', async response => {
      const url = response.url()
      if (url.includes('/research/tasks') && response.request().method() === 'POST') {
        const data = await response.json()
        console.log('创建任务响应:', JSON.stringify(data, null, 2))
        if (data.data?.taskId) {
          taskId = data.data.taskId
          console.log('✓ 任务创建成功，ID:', taskId)
        }
      }
    })

    const sendBtn = page.locator('button[class*="from-blue-500"]').last()
    await sendBtn.click()

    // 等待任务创建
    await page.waitForTimeout(3000)

    await page.screenshot({ path: 'test-results/full-flow-3-task-created.png', fullPage: true })

    // 验证任务ID已保存到localStorage
    const savedTaskId = await page.evaluate(() => {
      return localStorage.getItem('activeResearchTask')
    })
    console.log('localStorage中的任务ID:', savedTaskId)
    expect(savedTaskId).not.toBeNull()

    // ========== 步骤4: 验证侧边栏研究列表 ==========
    console.log('步骤4: 验证侧边栏研究列表')

    // 点击研究标签
    await page.locator('button:has-text("研究")').click()
    await page.waitForTimeout(1000)

    await page.screenshot({ path: 'test-results/full-flow-4-research-tab.png' })

    // 验证任务显示在列表中
    const researchItems = page.locator('text=' + researchQuery.slice(0, 10))
    const itemCount = await researchItems.count()
    console.log('研究列表中找到的任务数:', itemCount)
    expect(itemCount).toBeGreaterThan(0)

    // 验证任务状态显示
    const statusText = page.locator('text=/排队中|进行中|等待澄清/')
    await expect(statusText.first()).toBeVisible()

    // ========== 步骤5: 验证任务详情页 ==========
    console.log('步骤5: 验证任务详情页')

    // 点击任务项
    await researchItems.first().click()
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/full-flow-5-task-detail.png', fullPage: true })

    // 验证URL包含任务ID
    const currentUrl = page.url()
    console.log('当前URL:', currentUrl)
    expect(currentUrl).toContain('/research/')

    console.log('✓ 全链路测试完成')
  })

  test('快速模式不会创建研究任务', async ({ page }) => {
    // ========== 步骤1: 切换到快速模式 ==========
    console.log('步骤1: 切换到快速模式')
    await page.locator('button:has-text("快速模式")').click()
    await page.waitForTimeout(500)

    // ========== 步骤2: 发送普通消息 ==========
    console.log('步骤2: 发送普通消息')
    const textarea = page.locator('textarea')
    await textarea.fill('你好')

    let researchCreated = false
    page.on('response', async response => {
      if (response.url().includes('/research/tasks') && response.request().method() === 'POST') {
        researchCreated = true
      }
    })

    const sendBtn = page.locator('button[class*="from-blue-500"]').last()
    await sendBtn.click()

    await page.waitForTimeout(2000)

    // 验证没有创建研究任务
    expect(researchCreated).toBeFalsy()

    // 验证localStorage中没有任务ID
    const savedTaskId = await page.evaluate(() => {
      return localStorage.getItem('activeResearchTask')
    })
    expect(savedTaskId).toBeNull()

    console.log('✓ 快速模式不创建研究任务验证完成')
  })

  test('研究列表显示多个任务', async ({ page }) => {
    // 切换到专家模式
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(500)

    // 创建第一个任务
    console.log('创建第一个研究任务')
    await page.locator('textarea').fill('研究主题1：人工智能伦理')
    await page.locator('button[class*="from-blue-500"]').last().click()
    await page.waitForTimeout(2000)

    // 等待返回首页并创建第二个任务
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')
    await page.locator('button:has-text("专家模式")').click()
    await page.waitForTimeout(500)

    console.log('创建第二个研究任务')
    await page.locator('textarea').fill('研究主题2：机器学习算法')
    await page.locator('button[class*="from-blue-500"]').last().click()
    await page.waitForTimeout(2000)

    // 切换到研究标签查看列表
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')
    await page.locator('button:has-text("研究")').click()
    await page.waitForTimeout(1000)

    await page.screenshot({ path: 'test-results/full-flow-multi-tasks.png' })

    // 验证列表中有多个任务
    const taskItems = page.locator('button').filter({ has: page.locator('text=/人工智能伦理|机器学习算法/') })
    const count = await taskItems.count()
    console.log('列表中的任务数:', count)
    expect(count).toBeGreaterThanOrEqual(2)

    console.log('✓ 多任务列表显示验证完成')
  })
})
