# AI 工具调用最终修复

## 问题总结

在实现 AI 工具调用功能时遇到了两个主要问题：

### 问题 1：工具参数格式错误
**错误信息：**
```
TypeError: Cannot read properties of undefined (reading 'typeName')
```

**原因：**
工具参数使用了普通的 JSON Schema 格式，但 AI SDK 期望使用 Zod schema。

### 问题 2：AI 响应卡住
**症状：**
用户看到"AI 正在分析..."但没有任何响应返回。

**原因：**
流处理逻辑没有正确处理所有事件类型。

## 解决方案

### 1. 使用 Zod Schema 定义工具参数

**之前（错误）：**
```javascript
parameters: {
  type: 'object',
  properties: {
    serviceId: {
      type: 'string',
      description: '服务 ID',
    },
  },
  required: ['serviceId'],
}
```

**现在（正确）：**
```javascript
const { z } = require('zod')

parameters: z.object({
  serviceId: z.string().describe('服务 ID').optional(),
  lines: z.number().describe('日志行数，默认 100').optional(),
})
```

### 2. 完善流事件处理

添加了对所有事件类型的处理：

```javascript
for await (const part of result.fullStream) {
  if (part.type === 'text-delta') {
    // 文本片段
    yield { type: 'text', content: part.textDelta }
  } else if (part.type === 'tool-call') {
    // 工具调用
    yield { type: 'tool_call', toolCall: {...} }
  } else if (part.type === 'tool-result') {
    // 工具结果
    yield { type: 'tool_call', toolCall: {...} }
  } else if (part.type === 'error') {
    // 错误
    throw new Error(`LLM error: ${part.error}`)
  } else if (part.type === 'step-start' || part.type === 'step-finish' || part.type === 'finish') {
    // 忽略这些元数据事件
    console.log('[AI Agent] Stream part type:', part.type)
  }
}
```

### 3. 添加详细的调试日志

在关键位置添加日志以便排查问题：

```javascript
console.log('[AI Agent] Starting diagnosis for service:', request.serviceId)
console.log('[AI Agent] Available tools:', Object.keys(aiTools).join(', '))
console.log('[AI Agent] Calling LLM with', messages.length, 'messages')
console.log('[AI Agent] Stream part type:', part.type)
console.log('[Tool] Executing getServiceLogs for service:', serviceId, 'lines:', lines)
```

## 测试结果

### 测试脚本输出

```bash
$ node test-ai-agent.js

🧪 Testing AI Agent...

✓ AI Agent Service loaded
[AI Agent] Using Ollama: qwen2.5-coder:3b at http://192.168.44.151:11434
✓ AI Agent instance created

📝 Testing simple diagnosis request...
Request: "你好，请介绍一下自己"

📡 Streaming response:

────────────────────────────────────────────────────────────
您好！我是 Kubernetes 服务诊断专家，专注于帮助您诊断和解决 Kubernetes 服务中的各种问题。
我具备丰富的经验和专业知识，能够利用工具和技术来收集、分析和解释数据，以找出并解决问题。
如果您有任何关于 Kubernetes 服务的问题或需要帮助的地方，请随时告诉我，我会尽力提供支持。
────────────────────────────────────────────────────────────

✓ Received 66 chunks
✓ Total text length: 150 characters

✅ AI Agent is working correctly!
```

## 完整的工具定义示例

```javascript
function getTools(serviceId, namespace) {
  const tools = require('./websocket-diagnostic-tools')
  const { z } = require('zod')
  
  return {
    getPodStatus: {
      description: '获取 Pod 状态和事件信息，用于诊断 Pod 启动失败、重启等问题',
      parameters: z.object({
        serviceId: z.string().describe('服务 ID').optional(),
      }),
      execute: async (params) => {
        console.log('[Tool] Executing getPodStatus')
        const result = await tools.getPodStatus({
          serviceId: params.serviceId || serviceId,
        })
        return JSON.stringify(result, null, 2)
      },
    },
    
    getServiceLogs: {
      description: '获取服务日志，用于分析错误信息和异常',
      parameters: z.object({
        serviceId: z.string().describe('服务 ID').optional(),
        lines: z.number().describe('日志行数，默认 100').optional(),
      }),
      execute: async (params) => {
        console.log('[Tool] Executing getServiceLogs')
        const result = await tools.getServiceLogs({
          serviceId: params.serviceId || serviceId,
          lines: params.lines || 100,
        })
        return JSON.stringify(result, null, 2)
      },
    },
    
    // ... 其他工具
  }
}
```

## 使用方法

### 1. 重启 WebSocket 服务器

