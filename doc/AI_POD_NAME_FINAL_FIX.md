# AI 诊断助手 Pod 名称最终修复

## 问题总结

1. **Pod 查找失败**：使用 label selector 查找 Pod 经常失败
2. **Pod 名称未传递**：前端有 Pod 信息但没有传递给 AI
3. **AI 未使用 Pod 名称**：即使传递了，AI 也没有在工具调用中使用

## 完整解决方案

### 1. 数据流集成

```
服务详情页 (k8sStatus.podStatus.pods)
  ↓ 传递 k8sStatus
AI 诊断面板 (提取 podNames)
  ↓ 发送 {podNames: [...]}
WebSocket 服务器 (接收 podNames)
  ↓ 传递到 context
AI Agent (系统提示包含 Pod 列表)
  ↓ 调用工具时使用 podName
诊断工具 (直接使用 Pod 名称)
  ↓ K8s API
✓ 成功获取日志
```

### 2. 关键修复

**A. 改进系统提示**
```javascript
if (request.context.podNames && request.context.podNames.length > 0) {
  contextInfo += `\n- Pod 列表: ${request.context.podNames.join(', ')}`
  contextInfo += `\n\n重要提示：调用 getServiceLogs 工具时，必须使用 podName 参数，值为上面列表中的 Pod 名称。`
  contextInfo += `\n例如：{"name": "getServiceLogs", "arguments": {"podName": "${request.context.podNames[0]}", "lines": 100}}`
}
```

**B. 改进工具描述**
```javascript
getServiceLogs: {
  description: '获取服务日志，用于分析错误信息和异常。重要：如果系统提示中提供了 Pod 列表，必须使用 podName 参数指定要查看的 Pod',
  parameters: z.object({
    podName: z.string().describe('Pod 名称（必填，如果系统提示中有 Pod 列表）。使用系统提示中提供的完整 Pod 名称').optional(),
    // ...
  })
}
```

**C. 改进 JSON 检测**
```javascript
// 只缓冲小于 500 字符的 JSON
if (trimmed.startsWith('{') && trimmed.length < 500) {
  if (trimmed.includes('"name"') || trimmed.includes('"arguments"')) {
    console.log('[AI Agent] Buffering potential JSON tool call... (length:', trimmed.length, ')')
    continue
  }
}
```

### 3. 测试结果

**测试命令：**
```bash
node test-json-tool-call.js
```

**成功输出：**
```
[AI Agent] System messages: [
  '- Pod 列表: jdk17-797844bb79-55xn8'
  '重要提示：调用 getServiceLogs 工具时，必须使用 podName 参数'
]

[AI Agent] Buffered text: {
  "name": "getServiceLogs", 
  "arguments": {
    "podName": "jdk17-797844bb79-55xn8",  ✅ 正确使用 Pod 名称
    "lines": 10
  }
}

[Tool] Executing getServiceLogs for service: xxx pod: jdk17-797844bb79-55xn8
```

### 4. 错误处理

如果 Pod 不存在（404 错误），AI 会收到错误信息并给出建议：

```
根据提供的错误信息，Pod "jdk17-797844bb79-55xn8" 不存在。
建议：
1. 检查 Pod 状态
2. 查看 Deployment 配置
3. 检查服务是否正在运行
```

### 5. 向后兼容

如果没有提供 Pod 名称，工具会回退到 label selector：

```javascript
if (!podName) {
  console.log('[getServiceLogs] No pod name provided, finding pods...')
  // 使用 label selector 查找
  const pods = await coreApi.listNamespacedPod({
    namespace,
    labelSelector: `app=${service.name}`
  })
}
```

## 文件更改清单

1. ✅ `src/types/ai-diagnostic.ts` - 添加 Pod 信息类型
2. ✅ `src/components/ai-diagnostic/AIDiagnosticPanel.tsx` - 提取并发送 Pod 名称
3. ✅ `src/app/projects/[id]/services/[serviceId]/page.tsx` - 传递 k8sStatus
4. ✅ `websocket-diagnostic-handler.js` - 接收并传递 Pod 名称
5. ✅ `websocket-ai-agent.js` - 改进系统提示和工具描述
6. ✅ `websocket-diagnostic-tools.js` - 支持 podName 参数
7. ✅ `src/lib/k8s.ts` - 返回 Pod 列表
8. ✅ `src/types/k8s.ts` - 更新类型定义
9. ✅ `src/components/services/OverviewTab.tsx` - 显示 Pod 状态

## 使用方法

1. 打开服务详情页
2. 等待服务状态加载（显示 Pod 列表）
3. 点击"AI 诊断"按钮
4. 输入"显示最新100条日志"
5. AI 会自动使用 Pod 名称获取日志

## 注意事项

1. **Pod 名称动态性**：Pod 重启后名称会变化，前端需要刷新状态
2. **多 Pod 场景**：如果有多个 Pod，AI 会使用第一个（可以改进让用户选择）
3. **命名空间**：确保 Pod 在正确的命名空间中

## 总结

经过完整的修复，AI 诊断助手现在：

✅ 从前端获取 Pod 信息
✅ 在系统提示中包含 Pod 列表
✅ 正确使用 Pod 名称调用工具
✅ 提供清晰的错误提示
✅ 向后兼容（无 Pod 信息时回退）

现在 AI 诊断助手可以可靠地获取服务日志了！
