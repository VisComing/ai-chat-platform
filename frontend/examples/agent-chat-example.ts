/**
 * Agent Chat Example - 前端集成示例
 * 展示如何在前端使用 Agent API 进行智能搜索对话
 */

// Agent Chat Service
export class AgentChatService {
  private baseUrl: string;
  
  constructor(baseUrl: string = 'http://localhost:8000/api/v1') {
    this.baseUrl = baseUrl;
  }
  
  /**
   * 发送 Agent 聊天请求
   * @param sessionId 会话ID（可选，新对话时为null）
   * @param content 用户消息内容
   * @param model 模型名称（可选）
   * @returns Promise<void> 通过回调处理流式响应
   */
  async chat(
    sessionId: string | null,
    content: string,
    callbacks: {
      onSession?: (sessionId: string) => void;
      onThinking?: (status: string) => void;
      onToolCall?: (tool: string, query: string) => void;
      onText?: (text: string) => void;
      onComplete?: (meta: any) => void;
      onError?: (error: string) => void;
      onTitle?: (title: string) => void;
    },
    model?: string
  ): Promise<void> {
    const requestBody = {
      sessionId: sessionId,
      content: {
        type: 'text',
        text: content
      },
      model: model || 'qwen3.5-plus'
    };
    
    // 使用 fetch 发送 POST 请求，获取 SSE 流
    const response = await fetch(`${this.baseUrl}/chat/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const error = await response.text();
      callbacks.onError?.(error);
      return;
    }
    
    // 处理 SSE 流
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      callbacks.onError?.('无法获取响应流');
      return;
    }
    
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // 解析 SSE 事件
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行
      
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          const eventType = line.substring(7);
          const dataLine = lines[lines.indexOf(line) + 1];
          
          if (dataLine?.startsWith('data: ')) {
            const data = JSON.parse(dataLine.substring(6));
            
            // 处理不同事件类型
            switch (eventType) {
              case 'session':
                callbacks.onSession?.(data.sessionId);
                break;
                
              case 'thinking':
                callbacks.onThinking?.(data.status);
                break;
                
              case 'tool_call':
                callbacks.onToolCall?.(data.tool, data.query);
                break;
                
              case 'text':
                callbacks.onText?.(data.content);
                break;
                
              case 'complete':
                callbacks.onComplete?.(data.meta);
                break;
                
              case 'error':
                callbacks.onError?.(data.content);
                break;
                
              case 'title':
                callbacks.onTitle?.(data.title);
                break;
            }
          }
        }
      }
    }
  }
}

// 使用示例
async function exampleUsage() {
  const agentService = new AgentChatService();
  
  // 示例 1：天气查询（触发搜索）
  console.log('=== 示例 1：天气查询 ===');
  await agentService.chat(null, '今天北京天气怎么样？', {
    onSession: (sessionId) => {
      console.log('会话创建:', sessionId);
    },
    onThinking: (status) => {
      console.log('Agent正在分析:', status);
      // 显示加载状态
    },
    onToolCall: (tool, query) => {
      console.log('搜索工具调用:', tool, query);
      // 显示搜索状态UI
      showSearchIndicator(query);
    },
    onText: (text) => {
      console.log('文本输出:', text);
      // 逐步显示回答
      appendMessage(text);
    },
    onComplete: (meta) => {
      console.log('完成:', meta);
      if (meta.search_used) {
        console.log('搜索已使用，引用:', meta.citations);
        displayCitations(meta.citations);
      }
    },
    onError: (error) => {
      console.error('错误:', error);
    },
    onTitle: (title) => {
      console.log('标题生成:', title);
      updateSessionTitle(title);
    }
  });
  
  // 示例 2：常识问题（不触发搜索）
  console.log('\n=== 示例 2：常识问题 ===');
  await agentService.chat(null, '什么是机器学习？', {
    onToolCall: (tool, query) => {
      console.log('⚠️ 不应触发搜索，但收到了:', tool, query);
    },
    onText: (text) => {
      appendMessage(text);
    },
    onComplete: (meta) => {
      if (!meta.search_used) {
        console.log('✅ 正确：未使用搜索');
      }
    }
  });
}

// UI 辅助函数（示例）
function showSearchIndicator(query: string) {
  // 显示搜索状态指示器
  const indicator = document.getElementById('search-indicator');
  if (indicator) {
    indicator.textContent = `正在搜索: ${query}...`;
    indicator.style.display = 'block';
  }
}

function appendMessage(text: string) {
  // 逐步追加消息文本
  const messageElement = document.getElementById('ai-message');
  if (messageElement) {
    messageElement.textContent += text;
  }
}

function displayCitations(citations: any[]) {
  // 显示引用列表
  const citationsElement = document.getElementById('citations');
  if (citationsElement) {
    citationsElement.innerHTML = citations.map((c, i) => 
      `<a href="${c.link}" target="_blank">[${i+1}] ${c.title}</a>`
    ).join('<br>');
  }
}

function updateSessionTitle(title: string) {
  // 更新会话标题
  const titleElement = document.getElementById('session-title');
  if (titleElement) {
    titleElement.textContent = title;
  }
}

// React 组件示例
import React, { useState, useEffect } from 'react';

export function AgentChatComponent() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [citations, setCitations] = useState<any[]>([]);
  
  const agentService = new AgentChatService();
  
  const sendMessage = async (content: string) => {
    // 清空之前的消息
    setMessages([]);
    setCitations([]);
    
    await agentService.chat(sessionId, content, {
      onSession: setSessionId,
      onThinking: () => setIsSearching(true),
      onToolCall: (tool, query) => {
        setIsSearching(true);
        setSearchQuery(query);
      },
      onText: (text) => {
        setMessages(prev => [...prev, text]);
      },
      onComplete: (meta) => {
        setIsSearching(false);
        if (meta.search_used) {
          setCitations(meta.citations);
        }
      },
      onError: (error) => {
        console.error(error);
        setIsSearching(false);
      },
      onTitle: (title) => {
        // 更新会话标题
        console.log('标题:', title);
      }
    });
  };
  
  return (
    <div className="agent-chat">
      {/* 搜索状态指示器 */}
      {isSearching && (
        <div className="search-indicator">
          正在搜索: {searchQuery}...
        </div>
      )}
      
      {/* 消息列表 */}
      <div className="messages">
        {messages.map((msg, i) => (
          <span key={i}>{msg}</span>
        ))}
      </div>
      
      {/* 引用列表 */}
      {citations.length > 0 && (
        <div className="citations">
          <h4>参考来源：</h4>
          {citations.map((c, i) => (
            <a key={i} href={c.link} target="_blank">
              [{i+1}] {c.title}
            </a>
          ))}
        </div>
      )}
      
      {/* 输入框 */}
      <input 
        type="text" 
        placeholder="输入问题..." 
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            sendMessage(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />
    </div>
  );
}

// Vue 组件示例
import { ref } from 'vue';

export function useAgentChat() {
  const sessionId = ref<string | null>(null);
  const currentMessage = ref('');
  const isSearching = ref(false);
  const searchQuery = ref('');
  const citations = ref<any[]>([]);
  
  const agentService = new AgentChatService();
  
  const sendMessage = async (content: string) => {
    currentMessage.value = '';
    citations.value = [];
    
    await agentService.chat(sessionId.value, content, {
      onSession: (id) => sessionId.value = id,
      onThinking: () => isSearching.value = true,
      onToolCall: (tool, query) => {
        isSearching.value = true;
        searchQuery.value = query;
      },
      onText: (text) => {
        currentMessage.value += text;
      },
      onComplete: (meta) => {
        isSearching.value = false;
        if (meta.search_used) {
          citations.value = meta.citations;
        }
      },
      onError: (error) => {
        console.error(error);
        isSearching.value = false;
      }
    });
  };
  
  return {
    sessionId,
    currentMessage,
    isSearching,
    searchQuery,
    citations,
    sendMessage
  };
}

export default AgentChatService;