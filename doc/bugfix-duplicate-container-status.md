# Bug 修复：容器状态重复显示

## 问题描述

在服务详情页的"概览"标签页中，容器状态部分会显示重复的容器名称。例如，一个 MySQL 服务会显示两个 "mysql" 容器。

**问题截图位置：**
- 页面：服务详情 → 概览标签
- 位置：服务状态卡片 → 容器状态部分

## 根本原因

在 `src/lib/k8s.ts` 的 `getServiceStatus` 方法中，代码会遍历所有 Pod 并收集所有容器的状态：

```typescript
// 问题代码
for (const pod of pods.items) {
  const podContainerStatuses = pod.status?.containerStatuses || []
  containerStatuses.push(...podContainerStatuses)  // ❌ 收集所有 Pod 的所有容器
}
```

**导致重复的原因：**

1. **多个 Pod**：对于 StatefulSet（如 MySQL），可能有多个 Pod（如 mysql-0, mysql-1）
2. **多个容器**：每个 Pod 可能有多个容器（主容器 + sidecar 容器）
3. **全部收集**：代码将所有 Pod 的所有容器状态都添加到数组中

**示例场景：**
- MySQL StatefulSet 有 1 个 Pod
- 该 Pod 有 2 个容器：mysql（主容器）+ mysql-exporter（监控容器）
- 结果：显示 2 个容器状态

## 解决方案

### 修改策略

只显示第一个 Pod 的主容器状态，过滤掉辅助容器（如 sidecar、exporter 等）：

```typescript
// 修复后的代码
// 只取第一个 Pod 的容器状态用于显示
const firstPod = pods.items[0]
if (firstPod) {
  const podContainerStatuses = firstPod.status?.containerStatuses || []
  console.log(`[K8s] Service ${serviceName} has ${podContainerStatuses.length} containers:`, 
    podContainerStatuses.map((c: any) => c.name))
  
  // 过滤掉调试工具容器和其他辅助容器，只保留主应用容器
  const mainContainers = podContainerStatuses.filter((status: any) => {
    const name = status.name || ''
    // 排除常见的 sidecar 和辅助容器
    return !name.includes('debug-tools') && 
           !name.includes('sidecar') && 
           !name.includes('proxy') &&
           !name.includes('exporter') &&
           !name.includes('agent')
  })
  
  // 如果过滤后没有容器，则显示所有容器
  const containersToShow = mainContainers.length > 0 ? mainContainers : podContainerStatuses
  containerStatuses.push(...containersToShow)
}

// 检查所有 Pod 是否有镜像拉取失败（保持原有的错误检测逻辑）
for (const pod of pods.items) {
  const podContainerStatuses = pod.status?.containerStatuses || []
  // ... 检查镜像拉取失败
}
```

### 修改位置

**文件：** `src/lib/k8s.ts`

**修改点 1：** Deployment 状态检查（约 1137 行）
**修改点 2：** StatefulSet 状态检查（约 1247 行）

两处使用相同的修复逻辑。

## 修复效果

### 修复前
```
容器状态:
✓ mysql
✓ mysql-exporter
```

### 修复后
```
容器状态:
✓ mysql
```

**说明：** 过滤掉了 `mysql-exporter`（监控容器），只显示主应用容器 `mysql`。

### 如果 Pod 有多个主容器
```
容器状态:
✓ app
✓ worker
```

**说明：** 如果有多个主容器（不包含 exporter、sidecar 等关键词），则都会显示。

## 技术细节

### 为什么只取第一个 Pod？

1. **代表性**：第一个 Pod 的容器状态可以代表整个服务的容器配置
2. **避免重复**：多个 Pod 的容器配置通常是相同的
3. **简洁性**：用户只需要知道服务有哪些容器，不需要看到每个 Pod 的重复信息

### 为什么过滤辅助容器？

