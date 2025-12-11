# Design Document - AI Diagnostic Assistant

## Overview

AI 诊断助手是一个集成在服务详情页的智能诊断工具，通过本地 AI 模型和工具链，帮助运维人员快速诊断和解决 Kubernetes 服务问题。

### 核心目标

- 提供自然语言交互界面，降低问题排查门槛
- 自动收集服务状态、日志、指标等诊断信息
- 实时流式展示 AI 分析过程和结果
- 本地化部署，确保数据安全和低延迟

### MVP 范围

本设计文档聚焦于 MVP 阶段的核心功能：
1. AI 诊断面板的前端界面
2. WebSocket 实时通信
3. 后端 AI Agent 服务
4. 工具链集成（kubectl、日志、Prometheus）

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Service Detail Page                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              AI Diagnostic Panel (React)               │ │
│  │  - Chat Interface                                      │ │
│  │  - Message Display (Streaming)                         │ │
│  │  - Input Box                                           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ WebSocket
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              WebSocket Server (Node.js)                      │
│  - Connection Management                                     │
│  - Message Routing                                           │
│  - Session Management                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/IPC
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  AI Agent Service (Node.js)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              LLM Client (Ollama/OpenAI)                │ │
│  │  - Prompt Engineering                                  │ │
│  │  - Streaming Response Handling                         │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   Tool Executor                        │ │
│  │  - Tool Registry                                       │ │
│  │  - Parameter Validation                                │ │
│  │  - Result Formatting                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┼───────────┐
                │           │           │
                ↓           ↓           ↓
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ kubectl  │  │   Logs   │  │Prometheus│
        │  Client  │  │  Reader  │  │  Client  │
        └──────────┘  └──────────┘  └──────────┘
                │           │           │
                ↓           ↓           ↓
        ┌──────────────────────────────────────┐
        │       Kubernetes Cluster             │
        │  - Pods                              │
        │  - Deployments                       │
        │  - Events                            │
        │  - Logs                              │
        │  - Metrics                           │
        └──────────────────────────────────────┘
```

### 技术栈

**前端**
- React 19 + TypeScript
- WebSocket Client (native WebSocket API)
- Tailwind CSS + shadcn/ui
- Markdown 渲染（react-markdown）

**后端**
- Node.js + TypeScript
- WebSocket Server (ws 库)
- AI SDK (Vercel AI SDK 或 LangChain.js)
- Kubernetes Client (@kubernetes/client-node)

**AI 模型**
- 本地 LLM：Ollama (推荐 qwen2.5:7b 或 llama3.1:8b)
- 备选：OpenAI API（可配置）

## Components and Interfaces

### 1. Frontend Components

#### AIDiagnosticPanel

诊断面板主组件，管理整个 AI 诊断界面。

```typescript
interface AIDiagnosticPanelProps {
  serviceId: string
  serviceName: string
  onClose: () => void
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
}

interface ToolCall {
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  result?: unknown
  error?: string
}
```

**职责：**
- 管理 WebSocket 连接
- 维护消息历史
- 处理用户输入
- 渲染消息列表

#### MessageList

消息列表组件，展示对话历史。

```typescript
interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}
```

**职责：**
- 渲染用户和 AI 的消息
- 支持 Markdown 格式
- 显示工具调用状态
- 自动滚动到最新消息

#### MessageInput

消息输入组件。

```typescript
interface MessageInputProps {
  onSend: (content: string) => void
  disabled: boolean
  placeholder?: string
}
```

**职责：**
- 处理用户输入
- 输入验证（非空检查）
- 支持回车发送
- 禁用状态管理

### 2. WebSocket Communication

#### WebSocket Message Protocol

```typescript
// Client -> Server
interface ClientMessage {
  type: 'diagnostic_request'
  payload: {
    serviceId: string
    message: string
    sessionId?: string
  }
}

// Server -> Client
type ServerMessage =
  | {
      type: 'diagnostic_response'
      payload: {
        content: string
        done: boolean
      }
    }
  | {
      type: 'tool_call'
      payload: {
        toolName: string
        status: 'running' | 'success' | 'error'
        result?: unknown
        error?: string
      }
    }
  | {
      type: 'error'
      payload: {
        message: string
        code?: string
      }
    }
```

### 3. Backend Services

#### AIAgentService

AI Agent 核心服务，负责与 LLM 交互和工具调用。

```typescript
interface AIAgentService {
  /**
   * 处理诊断请求
   */
  diagnose(request: DiagnosticRequest): AsyncGenerator<DiagnosticChunk>
  
  /**
   * 执行工具调用
   */
  executeTool(toolName: string, params: unknown): Promise<ToolResult>
}

interface DiagnosticRequest {
  serviceId: string
  message: string
  context?: DiagnosticContext
}

