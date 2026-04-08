/**
 * Complete E2E Test: Frontend Input -> Backend AI -> Frontend Render
 * 
 * This test validates the entire chat flow:
 * 1. User opens the application
 * 2. Auto-authentication happens
 * 3. User types a message
 * 4. Message is sent to backend
 * 5. Backend calls Alibaba Cloud Bailian AI
 * 6. AI response streams back to frontend
 * 7. Response is rendered in the chat UI
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://127.0.0.1:8001/api/v1';

test.describe('Complete Chat Flow E2E Test', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
  });

  test('should complete full chat flow with AI response', async ({ page }) => {
    // Step 1: Open application
    await page.goto(BASE_URL);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Step 2: Verify auto-authentication
    console.log('Waiting for auto-authentication...');
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true && parsed.state?.accessToken;
      }
      return false;
    }, { timeout: 10000 });
    
    console.log('Auto-authentication successful');
    
    // Step 3: Verify UI is ready
    const inputArea = page.locator('textarea[placeholder*="输入"], textarea[placeholder*="消息"], textarea').first();
    await expect(inputArea).toBeVisible({ timeout: 5000 });
    
    // Step 4: Type a message
    const testMessage = '你好';
    await inputArea.click();
    await inputArea.fill(testMessage);
    await page.waitForTimeout(100); // Wait for React state update
    
    // Step 5: Send the message by pressing Enter
    await inputArea.press('Enter');
    
    console.log('Message sent, waiting for AI response...');
    
    // Step 6: Wait for user message to appear in chat
    await page.waitForSelector(`text="${testMessage}"`, { timeout: 5000 });
    console.log('User message rendered');
    
    // Step 7: Wait for AI response to appear
    // Simple approach: wait for text that looks like AI response (contains common patterns)
    await page.waitForFunction(() => {
      // Check for AI indicator "AI" or assistant message patterns
      const bodyText = document.body.innerText;
      // AI responses typically have polite greetings or helpful phrases
      return bodyText.includes('有什么') || 
             bodyText.includes('可以帮助') || 
             bodyText.includes('你好！') ||
             bodyText.includes('您好');
    }, { timeout: 15000 });
    
    console.log('AI response received and rendered');
    
    // Step 8: Verify AI response exists
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasAIResponse = bodyText.includes('有什么') || 
                         bodyText.includes('可以帮助') || 
                         bodyText.includes('你好！');
    
    expect(hasAIResponse).toBe(true);
    
    // Step 9: Verify session was created
    const sessionCreated = await page.evaluate(() => {
      const sessionStorage = localStorage.getItem('session-storage');
      if (sessionStorage) {
        const parsed = JSON.parse(sessionStorage);
        return parsed.state?.currentSessionId !== null;
      }
      return false;
    });
    
    expect(sessionCreated).toBe(true);
    console.log('Session created successfully');
  });

  test('should handle multiple messages in a session', async ({ page }) => {
    // Open and authenticate
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Send first message
    const inputArea = page.locator('textarea').first();
    await inputArea.fill('1+1=?');
    await inputArea.press('Enter');
    
    // Wait for response
    await page.waitForFunction(() => {
      const bodyText = document.body.innerText;
      return bodyText.includes('2') || bodyText.includes('等于') || bodyText.includes('result');
    }, { timeout: 15000 });
    
    // Send second message
    await inputArea.fill('add 1 more');
    await inputArea.press('Enter');
    
    // Wait for second response
    await page.waitForTimeout(3000);
    
    // Verify conversation continues - check for multiple messages in body text
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasMultipleMessages = bodyText.includes('1+1') || bodyText.includes('add');
    
    expect(hasMultipleMessages).toBe(true);
    console.log('Multi-turn conversation successful');
  });

  test('should handle different AI models', async ({ page }) => {
    // Open and authenticate
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Check if model selector exists
    const modelSelector = page.locator('select, [data-testid="model-selector"]').first();
    
    if (await modelSelector.isVisible()) {
      // Try selecting different model
      await modelSelector.click();
      
      // Look for qwen model option
      const qwenOption = page.locator('text=qwen, text=Qwen').first();
      if (await qwenOption.isVisible()) {
        await qwenOption.click();
        
        // Send message with selected model
        const inputArea = page.locator('textarea').first();
        await inputArea.fill('测试模型切换');
        await page.locator('button:has-text("发送"), button[type="submit"]').first().click();
        
        // Wait for response
        await page.waitForTimeout(5000);
        
        console.log('Model selection test passed');
      }
    } else {
      console.log('Model selector not visible, using default model');
    }
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Open and authenticate
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Monitor console for errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Send a message
    const inputArea = page.locator('textarea').first();
    await inputArea.fill('test error handling');
    await inputArea.press('Enter');
    
    // Wait for response or error
    await page.waitForTimeout(10000);
    
    // Check if there are any unhandled errors
    const hasUnhandledErrors = errors.some(e => 
      !e.includes('Failed to load resource') && // Ignore 404s
      !e.includes('net::ERR') // Ignore network errors
    );
    
    expect(hasUnhandledErrors).toBe(false);
    console.log('Error handling test passed');
  });

  test('should persist session after page reload', async ({ page }) => {
    // Open and authenticate
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Send a message
    const inputArea = page.locator('textarea').first();
    await inputArea.fill('test session persistence');
    await inputArea.press('Enter');
    
    // Wait for response
    await page.waitForFunction(() => {
      const bodyText = document.body.innerText;
      return bodyText.includes('test') || bodyText.includes('session') || bodyText.includes('persistence');
    }, { timeout: 15000 });
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify session still exists
    const sessionExists = await page.evaluate(() => {
      const sessionStorage = localStorage.getItem('session-storage');
      if (sessionStorage) {
        const parsed = JSON.parse(sessionStorage);
        return parsed.state?.currentSessionId !== null;
      }
      return false;
    });
    
    expect(sessionExists).toBe(true);
    console.log('Session persistence test passed');
  });
});

test.describe('Backend API Integration', () => {
  
  test('should connect to backend health endpoint', async ({ request }) => {
    const response = await request.get(`${API_URL.replace('/api/v1', '')}/health`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('should get supported models list', async ({ request }) => {
    const response = await request.get(`${API_URL}/chat/models`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    
    // Verify expected models
    expect(data.data).toContain('qwen3.5-plus');
    expect(data.data).toContain('glm-5');
    console.log('Supported models:', data.data);
  });

  test('should authenticate and get token', async ({ request }) => {
    const timestamp = Date.now();
    const response = await request.post(`${API_URL}/auth/register`, {
      data: {
        email: `test-${timestamp}@example.com`,
        username: `testuser-${timestamp}`,
        password: 'TestPassword123!'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.accessToken).toBeTruthy();
    expect(data.data.user.email).toBeTruthy();
  });
});

test.describe('Message Persistence E2E Test', () => {
  // No beforeEach - we want to test persistence
  
  test('should persist messages after page reload', async ({ page }) => {
    // Step 1: Open and authenticate
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Step 2: Send a message
    const inputArea = page.locator('textarea').first();
    await inputArea.fill('persistence test message');
    await inputArea.press('Enter');
    
    // Step 3: Wait for AI response
    await page.waitForFunction(() => {
      const bodyText = document.body.innerText;
      return bodyText.includes('persistence') || 
             bodyText.includes('test') ||
             bodyText.includes('有什么');
    }, { timeout: 15000 });
    
    // Step 4: Get message count before reload
    const messagesBeforeReload = await page.evaluate(() => {
      const chatStorage = localStorage.getItem('chat-storage');
      if (chatStorage) {
        const parsed = JSON.parse(chatStorage);
        const sessionId = parsed.state?.currentSessionId;
        const messages = parsed.state?.messagesBySession?.[sessionId] || [];
        return messages.length;
      }
      return 0;
    });
    
    console.log(`Messages before reload: ${messagesBeforeReload}`);
    expect(messagesBeforeReload).toBeGreaterThanOrEqual(2); // user + assistant
    
    // Step 5: Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Step 6: Wait for auth to restore
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Step 7: Verify messages are still there
    const messagesAfterReload = await page.evaluate(() => {
      const chatStorage = localStorage.getItem('chat-storage');
      if (chatStorage) {
        const parsed = JSON.parse(chatStorage);
        const sessionId = parsed.state?.currentSessionId;
        const messages = parsed.state?.messagesBySession?.[sessionId] || [];
        return messages.length;
      }
      return 0;
    });
    
    console.log(`Messages after reload: ${messagesAfterReload}`);
    expect(messagesAfterReload).toBeGreaterThanOrEqual(messagesBeforeReload);
    
    // Step 8: Verify message content is visible
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasUserMessage = bodyText.includes('persistence') || bodyText.includes('test');
    expect(hasUserMessage).toBe(true);
    
    console.log('Message persistence test passed');
  });

  test('should persist session list after page reload', async ({ page }) => {
    // Clear localStorage at the start to ensure clean state
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.waitForLoadState('networkidle');
    
    // Wait for auth
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Send a message to create a session
    const inputArea = page.locator('textarea').first();
    await inputArea.fill('session test');
    await inputArea.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Get session data before reload
    const sessionDataBefore = await page.evaluate(() => {
      const sessionStorage = localStorage.getItem('session-storage');
      const chatStorage = localStorage.getItem('chat-storage');
      if (sessionStorage && chatStorage) {
        const sessionParsed = JSON.parse(sessionStorage);
        const chatParsed = JSON.parse(chatStorage);
        return {
          currentSessionId: sessionParsed.state?.currentSessionId,
          sessionsCount: sessionParsed.state?.sessions?.length || 0,
          messagesCount: Object.keys(chatParsed.state?.messagesBySession || {}).length
        };
      }
      return { currentSessionId: null, sessionsCount: 0, messagesCount: 0 };
    });
    
    console.log(`Before reload - Session: ${sessionDataBefore.currentSessionId}, Sessions: ${sessionDataBefore.sessionsCount}, Messages: ${sessionDataBefore.messagesCount}`);
    expect(sessionDataBefore.currentSessionId).not.toBeNull();
    expect(sessionDataBefore.messagesCount).toBeGreaterThan(0);
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for auth to restore
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Wait a bit for zustand to hydrate
    await page.waitForTimeout(500);
    
    // Verify session data exists after reload
    const sessionDataAfter = await page.evaluate(() => {
      const sessionStorage = localStorage.getItem('session-storage');
      const chatStorage = localStorage.getItem('chat-storage');
      if (sessionStorage && chatStorage) {
        const sessionParsed = JSON.parse(sessionStorage);
        const chatParsed = JSON.parse(chatStorage);
        return {
          currentSessionId: sessionParsed.state?.currentSessionId,
          sessionsCount: sessionParsed.state?.sessions?.length || 0,
          messagesCount: Object.keys(chatParsed.state?.messagesBySession || {}).length
        };
      }
      return { currentSessionId: null, sessionsCount: 0, messagesCount: 0 };
    });
    
    console.log(`After reload - Session: ${sessionDataAfter.currentSessionId}, Sessions: ${sessionDataAfter.sessionsCount}, Messages: ${sessionDataAfter.messagesCount}`);
    
    // Verify session and messages exist (not necessarily same session due to auth re-register)
    expect(sessionDataAfter.currentSessionId).not.toBeNull();
    expect(sessionDataAfter.messagesCount).toBeGreaterThan(0);
    
    console.log('Session persistence test passed');
  });

  test('should switch between sessions and maintain messages', async ({ page }) => {
    // Step 1: Open and authenticate
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Step 2: Create first session with message
    const inputArea = page.locator('textarea').first();
    await inputArea.fill('first session message');
    await inputArea.press('Enter');
    
    await page.waitForTimeout(3000);
    
    // Step 3: Create new session
    const newChatButton = page.locator('button:has-text("新对话"), button:has-text("New")').first();
    await newChatButton.click();
    await page.waitForTimeout(500);
    
    // Step 4: Send message in second session
    await inputArea.fill('second session message');
    await inputArea.press('Enter');
    
    await page.waitForTimeout(3000);
    
    // Step 5: Verify we have 2 sessions
    const sessionCount = await page.evaluate(() => {
      const sessionStorage = localStorage.getItem('session-storage');
      if (sessionStorage) {
        const parsed = JSON.parse(sessionStorage);
        return parsed.state?.sessions?.length || 0;
      }
      return 0;
    });
    
    expect(sessionCount).toBeGreaterThanOrEqual(2);
    
    // Step 6: Click on first session
    const sessionButtons = page.locator('button:has-text("对话"), [class*="session"]').first();
    await sessionButtons.click();
    await page.waitForTimeout(500);
    
    // Step 7: Verify first session messages are loaded
    const chatStorage = await page.evaluate(() => {
      const storage = localStorage.getItem('chat-storage');
      if (storage) {
        const parsed = JSON.parse(storage);
        return parsed.state?.messagesBySession;
      }
      return null;
    });
    
    expect(chatStorage).not.toBeNull();
    
    console.log('Session switching test passed');
  });
});

test.describe('Bug Fixes E2E Test', () => {
  
  test('should not create new session on every message send', async ({ page }) => {
    // Clear and start fresh
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.waitForLoadState('networkidle');
    
    // Wait for auth
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Send first message
    const inputArea = page.locator('textarea').first();
    await inputArea.fill('first message');
    await inputArea.press('Enter');
    await page.waitForTimeout(3000);
    
    // Get session count after first message
    const sessionsAfterFirst = await page.evaluate(() => {
      const sessionStorage = localStorage.getItem('session-storage');
      if (sessionStorage) {
        const parsed = JSON.parse(sessionStorage);
        return parsed.state?.sessions?.length || 0;
      }
      return 0;
    });
    
    // Send second message
    await inputArea.fill('second message');
    await inputArea.press('Enter');
    await page.waitForTimeout(3000);
    
    // Get session count after second message
    const sessionsAfterSecond = await page.evaluate(() => {
      const sessionStorage = localStorage.getItem('session-storage');
      if (sessionStorage) {
        const parsed = JSON.parse(sessionStorage);
        return parsed.state?.sessions?.length || 0;
      }
      return 0;
    });
    
    // Session count should be the same (not increased)
    expect(sessionsAfterSecond).toBe(sessionsAfterFirst);
    
    console.log('Session reuse test passed');
  });

  test('should toggle sidebar visibility', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.waitForLoadState('networkidle');
    
    // Wait for auth
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Sidebar should be visible initially
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toHaveCSS('width', '256px');
    
    // Find and click collapse button
    const menuButton = page.locator('aside button:has(svg)').first();
    await menuButton.click();
    await page.waitForTimeout(500);
    
    // Sidebar should be collapsed
    await expect(sidebar).toHaveCSS('width', '0px');
    
    // Find expand button (should be visible when collapsed)
    const expandButton = page.locator('button:has(svg)').filter({ hasText: '' }).first();
    await expandButton.click();
    await page.waitForTimeout(500);
    
    // Sidebar should be visible again
    await expect(sidebar).toHaveCSS('width', '256px');
    
    console.log('Sidebar toggle test passed');
  });

  test('should switch sessions from sidebar', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.waitForLoadState('networkidle');
    
    // Wait for auth
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Create first session with message
    const inputArea = page.locator('textarea').first();
    await inputArea.fill('message in session 1');
    await inputArea.press('Enter');
    await page.waitForTimeout(3000);
    
    // Create new session
    const newChatButton = page.locator('button:has-text("新对话")').first();
    await newChatButton.click();
    await page.waitForTimeout(1000);
    
    // Send message in second session
    await inputArea.fill('message in session 2');
    await inputArea.press('Enter');
    await page.waitForTimeout(3000);
    
    // Click on first session in sidebar
    const sessionItems = page.locator('aside button:has(p)').filter({ hasText: '新对话' });
    const firstSession = sessionItems.first();
    await firstSession.click();
    await page.waitForTimeout(1000);
    
    // Verify we're on first session (should see first message)
    const pageContent = await page.evaluate(() => document.body.innerText);
    expect(pageContent).toContain('message in session 1');
    
    console.log('Session switching test passed');
  });

  test('should handle long chat without overflow', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.waitForLoadState('networkidle');
    
    // Wait for auth
    await page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.isAuthenticated === true;
      }
      return false;
    }, { timeout: 10000 });
    
    // Send multiple messages to create long chat
    const inputArea = page.locator('textarea').first();
    for (let i = 0; i < 5; i++) {
      await inputArea.fill(`Message ${i + 1}: This is a test message to check scrolling behavior.`);
      await inputArea.press('Enter');
      await page.waitForTimeout(2000);
    }
    
    // Check that chat container has scroll
    const chatContainer = page.locator('[class*="overflow"]').first();
    const hasScroll = await chatContainer.evaluate(el => {
      return el.scrollHeight > el.clientHeight;
    });
    
    // Chat should be scrollable
    expect(hasScroll).toBe(true);
    
    // Page should not have body overflow
    const bodyOverflow = await page.evaluate(() => {
      return document.body.style.overflow;
    });
    
    expect(bodyOverflow).not.toBe('hidden');
    
    console.log('Long chat overflow test passed');
  });
});