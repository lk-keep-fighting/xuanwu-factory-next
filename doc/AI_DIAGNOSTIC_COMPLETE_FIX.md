# AI 诊断助手完整修复总结

## 问题历程

### 问题 1: 模块系统不兼容 ✅ 已修复
**症状:** `TypeError: AIAgentService is not a constructor`
**原因:** WebSocket 服务器（CommonJS）无法导入 TypeScript 模块
**解决:** 创建了 `websocket-ai-agent.js` 和 `websocket-ai-integration.js`

### 问题 2: 工具参数格式错误 ✅ 已修复
**症状:** `TypeError: Cannot read properties of undefined (reading 'typeName')`
**原因:** 使用了普通 JSON Schema 而不是 Zod schema
**解决:** 改用 Zod schema 定义工具参数

### 问题 3: 工具调用没有返回结果 ✅ 已修复
**症状:** AI 说要调用工具但卡住，没有返回
**原因:** 多个问题：
1. `getServiceLogs` 函数忘记 `return result`
2. Service ID 类型处理错误（UUID vs Integer）
3. Service 缺少 namespace 字段
4. K8s API 调用使用了错误的参数格式（位置参数 vs 对象参数）

### 问题 4: 小模型输出 JSON 而不是调用工具 ✅ 已修复
**症状:** 前端显示 JSON 字符串后卡住，没有后续响应
**原因:** Ollama 小模型（qwen2.5-coder:3b）不支持原生函数调用，会将工具调用输出为 JSON 文本
**解决:** 检测 JSON 格式的工具调用，手动解析和执行，然后再次调用 AI 分析结果

## 最终修复

### 1. 修复 getServiceLogs 返回值

**问题:**
```javascript
const result = {
  success: true,
  data: { ... }
}
// 忘记 return！
```

**修复:**
```javascript
const result = {
  success: true,
  data: { ... }
}
return result // ✅ 添加 return
```

### 2. 修复 Service ID 类型处理

**问题:**
```javascript
const service = await prisma.service.findUnique({
  where: { id: parseInt(serviceId) } // ❌ UUID 无法转换为 int
})
```

**修复:**
```javascript
// Service ID 可以是 UUID 字符串或整数
const where = serviceId.includes('-') 
  ? { id: serviceId } // UUID 字符串
  : { id: parseInt(serviceId) } // 整数 ID
```

### 3. 添加 namespace 字段

**问题:**
Service 模型中没有 namespace 字段

**修复:**
```javascript
const service = await prisma.service.findUnique({ 
  where,
  include: {
    project: true, // 包含 project 以获取 namespace
  }
})

// 从 project 添加 namespace
service.namespace = service.project?.namespace || 'default'
```

### 4. 修复 K8s API 调用格式

**问题:**
```javascript
// ❌ 使用位置参数
await coreApi.listNamespacedPod(
  namespace,
  undefined,
  undefined,
  undefined,
  undefined,
  labelSelector
)
```

**修复:**
```javascript
// ✅ 使用对象参数
await coreApi.listNamespacedPod({
  namespace,
  labelSelector
})
```

### 5. 处理 K8s API 响应格式

**问题:**
响应可能直接包含数据或在 `body` 属性中

**修复:**
```javascript
// 兼容两种格式
const pods = podsResponse.items || podsResponse.body?.items || []
const logs = typeof logsResponse === 'string' ? logsResponse : (logsResponse.body || '')
```

## 测试验证

### 工具测试
```bash
$ node test-diagnostic-tools.js

✅ getServiceLogs works!
```

### AI Agent 测试
```bash
$ node test-ai-agent.js

✅ AI Agent is working correctly!
✓ Received 66 chunks
✓ Total text length: 150 characters
```

## 使用方法

### 1. 重启 WebSocket 服务器

```bash
# 停止当前服务器
# 按 Ctrl+C

# 重新启动
npm run ws:dev
```

### 2. 预期日志

```
[AI] Initializing AI Agent Service...
[AI Integration] ✓ AI Agent Service loaded successfully
[AI Agent] Using Ollama: qwen2.5-coder:3b at http://192.168.44.151:11434
[AI] ✓ AI Agent Service initialized successfully
[WebSocket] Server listening on port 3001
```

### 3. 测试工具调用

在 AI 诊断面板中输入：

**"显示最新100条日志"**

**预期服务器日志:**
```
[Tool] Executing getServiceLogs for service: xxx lines: 100
[getServiceLogs] Starting with params: {"serviceId":"xxx","lines":100}
[getServiceLogs] Getting service: xxx
[getServiceLogs] Service found: jdk17 namespace: default
[getServiceLogs] Listing pods in namespace: default with label app=jdk17
[getServiceLogs] Found 1 pods
[getServiceLogs] Reading logs from pod: jdk17-xxx
[getServiceLogs] Logs retrieved, processing...
[getServiceLogs] Total lines: 100
[getServiceLogs] Returning result, truncated: false
```

