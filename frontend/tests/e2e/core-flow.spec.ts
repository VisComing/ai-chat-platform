/**
 * 核心流程全链路 E2E 测试
 * 覆盖完整的用户旅程
 */

import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

test.describe('核心流程全链路测试', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('应用应成功加载并完成自动认证', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(2000);

    // 验证自动认证
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true && parsed.state?.accessToken;
      }
      return false;
    }, { timeout: 15000 });

    await page.screenshot({ path: 'test-results/01-auth-completed.png', fullPage: true });

    const authData = await page.evaluate(() => {
      const data = localStorage.getItem('auth-storage');
      return data ? JSON.parse(data) : null;
    });

    expect(authData?.state?.isAuthenticated).toBe(true);
    expect(authData?.state?.accessToken).toBeTruthy();
  });

  test('应能发送消息并接收AI响应', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(2000);

    // 等待认证
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 15000 });

    // 创建新会话
    const newChatButton = page.locator('aside').locator('button').nth(1);
    await newChatButton.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/02-new-session.png', fullPage: true });

    // 发送消息
    const input = page.locator('textarea').first();
    const testMessage = '你好，请介绍一下自己';
    await input.fill(testMessage);
    await input.press('Enter');

    await expect(page.getByText(testMessage).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/03-message-sent.png', fullPage: true });

    // 等待AI响应
    await page.waitForFunction(() => {
      const bodyText = document.body.innerText;
      return bodyText.includes('有什么') || bodyText.includes('可以帮助');
    }, { timeout: 30000 });

    await page.screenshot({ path: 'test-results/04-response-received.png', fullPage: true });

    const hasResponse = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return bodyText.includes('有什么') || bodyText.includes('可以帮助');
    });

    expect(hasResponse).toBe(true);
  });

  test('应能启用Agent模式进行联网搜索', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 15000 });

    // 创建新会话
    const newChatButton = page.locator('aside').locator('button').nth(1);
    await newChatButton.click();
    await page.waitForTimeout(1000);

    // 启用Agent模式
    const agentToggle = page.locator('button').filter({ has: page.locator('svg.lucide-globe') }).first();
    await agentToggle.click();
    await page.waitForTimeout(500);

    await expect(page.getByText('联网搜索')).toBeVisible({ timeout: 2000 });
    await page.screenshot({ path: 'test-results/05-agent-mode.png', fullPage: true });

    // 发送搜索消息
    const input = page.locator('textarea').first();
    await input.fill('今天北京天气怎么样？');
    await input.press('Enter');

    await page.waitForTimeout(30000);
    await page.screenshot({ path: 'test-results/06-search-response.png', fullPage: true });

    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasWeatherInfo = bodyText.includes('天气') || bodyText.includes('温度') || bodyText.includes('北京');
    console.log('天气信息:', hasWeatherInfo);
  });

  test('页面刷新后应保留会话和消息', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 15000 });

    // 创建会话并发送消息
    const newChatButton = page.locator('aside').locator('button').nth(1);
    await newChatButton.click();
    await page.waitForTimeout(1000);

    const testMessage = '持久化测试';
    const input = page.locator('textarea').first();
    await input.fill(testMessage);
    await input.press('Enter');

    await page.waitForFunction(() => {
      const bodyText = document.body.innerText;
      return bodyText.includes('有什么') || bodyText.includes('可以帮助');
    }, { timeout: 30000 });

    // 获取刷新前的数据
    const messagesBefore = await page.evaluate(() => {
      const chatStorage = localStorage.getItem('chat-storage');
      if (chatStorage) {
        const parsed = JSON.parse(chatStorage);
        const sessionId = parsed.state?.currentSessionId;
        return parsed.state?.messagesBySession?.[sessionId]?.length || 0;
      }
      return 0;
    });

    console.log('刷新前消息数:', messagesBefore);

    // 刷新页面
    await page.reload();
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 15000 });

    await page.screenshot({ path: 'test-results/07-after-reload.png', fullPage: true });

    // 验证数据仍然存在
    const messagesAfter = await page.evaluate(() => {
      const chatStorage = localStorage.getItem('chat-storage');
      if (chatStorage) {
        const parsed = JSON.parse(chatStorage);
        const sessionId = parsed.state?.currentSessionId;
        return parsed.state?.messagesBySession?.[sessionId]?.length || 0;
      }
      return 0;
    });

    console.log('刷新后消息数:', messagesAfter);
    expect(messagesAfter).toBeGreaterThanOrEqual(messagesBefore);
  });

  test('所有核心UI元素应正确显示', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 15000 });

    // 验证核心UI元素
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('textarea').first()).toBeVisible();
    await expect(page.locator('button[title="深色"]')).toBeVisible();
    await expect(page.locator('button[title="浅色"]')).toBeVisible();
    await expect(page.locator('button:has-text("快速模式")')).toBeVisible();
    await expect(page.locator('button:has-text("专家模式")')).toBeVisible();
    await expect(page.locator('button').filter({ has: page.locator('svg.lucide-globe') })).toBeVisible();
    await expect(page.locator('button').filter({ has: page.locator('svg.lucide-brain') })).toBeVisible();

    await page.screenshot({ path: 'test-results/08-ui-elements.png', fullPage: true });
  });
});
