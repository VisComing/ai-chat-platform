# Agent 联网搜索综合指南

本文档整合了 LangGraph Agent 联网搜索功能的完整说明，包括架构设计、部署运维、前端集成和测试验证。

## 一、项目概述

### 1.1 功能简介

本项目已实现完整的 LangGraph Agent，支持自动判断是否需要联网搜索。

**核心能力**：
- 自动判断是否需要联网搜索
- 调用阿里云 IQS UnifiedSearch API 获取最新信息
- 整合搜索结果生成回答，带来源引用
- 支持流式输出（SSE）
- 基于 LangGraph 构建

### 1.2 核心文件

**后端代码**：
```
backend/app/
├── services/
│   ├── search_service.py      # 阿里云 IQS 搜索服务
│   ├── agent_service.py       # LangGraph Agent 核心
│   └── ai_service.py          # AI 服务（原有）
├── api/v1/
│   └── chat.py                # /agent/stream 端点
└── core/
    └── config.py              # 搜索配置
```

**前端组件**：
```
frontend/components/chat/
├── SearchIndicator.tsx        # 搜索状态指示器
├── SourceDisplay.tsx          # 引用和来源展示
├── MessageBubbleEnhanced.tsx  # 增强消息气泡
└── InputArea.tsx              # Agent 模式切换
```

### 1.3 快速开始

**1. 安装依赖**：
```bash
pip install langgraph==0.2.28 langchain==0.3.0 langchain-openai==0.2.0 langchain-core==0.3.0
```

**2. 配置环境变量**：
```env
ALIBABA_SEARCH_API_KEY=your_api_key
ALIBABA_SEARCH_BASE_URL=https://cloud-iqs.aliyuncs.com
ENABLE_SEARCH_AGENT=true
```

**3. 启动服务**：
```bash
uvicorn app.main:app --reload
```

**4. 测试验证**：
```bash
python tests/test_agent.py
```

---

## 二、架构设计

### 2.1 LangGraph 状态图

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  Agent  │────▶│  Tools  │────▶│  Agent  │──▶ END
│ (LLM)   │     │(search) │     │ (LLM)   │
└────┬────┘     └─────────┘     └─────────┘
     │
     └───────────────────────────────────▶ END
              (不需要搜索)
```

**状态节点**：
- **agent** - LLM 决策节点，分析用户问题，决定是否需要搜索
- **tools** - 工具执行节点，执行 web_search 工具
- **should_continue** - 条件边，判断是否有工具调用

### 2.2 核心组件

#### SearchService (`search_service.py`)

封装阿里云 IQS UnifiedSearch API：
- HTTP POST 请求调用
- 超时处理（默认 30 秒）
- 搜索结果格式化
- 引用链接生成

**API 参数**：
| 参数 | 说明 |
|------|------|
| `query` | 搜索关键词（1-500 字符） |
| `engineType` | 引擎类型：Generic/GenericAdvanced |
| `timeRange` | 时间范围：OneDay/OneWeek/OneMonth |
| `contents` | 返回内容控制 |

#### AgentService (`agent_service.py`)

LangGraph Agent 核心：
- 构建 LangGraph 状态图
- 定义搜索工具 `web_search`
- System Prompt 设计
- 流式输出集成

### 2.3 System Prompt 设计

**触发搜索条件**：
- 时间敏感词：今天、最近、最新
- 实时数据：天气、股价、汇率
- 最新事件：新闻、产品发布

**不触发搜索条件**：
- 常识问题：定义、原理、概念
- 编程知识：语法、算法、框架
- 历史事实：已确定的历史事件

**回答格式要求**：
```
北京今天晴天，气温 15-25°C[1]。