interface DiagnosticContext {
  serviceName: string
  namespace: string
  previousMessages?: Message[]
}

interface DiagnosticChunk {
  type: 'text' | 'tool_call' | 'tool_result'
  content?: string
  toolCall?: ToolCall
  toolResult?: ToolResult
}

interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}
```

#### ToolRegistry

工具注册表，管理所有可用的诊断工具。

```typescript
interface Tool {
  name: string
  description: string
  parameters: JSONSchema
  execute: (params: unknown, context: ToolContext) => Promise<ToolResult>
}

interface ToolContext {
  serviceId: string
  namespace: string
}

class ToolRegistry {
  private tools: Map<string, Tool> = new Map()
  
  register(tool: Tool): void
  get(name: string): Tool | undefined
  list(): Tool[]
  execute(name: string, params: unknown, context: ToolContext): Promise<ToolResult>
}
```

### 4. Diagnostic Tools

#### getPodStatus

获取 Pod 状态和事件。

```typescript
interface GetPodStatusParams {
  serviceId: string
}

interface PodStatusResult {
  pods: Array<{
    name: string
    status: string
    restartCount: number
    age: string
    events: Array<{
      type: string
      reason: string
      message: string
      timestamp: string
    }>
  }>
}
```

#### getServiceLogs

获取服务日志。

```typescript
interface GetServiceLogsParams {
  serviceId: string
  lines?: number  // 默认 1000
  since?: string  // 时间范围，如 "1h"
}

interface ServiceLogsResult {
  logs: string
  truncated: boolean
  totalLines: number
}
```

#### getResourceMetrics

获取资源使用指标。

```typescript
interface GetResourceMetricsParams {
  serviceId: string
  timeRange?: string  // 默认 "5m"
}

interface ResourceMetricsResult {
  cpu: {
    current: string
    limit: string
    usage: number  // 百分比
  }
  memory: {
    current: string
    limit: string
    usage: number  // 百分比
  }
}
```

#### getDeploymentConfig

获取 Deployment 配置。

```typescript
interface GetDeploymentConfigParams {
  serviceId: string
}

interface DeploymentConfigResult {
  replicas: number
  image: string
  resources: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
  env: Array<{ name: string; value?: string }>
  volumes: Array<{ name: string; mountPath: string }>
}
```

## Data Models

### Database Schema

```typescript
// 诊断会话（后续阶段实现）
interface DiagnosticSession {
  id: string
  serviceId: string
  userId: string
  createdAt: Date
  updatedAt: Date
  messages: Message[]
  status: 'active' | 'closed'
}
```

### In-Memory State

```typescript
// WebSocket 连接状态
interface ConnectionState {
  sessionId: string
  serviceId: string
  userId: string
  connectedAt: Date
  lastActivity: Date
}

