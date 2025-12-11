# AI 工具调用功能修复

## 问题描述

AI 诊断助手虽然能够响应用户问题，但无法实际调用诊断工具（如 `getServiceLogs`、`getPodStatus` 等）来获取真实数据。AI 只是说"我将使用工具"，但实际上没有执行任何工具调用。

### 症状

用户询问："直接显示最新100条日志"

AI 响应：
```
好的，我将使用 getServiceLogs 工具来获取 jdk17 服务的最近 100 条日志。
请稍等片刻，收集数据并提供结果。
诊断结果和建议将会在这段话中给出。
```

但实际上：
- ❌ 没有调用 `getServiceLogs` 工具
- ❌ 没有返回真实的日志数据
- ❌ 只是生成了文本描述

## 根本原因

1. **缺少工具集成**：原始的 `websocket-ai-agent.js` 只是简单调用 LLM，没有配置工具
2. **TypeScript 导入问题**：工具文件是 TypeScript，无法直接在 CommonJS 中使用
3. **AI SDK 配置不完整**：没有正确配置 `tools` 参数和 `maxSteps`

## 解决方案

### 1. 创建 CommonJS 版本的诊断工具

创建了 `websocket-diagnostic-tools.js`，包含所有诊断工具的 CommonJS 实现：

**实现的工具：**
- ✅ `getPodStatus` - 获取 Pod 状态和事件
- ✅ `getServiceLogs` - 获取服务日志
- ✅ `getResourceMetrics` - 获取资源使用情况
- ✅ `getDeploymentConfig` - 获取部署配置

**特性：**
- 完全 CommonJS 兼容
- 直接使用 Kubernetes API
- 从数据库获取服务信息
- 详细的错误处理

### 2. 更新 AI Agent 支持工具调用

更新了 `websocket-ai-agent.js` 的 `diagnose` 方法：

**关键改进：**

```javascript
// 定义工具
const tools = getTools(serviceId, namespace)

// 转换为 AI SDK 格式
const aiTools = {}
for (const [name, tool] of Object.entries(tools)) {
  aiTools[name] = {
    description: tool.description,
    parameters: tool.parameters,
    execute: tool.execute,
  }
}

// 调用 LLM 时传入工具
const result = await streamText({
  model: this.model,
  messages,
  tools: aiTools,        // ← 关键：传入工具
  temperature: 0.7,
  maxTokens: 2000,
  maxSteps: 5,           // ← 关键：允许多步工具调用
})

// 处理工具调用和结果
for await (const part of result.fullStream) {
  if (part.type === 'text-delta') {
    // 文本内容
  } else if (part.type === 'tool-call') {
    // 工具调用开始
  } else if (part.type === 'tool-result') {
    // 工具调用结果
  }
}
```

### 3. 工具定义格式

每个工具都遵循标准格式：

```javascript
{
  description: '工具描述，告诉 AI 何时使用',
  parameters: {
    type: 'object',
    properties: {
      serviceId: {
        type: 'string',
        description: '参数描述',
      },
      lines: {
        type: 'number',
        description: '可选参数',
      },
    },
    required: ['serviceId'],
  },
  execute: async (params) => {
    // 实际执行逻辑
    const result = await tools.getServiceLogs(params)
    return JSON.stringify(result, null, 2)
  },
}
```

## 工作流程

### 完整的工具调用流程

1. **用户发送问题**
   ```
   用户: "显示最新100条日志"
   ```

2. **AI 理解意图并决定调用工具**
   ```
   AI 内部: 需要调用 getServiceLogs 工具
   ```

3. **执行工具调用**
   ```javascript
   [Tool] Executing getServiceLogs for service: 123 lines: 100
   ```

4. **获取真实数据**
   ```javascript
   {
     success: true,
     data: {
       logs: "2024-12-05 14:30:00 INFO Starting application...\n...",
       truncated: false,
       totalLines: 100
     }
   }
   ```

5. **AI 分析数据并生成响应**
   ```
   AI: "我已经获取了最新的100条日志。以下是分析结果：
   
   日志显示应用程序正常启动，没有发现错误..."
   ```