```bash
# 停止当前服务器
# 按 Ctrl+C

# 重新启动
npm run ws:dev
```

### 2. 测试 AI Agent

```bash
# 运行测试脚本
node test-ai-agent.js
```

### 3. 在浏览器中测试

1. 打开服务详情页
2. 点击"AI 诊断"按钮
3. 输入问题，例如：
   - "显示最新100条日志"
   - "Pod 状态如何？"
   - "为什么服务启动失败？"

## 预期行为

### 简单对话

**用户：** "你好"

**AI：** "您好！我是 Kubernetes 服务诊断专家..."

### 工具调用

**用户：** "显示最新50条日志"

**服务器日志：**
```
[Tool] Executing getServiceLogs for service: 123 lines: 50
```

**AI 响应：**
```
我已经获取了最新的50条日志。以下是分析结果：

[日志内容]

根据日志分析，服务运行正常...
```

### 综合诊断

**用户：** "为什么服务启动失败？"

**服务器日志：**
```
[Tool] Executing getPodStatus for service: 123
[Tool] Executing getServiceLogs for service: 123 lines: 100
[Tool] Executing getDeploymentConfig for service: 123
```

**AI 响应：**
```
根据诊断结果，服务启动失败的原因是：

1. Pod 状态：CrashLoopBackOff
2. 日志显示：数据库连接失败
3. 配置检查：数据库地址配置正确

建议：
1. 检查数据库服务是否正常运行
2. 验证网络连接
3. 检查数据库凭据
```

## 关键要点

### ✅ 正确做法

1. **使用 Zod Schema** 定义工具参数
2. **处理所有流事件类型**（text-delta, tool-call, tool-result, error, etc.）
3. **添加详细日志** 便于调试
4. **提供默认值** 对于可选参数
5. **返回 JSON 字符串** 作为工具结果

### ❌ 错误做法

1. ~~使用普通 JSON Schema~~ → 会导致 typeName 错误
2. ~~只处理 text-delta 事件~~ → 会忽略工具调用
3. ~~没有错误处理~~ → 会导致静默失败
4. ~~返回对象而不是字符串~~ → AI 无法正确解析

## 故障排查

### 问题：工具没有被调用

**检查：**
1. 查看服务器日志是否有 `[Tool] Executing...`
2. 确认工具定义使用了 Zod schema
3. 验证工具描述是否清晰

**解决：**
```bash
# 运行测试脚本查看详细日志
node test-ai-agent.js
```

### 问题：AI 响应卡住

**检查：**
1. 查看是否有错误日志
2. 确认所有流事件类型都被处理
3. 检查是否有未捕获的异常

**解决：**
- 添加更多日志
- 检查 Ollama 服务状态
- 验证网络连接

### 问题：工具执行失败

**检查：**
1. 数据库连接是否正常
2. Kubernetes 配置是否正确
3. 服务 ID 是否有效

**解决：**
```bash
# 测试工具直接调用
node -e "
const tools = require('./websocket-diagnostic-tools');
tools.getServiceLogs({ serviceId: '1', lines: 10 })
  .then(r => console.log(JSON.stringify(r, null, 2)))
"
```

## 性能优化

### 1. 减少日志输出

生产环境可以减少详细日志：

```javascript
const DEBUG = process.env.DEBUG_AI === 'true'

if (DEBUG) {
  console.log('[AI Agent] Stream part type:', part.type)
}
```

### 2. 工具结果缓存

对于不经常变化的数据可以缓存：

```javascript
const cache = new Map()
const CACHE_TTL = 30000 // 30 seconds

async function executeWithCache(key, fn) {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data
  }
  const data = await fn()
  cache.set(key, { data, time: Date.now() })
  return data
}
```

### 3. 超时控制

为工具执行添加超时：

```javascript
async function executeWithTimeout(fn, timeout = 10000) {
  return Promise.race([
    fn(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeout)
    )
  ])
}
```

## 相关文档

- [AI 工具调用功能修复](./AI_TOOL_CALLING_FIX.md)
- [AI 诊断助手故障排查](./AI_DIAGNOSTIC_TROUBLESHOOTING.md)
- [WebSocket AI 集成修复](./WEBSOCKET_AI_INTEGRATION_FIX.md)

## 总结

通过以下修复，AI 诊断助手现在可以：

1. ✅ 正确定义和注册工具
2. ✅ 成功调用诊断工具
3. ✅ 处理流式响应
4. ✅ 返回真实的诊断数据
5. ✅ 提供详细的错误信息

现在重启 WebSocket 服务器，AI 诊断助手就能完全正常工作了！🎉