// AI Agent 上下文
interface AgentContext {
  serviceId: string
  serviceName: string
  namespace: string
  conversationHistory: Message[]
  toolResults: Map<string, ToolResult>
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

在定义具体属性之前，让我们识别可能的冗余：

1. **WebSocket 连接管理**：连接建立、消息发送、连接断开是独立的操作，不冗余
2. **输入验证**：空输入验证是独立的边界条件，不冗余
3. **工具调用**：每个工具（Pod 状态、日志、指标、配置）提供不同的数据，不冗余
4. **流式响应**：流式显示是独立的 UI 行为，不冗余

所有属性都提供独特的验证价值，无需合并。

### MVP 阶段属性

Property 1: WebSocket 连接建立后可发送消息
*For any* 有效的服务 ID，当用户打开诊断面板并建立 WebSocket 连接后，应当能够成功发送诊断请求消息
**Validates: Requirements 1.2**

Property 2: 空输入被正确拒绝
*For any* 空字符串或仅包含空白字符的输入，系统应当阻止提交并保持输入框可用状态
**Validates: Requirements 2.3**

Property 3: 诊断请求触发工具调用
*For any* 有效的诊断请求，AI Agent 应当至少调用一个诊断工具（Pod 状态、日志、指标或配置）
**Validates: Requirements 3.1**

Property 4: 日志读取限制在指定行数
*For any* 日志读取请求，返回的日志行数应当不超过指定的最大行数（默认 1000 行）
**Validates: Requirements 3.2**

Property 5: 工具调用失败返回错误信息
*For any* 失败的工具调用，系统应当返回包含错误描述的 ToolResult 对象，且 success 字段为 false
**Validates: Requirements 3.5**

Property 6: 流式响应逐步追加内容
*For any* AI 生成的响应，内容应当以多个 chunk 的形式逐步追加，而不是一次性返回完整内容
**Validates: Requirements 2.5**

Property 7: 关闭面板断开 WebSocket 连接
*For any* 打开的诊断面板，当用户关闭面板时，WebSocket 连接应当被正确断开且不再接收消息
**Validates: Requirements 1.5**

## Error Handling

### Frontend Error Handling

1. **WebSocket 连接错误**
   - 显示友好的错误提示
   - 提供重试按钮
   - 自动重连机制（最多 3 次）

2. **消息发送失败**
   - 显示发送失败提示
   - 保留用户输入内容
   - 允许重新发送

3. **渲染错误**
   - 使用 Error Boundary 捕获
   - 显示降级 UI
   - 记录错误日志

### Backend Error Handling

1. **LLM 调用失败**
   - 返回友好的错误消息
   - 记录详细错误日志
   - 支持降级到简单规则引擎

2. **工具调用失败**
   - 捕获并格式化错误
   - 返回结构化错误信息
   - 继续执行其他工具

3. **Kubernetes API 错误**
   - 处理权限不足
   - 处理资源不存在
   - 处理网络超时

### Error Response Format

```typescript
interface ErrorResponse {
  code: string
  message: string
  details?: unknown
  retryable: boolean
}
```

## Testing Strategy

### Unit Testing

**Frontend**
- 组件渲染测试（React Testing Library）
- WebSocket 消息处理测试（Mock WebSocket）
- 输入验证测试
- 错误处理测试

**Backend**
- 工具执行测试（Mock Kubernetes API）
- 消息路由测试
- 错误处理测试
- LLM 客户端测试（Mock LLM 响应）

### Property-Based Testing

使用 **fast-check** 库进行属性测试，每个测试运行至少 100 次迭代。

**测试配置：**
```typescript
import fc from 'fast-check'

// 配置
const testConfig = {
  numRuns: 100,
  verbose: true
}
```

**Property 1: WebSocket 连接建立后可发送消息**
```typescript
// Feature: ai-diagnostic-assistant, Property 1: WebSocket 连接建立后可发送消息
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),  // 有效的服务 ID
    fc.string({ minLength: 1 }),  // 有效的消息内容
    async (serviceId, message) => {
      const ws = await connectWebSocket(serviceId)
      const result = await ws.send({ type: 'diagnostic_request', payload: { serviceId, message } })
      expect(result.success).toBe(true)
      ws.close()
    }
  ),
  testConfig
)
```

**Property 2: 空输入被正确拒绝**
```typescript
// Feature: ai-diagnostic-assistant, Property 2: 空输入被正确拒绝
fc.assert(
  fc.property(
    fc.oneof(
      fc.constant(''),
      fc.stringOf(fc.constantFrom(' ', '\t', '\n'))
    ),
    (input) => {
      const result = validateInput(input)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    }
  ),
  testConfig
)
```

**Property 3: 诊断请求触发工具调用**
```typescript
// Feature: ai-diagnostic-assistant, Property 3: 诊断请求触发工具调用
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),  // 服务 ID
    fc.string({ minLength: 10 }),  // 诊断问题描述
    async (serviceId, message) => {
      const toolCalls: string[] = []
      const agent = new AIAgentService({
        onToolCall: (name) => toolCalls.push(name)
      })
      
      await agent.diagnose({ serviceId, message })
      expect(toolCalls.length).toBeGreaterThan(0)
    }
  ),
  testConfig
)
```

**Property 4: 日志读取限制在指定行数**
```typescript
// Feature: ai-diagnostic-assistant, Property 4: 日志读取限制在指定行数
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),  // 服务 ID
    fc.integer({ min: 1, max: 10000 }),  // 最大行数
    async (serviceId, maxLines) => {
      const result = await getServiceLogs({ serviceId, lines: maxLines })
      const actualLines = result.logs.split('\n').length
      expect(actualLines).toBeLessThanOrEqual(maxLines)
    }
  ),
  testConfig
)
```

**Property 5: 工具调用失败返回错误信息**
```typescript
// Feature: ai-diagnostic-assistant, Property 5: 工具调用失败返回错误信息
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),  // 工具名称
    fc.record({  // 无效参数
      serviceId: fc.constant('invalid-service-id')
    }),
    async (toolName, params) => {
      const registry = new ToolRegistry()
      const result = await registry.execute(toolName, params, { serviceId: params.serviceId, namespace: 'default' })
      
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(typeof result.error).toBe('string')
      }
    }
  ),
  testConfig
)
```

**Property 6: 流式响应逐步追加内容**
```typescript
// Feature: ai-diagnostic-assistant, Property 6: 流式响应逐步追加内容
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),  // 服务 ID
    fc.string({ minLength: 10 }),  // 消息
    async (serviceId, message) => {
      const chunks: string[] = []
      const agent = new AIAgentService()
      
      for await (const chunk of agent.diagnose({ serviceId, message })) {
        if (chunk.type === 'text' && chunk.content) {
          chunks.push(chunk.content)
        }
      }
      
      // 应当有多个 chunk
      expect(chunks.length).toBeGreaterThan(1)
      
      // 每个 chunk 应当是部分内容
      const fullContent = chunks.join('')
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThan(fullContent.length)
      })
    }
  ),
  testConfig
)
```

**Property 7: 关闭面板断开 WebSocket 连接**
```typescript
// Feature: ai-diagnostic-assistant, Property 7: 关闭面板断开 WebSocket 连接
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),  // 服务 ID
    async (serviceId) => {
      const ws = await connectWebSocket(serviceId)
      expect(ws.readyState).toBe(WebSocket.OPEN)
      
      ws.close()
      
      // 等待关闭完成
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(ws.readyState).toBe(WebSocket.CLOSED)
    }
  ),
  testConfig
)
```

### Integration Testing

1. **端到端流程测试**
   - 打开诊断面板 → 发送消息 → 接收响应 → 关闭面板
   - 使用真实的 WebSocket 连接
   - Mock LLM 和 Kubernetes API

2. **工具链集成测试**
   - 测试每个工具与 Kubernetes API 的集成
   - 使用测试集群或 Mock 数据

3. **错误场景测试**
   - 网络断开
   - API 超时
   - 权限不足

## Implementation Notes

### LLM Prompt Engineering

系统提示词模板：

```
你是一个 Kubernetes 服务诊断专家。你的任务是帮助用户诊断和解决服务问题。

你可以使用以下工具：
- getPodStatus: 获取 Pod 状态和事件
- getServiceLogs: 获取服务日志
- getResourceMetrics: 获取资源使用情况
- getDeploymentConfig: 获取部署配置

当用户描述问题时，你应该：
1. 理解问题的核心
2. 选择合适的工具收集信息
3. 分析收集到的数据
4. 提供清晰的诊断结果和建议

请用中文回复，保持专业和友好的语气。
```

### WebSocket Server Implementation

使用现有的 `websocket-server.js`，扩展消息处理逻辑：

```typescript
// 添加新的消息类型处理
wss.on('connection', (ws, req) => {
  ws.on('message', async (data) => {
    const message = JSON.parse(data.toString())
    
    if (message.type === 'diagnostic_request') {
      await handleDiagnosticRequest(ws, message.payload)
    }
  })
})

async function handleDiagnosticRequest(ws: WebSocket, payload: any) {
  const agent = new AIAgentService()
  
  try {
    for await (const chunk of agent.diagnose(payload)) {
      ws.send(JSON.stringify({
        type: 'diagnostic_response',
        payload: chunk
      }))
    }
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: error.message }
    }))
  }
}
```

### Performance Considerations

1. **日志读取优化**
   - 限制最大行数（1000 行）
   - 使用流式读取避免内存溢出
   - 添加超时机制（30 秒）

2. **WebSocket 连接管理**
   - 设置心跳检测（30 秒）
   - 自动清理空闲连接（5 分钟）
   - 限制每个用户的并发连接数（3 个）

3. **LLM 调用优化**
   - 使用流式响应减少首字节时间
   - 设置合理的 token 限制（最大 2000 tokens）
   - 实现请求队列避免过载

### Security Considerations

1. **权限验证**
   - 验证用户是否有权访问指定服务
   - 使用 JWT 或 Session 进行身份验证

2. **输入过滤**
   - 过滤敏感信息（密码、token）
   - 限制输入长度（最大 1000 字符）
   - 防止注入攻击

3. **日志脱敏**
   - 自动检测并脱敏敏感信息
   - 记录审计日志

## Deployment

### Local LLM Setup

推荐使用 Ollama 部署本地模型：

```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 拉取推荐模型
ollama pull qwen2.5:7b

# 启动服务（默认端口 11434）
ollama serve
```

### Environment Variables

```env
# AI 配置
AI_PROVIDER=ollama  # 或 openai
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b

# OpenAI 配置（可选）
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4

# WebSocket 配置
WS_PORT=3001
WS_HEARTBEAT_INTERVAL=30000

# 工具配置
MAX_LOG_LINES=1000
TOOL_TIMEOUT=30000
```

### Docker Deployment

```dockerfile
# 在现有 Dockerfile 中添加 AI 依赖
RUN npm install @ai-sdk/openai langchain fast-check
```

## Future Enhancements

以下功能将在 MVP 后实现：

1. **自动修复能力**（需求 4）
   - 定义修复操作模板
   - 实现操作确认机制
   - 添加回滚功能

2. **会话管理**（需求 5）
   - 持久化会话到数据库
   - 实现会话列表和搜索
   - 支持会话恢复

3. **实时监听**（需求 7）
   - 订阅 Kubernetes 事件
   - 实现日志流式监听
   - 主动问题检测

4. **知识库**（需求 11）
   - 向量数据库集成
   - 案例检索和推荐
   - 反馈学习机制