6. **流式返回给用户**
   - 工具调用通知
   - 工具执行结果
   - AI 分析文本

## 测试验证

### 1. 重启 WebSocket 服务器

```bash
# 停止当前服务器
# 按 Ctrl+C

# 重新启动
npm run ws:dev
```

### 2. 预期日志输出

```
[AI] Initializing AI Agent Service...
[AI Integration] ✓ AI Agent Service loaded successfully
[AI Agent] Using Ollama: qwen2.5-coder:3b at http://192.168.44.151:11434
[AI] ✓ AI Agent Service initialized successfully
[WebSocket] Server listening on port 3001
```

### 3. 测试工具调用

打开 AI 诊断面板，发送以下问题：

**测试 1：获取日志**
```
用户: "显示最新50条日志"
```

**预期行为：**
- ✅ 看到"正在调用工具..."的提示
- ✅ 看到工具执行日志：`[Tool] Executing getServiceLogs`
- ✅ 收到真实的日志内容
- ✅ AI 分析日志内容

**测试 2：获取 Pod 状态**
```
用户: "这个服务的 Pod 状态如何？"
```

**预期行为：**
- ✅ 调用 `getPodStatus` 工具
- ✅ 返回 Pod 列表和状态
- ✅ 返回最近的事件
- ✅ AI 分析状态信息

**测试 3：综合诊断**
```
用户: "帮我诊断一下为什么服务启动失败"
```

**预期行为：**
- ✅ 可能调用多个工具（Pod 状态、日志、配置）
- ✅ 综合分析所有数据
- ✅ 提供诊断结论和建议

## 工具调用示例

### 示例 1：获取服务日志

**用户输入：**
```
显示最新100条日志
```

**工具调用：**
```javascript
{
  tool: 'getServiceLogs',
  params: {
    serviceId: '123',
    lines: 100
  }
}
```

**工具返回：**
```json
{
  "success": true,
  "data": {
    "logs": "2024-12-05 14:30:00 INFO Application started\n2024-12-05 14:30:01 INFO Connecting to database\n...",
    "truncated": false,
    "totalLines": 100
  }
}
```

**AI 响应：**
```
我已经获取了最新的100条日志。分析如下：

1. 应用程序在 14:30:00 成功启动
2. 数据库连接正常
3. 没有发现错误或警告信息
4. 服务运行状态良好

建议：继续监控日志，如有异常会及时显示。
```

### 示例 2：诊断启动失败

**用户输入：**
```
为什么服务启动失败？
```

**工具调用序列：**

1. **getPodStatus**
   ```json
   {
     "success": true,
     "data": {
       "pods": [{
         "name": "jdk17-xxx",
         "status": "CrashLoopBackOff",
         "restartCount": 5
       }],
       "events": [{
         "type": "Warning",
         "reason": "BackOff",
         "message": "Back-off restarting failed container"
       }]
     }
   }
   ```

2. **getServiceLogs**
   ```json
   {
     "success": true,
     "data": {
       "logs": "Error: Cannot connect to database\nConnection refused..."
     }
   }
   ```

3. **getDeploymentConfig**
   ```json
   {
     "success": true,
     "data": {
       "env": [
         {"name": "DB_HOST", "value": "mysql"},
         {"name": "DB_PORT", "value": "3306"}
       ]
     }
   }
   ```

**AI 综合分析：**
```
根据诊断结果，服务启动失败的原因是：

🔴 问题：Pod 处于 CrashLoopBackOff 状态，已重启5次

📋 根本原因：
1. 日志显示"Cannot connect to database"
2. 数据库连接被拒绝

🔧 可能的解决方案：
1. 检查数据库服务是否正常运行
2. 验证数据库连接配置（DB_HOST=mysql, DB_PORT=3306）
3. 确认网络策略允许服务访问数据库
4. 检查数据库凭据是否正确

💡 建议：
先检查数据库服务状态，然后验证网络连接。
```

## 技术细节

### AI SDK 工具调用机制

AI SDK 使用以下机制处理工具调用：