1. **关注主要功能**：用户通常只关心主应用容器的状态
2. **减少干扰**：监控、代理等辅助容器不是服务的核心
3. **更清晰**：避免显示过多技术细节

**过滤规则：** 排除包含以下关键词的容器：
- `debug-tools` - 调试工具容器
- `sidecar` - Sidecar 容器
- `proxy` - 代理容器（如 Envoy）
- `exporter` - 监控导出器（如 mysql-exporter）
- `agent` - 代理程序（如日志收集）

### 为什么保留错误检查循环？

错误检查（镜像拉取失败）仍然需要遍历所有 Pod，因为：
- 任何一个 Pod 的镜像拉取失败都应该被检测到
- 这是服务级别的错误状态，不是单个 Pod 的状态

### Init 容器的处理

当前实现会显示所有容器（包括 init 容器）。如果需要排除 init 容器，可以进一步过滤：

```typescript
// 可选：只显示主容器，排除 init 容器
const mainContainers = podContainerStatuses.filter(
  (status: any) => !status.name?.startsWith('init-')
)
containerStatuses.push(...mainContainers)
```

## 相关代码

### OverviewTab 显示逻辑

**文件：** `src/components/services/OverviewTab.tsx`

```typescript
{k8sStatus?.podStatus?.containerStatuses && 
 Array.isArray(k8sStatus.podStatus.containerStatuses) && (
  <div className="text-xs text-gray-500">
    <div className="font-medium mb-1">容器状态:</div>
    {k8sStatus.podStatus.containerStatuses.map((container: any, idx: number) => (
      <div key={idx} className="flex items-center gap-2 py-1">
        {container.ready ? (
          <CheckCircle className="h-3 w-3 text-green-600" />
        ) : (
          <XCircle className="h-3 w-3 text-red-600" />
        )}
        <span className="font-mono">{container.name || `容器 ${idx + 1}`}</span>
      </div>
    ))}
  </div>
)}
```

这部分代码不需要修改，因为它只是显示从 API 返回的容器状态数组。

## 测试验证

### 测试场景

1. **单 Pod 单容器服务**（如简单的 Application）
   - 应该显示 1 个容器

2. **单 Pod 多容器服务**（如带 sidecar 的服务）
   - 应该显示所有主容器

3. **多 Pod 服务**（如 StatefulSet）
   - 应该只显示第一个 Pod 的容器
   - 不应该重复显示

4. **有 init 容器的服务**
   - 应该显示主容器和 init 容器（或根据需求过滤）

### 验证步骤

1. 访问 MySQL 服务详情页
2. 查看"概览"标签
3. 检查"容器状态"部分
4. 确认只显示一个 mysql 容器

## 后续优化建议

### 1. 区分主容器和 init 容器

在显示时添加标识：

```typescript
<span className="font-mono">
  {container.name}
  {isInitContainer && <Badge variant="secondary" className="ml-1">init</Badge>}
</span>
```

### 2. 显示容器镜像

添加镜像信息：

```typescript
<div className="text-xs text-gray-400 mt-0.5">
  {container.image}
</div>
```

### 3. 显示容器资源使用

如果有 metrics 数据，显示每个容器的资源使用：

```typescript
<div className="text-xs text-gray-400">
  CPU: {container.cpuUsage} | 内存: {container.memoryUsage}
</div>
```

### 4. 支持查看所有 Pod 的容器状态

添加一个"查看所有 Pod"的展开选项，让用户可以查看每个 Pod 的详细状态。

## 影响范围

- ✅ 服务详情页 → 概览标签 → 服务状态卡片
- ✅ 所有服务类型（Application、Database、Image）
- ✅ Deployment 和 StatefulSet

## 相关文件

- `src/lib/k8s.ts` - K8s 服务状态获取逻辑
- `src/components/services/OverviewTab.tsx` - 概览页面显示
- `src/app/api/services/[id]/status/route.ts` - 状态 API

## 修复日期

2024-12-04

## 版本

v1.0