---
**参考来源：**
[1] [北京天气预报](https://weather.com.cn/beijing)
```

### 2.4 SSE 事件类型

| 事件类型 | 描述 | 数据格式 |
|---------|------|---------|
| `session` | 新会话创建 | `{"sessionId": "xxx"}` |
| `thinking` | Agent 分析中 | `{"status": "analyzing"}` |
| `tool_call` | 工具调用 | `{"tool": "web_search", "query": "xxx"}` |
| `text` | 文本内容 | `{"content": "xxx"}` |
| `complete` | 完成 | `{"search_used": true, "citations": [...]}` |
| `error` | 错误 | `{"content": "xxx"}` |
| `title` | 标题更新 | `{"title": "xxx"}` |

---

## 三、部署运维

### 3.1 环境配置

**.env 文件**：
```env
# 阿里云 IQS 搜索 API
ALIBABA_SEARCH_API_KEY=your_api_key
ALIBABA_SEARCH_BASE_URL=https://cloud-iqs.aliyuncs.com
ALIBABA_SEARCH_TIMEOUT=30

# Agent 设置
ENABLE_SEARCH_AGENT=true
SEARCH_MAX_RESULTS=5
AGENT_MAX_ITERATIONS=3
```

**API Key 获取**：
1. 访问 [IQS 控制台](https://help.aliyun.com/zh/document_detail/2872258.html)
2. 创建 API Key
3. 等待 5 分钟生效
4. 配置到 `.env` 文件

### 3.2 验证清单

**环境检查**：
```bash
pip list | grep langgraph
pip list | grep langchain
```

```python
from app.core.config import settings
print(settings.alibaba_search_api_key)
print(settings.enable_search_agent)
```

**功能测试**：
- 天气查询 → 应触发搜索
- 最新新闻 → 应触发搜索
- 常识问题 → 不触发搜索
- 编程问题 → 不触发搜索

### 3.3 故障排查

**问题 1：搜索不触发**

排查步骤：
1. 检查 System Prompt 是否正确
2. 验证模型支持 tool calling（如 qwen3.5-plus）
3. 检查工具定义

```python
# 在 agent_service.py 中检查
print(self.llm_with_tools.tools)  # 应显示 web_search
```

**问题 2：搜索失败**

排查步骤：
1. 检查 API Key 是否正确
2. 验证网络连接
3. 测试 API 连接

```bash
curl -X POST https://cloud-iqs.aliyuncs.com/search/unified \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}'
```

**问题 3：流式输出中断**

排查步骤：
1. 检查后端日志
2. 验证 SSE 格式
3. 测试网络稳定性

### 3.4 生产部署建议

**安全加固**：
- 使用 HTTPS
- 限制 CORS 来源
- 添加认证中间件
- 定期更换 API Key

**性能优化**：
- 启用 Redis 缓存
- 使用异步处理
- 限制并发数量
- 监控资源使用

---

## 四、前端集成

### 4.1 组件结构

```
frontend/components/chat/
├── SearchIndicator.tsx       # 搜索状态指示器
├── SourceDisplay.tsx         # 引用和来源展示
├── MessageBubbleEnhanced.tsx # 增强消息气泡（集成搜索）
├── MessageBubble.tsx         # 原始消息气泡
└── MessageList.tsx           # 消息列表
```

### 4.2 数据结构

**MessageMetadata**：
```typescript
interface MessageMetadata {
  model?: string
  tokens?: { input: number; output: number }
  sources?: Source[]          // 引用来源
  searchUsed?: boolean        // 是否使用了搜索
  searchQuery?: string        // 搜索查询
  searchResultCount?: number  // 搜索结果数量
}

interface Source {
  id: string
  title: string
  url: string
  snippet?: string
  publishedTime?: string
  rerankScore?: number
  favicon?: string
}
```

### 4.3 SSE 事件处理

```typescript
// chatStore.ts 中处理搜索相关事件
await chatService.streamChat(request, (chunk: StreamChunk) => {
  if (chunk.type === 'tool_call') {
    // 显示搜索状态
    setToolCall({
      name: chunk.toolName || 'web_search',
      args: chunk.toolArgs,
    })
  }

  if (chunk.type === 'search_result') {
    // 更新搜索结果
    setSources(chunk.toolResult?.sources)
  }

  if (chunk.type === 'complete') {
    // 完成，显示引用
    setSearchUsed(chunk.metadata?.searchUsed)
  }
})
```

### 4.4 UI 设计

**搜索状态指示器**：

| 状态 | 显示 |
|------|------|
| `searching` | 🔍 正在搜索...（蓝色脉冲） |
| `found` | ✓ 找到 N 条相关信息（绿色） |
| `failed` | ⚠️ 搜索服务不可用（灰色） |

**引用角标**：
- 文本中以 `[1]`、`[2]` 标注来源
- 点击角标滚动到对应来源卡片
- 悬停显示来源预览

**参考来源卡片**：
```
┌─────────────────────────────────────┐
│ 📚 参考来源                          │
├─────────────────────────────────────┤
│ [1] 北京天气预报                      │
│     weather.com • 2小时前            │
│ [2] 北京空气质量                      │
│     aqi.com • 今天                   │
└─────────────────────────────────────┘
```

### 4.5 交互细节

**引用跳转**：
```typescript
const scrollToSource = (number: number) => {
  const element = document.getElementById(`source-${number}`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element.classList.add('highlight')
    setTimeout(() => element.classList.remove('highlight'), 2000)
  }
}
```

---

## 五、测试验证

### 5.1 测试场景

**触发搜索测试**：
| 测试场景 | 预期结果 |
|---------|---------|
| 天气查询 | 触发搜索 |
| 最新新闻 | 触发搜索 |
| 实时汇率 | 触发搜索 |

**不触发搜索测试**：
| 测试场景 | 预期结果 |
|---------|---------|
| 常识问题 | 不触发搜索 |
| 编程问题 | 不触发搜索 |
| 历史问题 | 不触发搜索 |

**降级处理测试**：
- 搜索超时 → 告知用户，基于已有知识回答
- 搜索返回空 → 搜索服务不可用提示

### 5.2 运行测试

**后端测试**：
```bash
cd backend
python -m pytest tests/test_agent.py -v
python -m pytest tests/test_agent_api.py -v
```

**前端 E2E 测试**：
```bash
cd frontend
npx playwright test tests/e2e/agent-search.spec.ts
```

**测试脚本**（Windows）：
```bash
run-agent-tests.bat
```

### 5.3 测试数据

**应触发搜索**：
```typescript
const searchQueries = [
  "今天北京天气怎么样？",
  "最近有什么新闻？",
  "现在美元汇率是多少？"
]
```

**不应触发搜索**：
```typescript
const noSearchQueries = [
  "什么是机器学习？",
  "Python 如何定义函数？",
  "第二次世界大战什么时候结束？"
]
```

### 5.4 CI/CD 配置

```yaml
name: Agent E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Run backend tests
        run: cd backend && pytest tests/test_agent_api.py -v
      - name: Run frontend tests
        run: cd frontend && npx playwright test tests/e2e/agent-search.spec.ts
```

---

## 六、API 参考

### 6.1 端点

**POST `/api/v1/chat/agent/stream`**

### 6.2 请求参数

```json
{
  "sessionId": "session-uuid",  // 可选，新对话时为 null
  "content": {
    "type": "text",
    "text": "今天北京天气怎么样？"
  },
  "model": "qwen3.5-plus"  // 可选
}
```

### 6.3 SSE 事件示例

**工具调用事件**：
```json
{
  "event": "tool_call",
  "data": {
    "type": "tool_call",
    "toolName": "web_search",
    "toolArgs": { "query": "北京天气" }
  }
}
```

**搜索结果事件**：
```json
{
  "event": "search_result",
  "data": {
    "type": "search_result",
    "toolResult": {
      "success": true,
      "resultCount": 18,
      "sources": [
        {
          "id": "src_1",
          "title": "北京天气预报",
          "url": "https://weather.com/beijing",
          "snippet": "今天晴天...",
          "rerankScore": 0.85
        }
      ]
    }
  }
}
```

---

## 七、扩展能力

### 7.1 多轮搜索

```python
# 在 AgentState 中添加
search_depth: int
max_search_depth: int = 2
```

### 7.2 其他工具集成

```python
@tool
async def query_database(query: str) -> str:
    """查询数据库"""
    pass

tools = [web_search, query_database]
```

### 7.3 结果缓存

```python
import redis

cache_key = f"search:{query}"
cached = redis.get(cache_key)
if cached:
    return cached
```

---

## 八、参考资源

- [LangGraph 官方文档](https://langchain-ai.github.io/langgraph/)
- [阿里云 IQS 文档](https://help.aliyun.com/zh/document_detail/2872258.html)
- [FastAPI SSE 文档](https://github.com/sysid/sse-starlette)

---

**文档版本**: v1.0  
**最后更新**: 2026-04-04  
**状态**: 生产就绪