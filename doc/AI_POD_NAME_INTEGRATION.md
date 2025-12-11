# AI 诊断助手 Pod 名称集成

## 问题

AI 诊断助手使用 label selector 查找 Pod，但经常找不到 Pod，因为：
1. Label selector 可能不匹配
2. 服务状态已经有 Pod 信息，但 AI 没有使用
3. 重复查询浪费资源

## 解决方案

### 架构

```
前端服务详情页
  ↓ 获取 k8sStatus (包含 Pod 列表)
  ↓ 打开 AI 诊断面板
  ↓ 传递 k8sStatus
  ↓
AI 诊断面板
  ↓ 提取 Pod 名称
  ↓ 发送诊断请求 (包含 podNames)
  ↓
WebSocket 服务器
  ↓ 接收 podNames
  ↓ 传递给 AI Agent
  ↓
AI Agent
  ↓ 在系统提示中包含 Pod 列表
  ↓ 调用工具时使用 Pod 名称
  ↓
诊断工具
  ↓ 直接使用提供的 Pod 名称
  ✓ 无需再次查询
```

### 代码更改

**1. 类型定义 (`src/types/ai-diagnostic.ts`)**
- `AIDiagnosticPanelProps` 添加 `k8sStatus` 属性
- `DiagnosticRequestMessage.payload` 添加 `podNames` 属性
- `DiagnosticContext` 添加 `podNames` 属性

**2. 前端组件 (`src/components/ai-diagnostic/AIDiagnosticPanel.tsx`)**
- 接收 `k8sStatus` prop
- 从 `k8sStatus.podStatus.pods` 提取 Pod 名称
- 在发送诊断请求时包含 `podNames`

**3. 服务详情页 (`src/app/projects/[id]/services/[serviceId]/page.tsx`)**
- 传递 `k8sStatusInfo` 给 `AIDiagnosticPanel`

**4. WebSocket 处理器 (`websocket-diagnostic-handler.js`)**
- 从 payload 中提取 `podNames`
- 传递给 AI Agent 的 context

**5. AI Agent (`websocket-ai-agent.js`)**
- 在 `buildMessages` 中添加 Pod 列表到系统提示
- 提示 AI 可以使用 `podName` 参数

**6. 诊断工具 (`websocket-diagnostic-tools.js`)**
- `getServiceLogs` 支持 `podName` 参数
- 如果提供 `podName`，直接使用
- 如果没有提供，回退到 label selector 查找

## 效果

### 之前
```
用户: "显示最新100条日志"
  ↓
AI: 调用 getServiceLogs
  ↓
工具: 使用 label selector 查找 Pod
  ↓
K8s API: 查询 Pod 列表
  ↓
❌ 找不到 Pod (label 不匹配)
```

### 之后
```
用户: "显示最新100条日志"
  ↓
前端: 已有 Pod 列表 [jdk17-7b8c9d5f-abc]
  ↓
AI: 知道 Pod 名称，调用 getServiceLogs(podName="jdk17-7b8c9d5f-abc")
  ↓
工具: 直接使用提供的 Pod 名称
  ↓
K8s API: 读取日志
  ↓
✓ 成功获取日志
```

## 系统提示示例

```
当前服务信息：
- 服务名称: jdk17
- 命名空间: logic-test
- 服务 ID: 1ba81d88-1b28-44f3-97a9-ffe916cf3f70
- Pod 列表: jdk17-7b8c9d5f-abc, jdk17-7b8c9d5f-xyz

提示：当需要查看日志时，可以使用 podName 参数指定具体的 Pod。
```

## 优势

1. **可靠性提升**：不依赖 label selector，直接使用已知的 Pod 名称
2. **性能优化**：减少不必要的 K8s API 查询
3. **用户体验**：AI 可以询问用户要查看哪个 Pod 的日志
4. **向后兼容**：如果没有 Pod 信息，仍然回退到 label selector

## 测试

1. 打开服务详情页
2. 等待 k8sStatus 加载完成（显示 Pod 列表）
3. 点击"AI 诊断"按钮
4. 输入"显示最新100条日志"
5. 检查服务器日志，应该看到：
   ```
   [AI Agent] Pod 列表: jdk17-7b8c9d5f-abc
   [Tool] Executing getServiceLogs for service: xxx pod: jdk17-7b8c9d5f-abc
   ```
6. AI 应该成功返回日志内容
