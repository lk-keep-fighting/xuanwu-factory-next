# Pod 名称显示修复

## 问题

AI 诊断助手使用 `app=${service.name}` label selector 查找 Pod，但有时找不到 Pod，因为：
1. 服务名是 deployment 名称，不是 Pod 名称
2. Pod 名称包含随机后缀（如 `jdk17-7b8c9d5f-xyz`）
3. 用户无法直接看到 Pod 的完整名称

## 解决方案

### 1. 在服务状态中显示 Pod 名称列表

**修改文件：**
- `src/lib/k8s.ts` - 添加 `podNames` 字段到 `getServiceStatus` 返回值
- `src/types/k8s.ts` - 更新 `K8sServiceStatus` 类型定义
- `src/components/services/OverviewTab.tsx` - 显示 Pod 名称列表

**效果：**
用户在服务详情页的"概览"标签中可以看到所有 Pod 的完整名称。

### 2. AI 诊断工具支持 Pod 名称参数

**修改文件：**
- `websocket-diagnostic-tools.js` - `getServiceLogs` 支持 `podName` 参数
- `websocket-ai-agent.js` - 工具定义中添加 `podName` 参数

**效果：**
- 如果提供 `podName`，直接从该 Pod 获取日志
- 如果不提供，自动查找第一个 Pod
- AI 可以从前端上下文中获取 Pod 名称

## 使用方法

### 前端显示

服务详情页 → 概览标签 → 服务状态卡片 → Pod 状态

显示格式：
```
Pod 状态:
📦 jdk17-7b8c9d5f-xyz [Running]
  ✓ jdk17
  ✓ sidecar (重启 2次)
```

每个 Pod 显示：
- Pod 完整名称
- Pod 阶段（Running/Pending/Failed）
- 容器列表及其状态
- 容器重启次数

### AI 诊断

用户可以说：
- "显示最新100条日志" - 自动查找第一个 Pod
- "显示 jdk17-7b8c9d5f-xyz 的日志" - 指定 Pod 名称

## 测试

重启服务后，检查：
1. 服务详情页是否显示 Pod 及容器状态
2. AI 诊断是否能正确获取日志