1. **工具注册**：将工具定义传递给 `streamText`
2. **意图识别**：LLM 决定是否需要调用工具
3. **参数生成**：LLM 生成工具调用参数
4. **工具执行**：SDK 调用 `execute` 函数
5. **结果返回**：将结果返回给 LLM
6. **继续生成**：LLM 基于工具结果继续生成响应

### 流式处理

使用 `fullStream` 而不是 `textStream` 来获取完整的事件流：

```javascript
for await (const part of result.fullStream) {
  switch (part.type) {
    case 'text-delta':
      // 文本片段
      break
    case 'tool-call':
      // 工具调用开始
      break
    case 'tool-result':
      // 工具调用结果
      break
  }
}
```

### 错误处理

每个工具都有完善的错误处理：

```javascript
try {
  const result = await tools.getServiceLogs(params)
  return JSON.stringify(result, null, 2)
} catch (error) {
  console.error('[Tool] Error:', error)
  return JSON.stringify({
    success: false,
    error: error.message
  })
}
```

## 性能考虑

### 工具调用限制

- `maxSteps: 5` - 最多5步工具调用
- 防止无限循环
- 平衡功能和性能

### 日志行数限制

- 默认：100 行
- 最大：1000 行
- 防止数据过大

### 超时保护

WebSocket 处理器中已有60秒超时：

```javascript
const timeout = setTimeout(() => {
  ws.send(JSON.stringify({
    type: 'error',
    payload: { message: '诊断请求超时' }
  }))
}, 60000)
```

## 故障排查

### 问题：工具没有被调用

**检查：**
1. WebSocket 服务器日志中是否有 `[Tool] Executing...`
2. AI 响应中是否提到工具名称
3. 模型是否支持工具调用（Ollama 需要较新版本）

**解决：**
- 确保使用支持工具调用的模型
- 检查工具定义格式是否正确
- 查看 AI SDK 版本是否最新

### 问题：工具调用失败

**检查：**
1. Kubernetes 配置是否正确
2. 数据库连接是否正常
3. 服务 ID 是否有效

**解决：**
- 查看工具执行日志
- 验证 K8s 权限
- 测试数据库连接

### 问题：响应速度慢

**原因：**
- 工具调用需要时间
- 多个工具调用会累加

**优化：**
- 使用更快的模型
- 减少 `maxSteps`
- 优化工具执行逻辑

## 下一步改进

### 1. 工具结果缓存

```javascript
const toolCache = new Map()

async function executeWithCache(toolName, params) {
  const key = `${toolName}:${JSON.stringify(params)}`
  if (toolCache.has(key)) {
    return toolCache.get(key)
  }
  const result = await executeTool(toolName, params)
  toolCache.set(key, result)
  return result
}
```

### 2. 并行工具调用

```javascript
// 同时调用多个工具
const [podStatus, logs] = await Promise.all([
  getPodStatus(params),
  getServiceLogs(params)
])
```

### 3. 工具调用统计

```javascript
const toolStats = {
  getPodStatus: { calls: 0, errors: 0, avgTime: 0 },
  getServiceLogs: { calls: 0, errors: 0, avgTime: 0 },
  // ...
}
```

### 4. 智能工具选择

根据问题类型自动推荐工具：
- "日志" → `getServiceLogs`
- "状态" → `getPodStatus`
- "配置" → `getDeploymentConfig`

## 相关文档

- [AI 诊断助手快速开始](./AI_DIAGNOSTIC_QUICK_START.md)
- [AI 诊断助手完整配置](./AI_DIAGNOSTIC_LLM_SETUP.md)
- [WebSocket AI 集成修复](./WEBSOCKET_AI_INTEGRATION_FIX.md)
- [故障排查指南](./AI_DIAGNOSTIC_TROUBLESHOOTING.md)

## 总结

通过实现完整的工具调用功能，AI 诊断助手现在可以：

1. ✅ 真正调用诊断工具获取数据
2. ✅ 分析真实的服务状态和日志
3. ✅ 提供基于实际数据的诊断建议
4. ✅ 支持多步骤的复杂诊断流程

这使得 AI 诊断助手从"聊天机器人"升级为"真正的诊断工具"！🎉