**预期 AI 响应:**
```
我已经获取了最新的100条日志。以下是分析结果：

[日志内容]

根据日志分析...
```

## 关键修复点总结

| 问题 | 文件 | 修复 |
|------|------|------|
| 缺少 return 语句 | `websocket-diagnostic-tools.js` | 添加 `return result` |
| UUID vs Int | `websocket-diagnostic-tools.js` | 检测并处理两种 ID 类型 |
| 缺少 namespace | `websocket-diagnostic-tools.js` | 从 project 获取 namespace |
| K8s API 参数 | `websocket-diagnostic-tools.js` | 使用对象参数而不是位置参数 |
| 响应格式 | `websocket-diagnostic-tools.js` | 兼容 `items` 和 `body.items` |
| Zod schema | `websocket-ai-agent.js` | 使用 Zod 定义工具参数 |

## 完整的工作流程

```
用户: "显示最新100条日志"
  ↓
AI: 理解意图 → 决定调用 getServiceLogs
  ↓
工具: 
  1. 从数据库获取服务信息（包含 namespace）
  2. 初始化 K8s 客户端
  3. 列出 Pod
  4. 读取日志
  5. 返回结果
  ↓
AI: 分析日志数据 → 生成诊断报告
  ↓
用户: 收到真实的日志和分析结果 ✅
```

## 故障排查

### 问题：工具调用没有日志输出

**检查:**
```bash
# 查看 WebSocket 服务器日志
# 应该看到 [Tool] Executing... 和 [getServiceLogs] ... 日志
```

**解决:**
- 确认 WebSocket 服务器已重启
- 检查是否有错误日志

### 问题：找不到 Pod

**症状:**
```
[getServiceLogs] Found 0 pods
```

**原因:**
- 服务可能没有运行
- Label selector 可能不匹配

**解决:**
```bash
# 检查 Pod
kubectl get pods -n default -l app=jdk17

# 如果没有 Pod，启动服务
```

### 问题：数据库连接错误

**症状:**
```
PrismaClientValidationError: ...
```

**解决:**
- 检查 DATABASE_URL 环境变量
- 确认数据库可访问

## 性能优化建议

### 1. 减少详细日志（生产环境）

```javascript
const DEBUG = process.env.DEBUG_TOOLS === 'true'

if (DEBUG) {
  console.log('[getServiceLogs] ...')
}
```

### 2. 添加缓存

```javascript
const serviceCache = new Map()

async function getServiceCached(serviceId) {
  if (serviceCache.has(serviceId)) {
    return serviceCache.get(serviceId)
  }
  const service = await getService(serviceId)
  serviceCache.set(serviceId, service)
  return service
}
```

### 3. 并行获取数据

```javascript
// 同时获取 Pod 状态和日志
const [podStatus, logs] = await Promise.all([
  getPodStatus({ serviceId }),
  getServiceLogs({ serviceId, lines: 100 })
])
```

## 相关文档

- [AI 工具调用最终修复](./AI_TOOL_CALLING_FINAL_FIX.md)
- [AI 工具调用功能修复](./AI_TOOL_CALLING_FIX.md)
- [WebSocket AI 集成修复](./WEBSOCKET_AI_INTEGRATION_FIX.md)
- [故障排查指南](./AI_DIAGNOSTIC_TROUBLESHOOTING.md)

## 总结

经过以下修复，AI 诊断助手现在完全可以工作：

1. ✅ 模块系统兼容（CommonJS ↔ TypeScript）
2. ✅ 工具参数正确定义（Zod schema）
3. ✅ 工具执行正常返回结果
4. ✅ Service ID 类型正确处理
5. ✅ Namespace 正确获取
6. ✅ K8s API 调用格式正确
7. ✅ 响应格式兼容处理
8. ✅ 小模型 JSON 工具调用支持

现在重启 WebSocket 服务器，AI 诊断助手就能完全正常工作，包括真实的工具调用和数据分析！🎉

## 相关文档

- [AI JSON 工具调用修复](./AI_JSON_TOOL_CALL_FIX.md) - 最新修复
- [AI 工具调用最终修复](./AI_TOOL_CALLING_FINAL_FIX.md)
- [AI 工具调用功能修复](./AI_TOOL_CALLING_FIX.md)
- [WebSocket AI 集成修复](./WEBSOCKET_AI_INTEGRATION_FIX.md)
- [故障排查指南](./AI_DIAGNOSTIC_TROUBLESHOOTING.md)
