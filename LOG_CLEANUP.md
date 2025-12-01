# 日志清理

## 概述

移除了 Prometheus 监控数据查询相关的重复日志输出，减少日志噪音。

## 问题

在服务详情页面的概览标签页中，每次查询 Prometheus 历史数据时都会输出大量重复日志：

```
[Metrics History] 查询 xuanwu-factory-next 的历史数据: 1h
[Metrics History] 返回 121 个数据点
[useMetricsHistory] fetchPrometheusData 调用，range: 1h, serviceId: xxx, mounted: true
[useMetricsHistory] 查询 Prometheus 历史数据: 1h
[useMetricsHistory] 获取到 121 个数据点
[useMetricsHistory] 定时刷新，使用 timeRange: 1h
...
```

由于监控数据每 60 秒自动刷新一次，这些日志会不断重复输出，造成日志污染。

## 解决方案

### 1. API 路由日志清理

**文件**: `src/app/api/services/[id]/metrics-history/route.ts`

移除了以下日志：
- ❌ `console.log(\`[Metrics History] 查询 ${serviceName} 的历史数据: ${range}\`)`
- ❌ `console.log(\`[Metrics History] 返回 ${dataPoints.length} 个数据点\`)`

保留了错误日志：
- ✅ `console.error('[Metrics History] 查询失败:', error)`

### 2. Hook 日志清理

**文件**: `src/hooks/useMetricsHistory.ts`

移除了以下调试日志：
- ❌ `console.log(\`[useMetricsHistory] fetchPrometheusData 调用...\`)`
- ❌ `console.log('[useMetricsHistory] 跳过获取：...')`
- ❌ `console.log(\`[useMetricsHistory] 查询 Prometheus 历史数据: ${range}\`)`
- ❌ `console.log(\`[useMetricsHistory] 获取到 ${data.dataPoints.length} 个数据点\`)`
- ❌ `console.log(\`[useMetricsHistory] timeRange 变化，重新获取数据: ${timeRange}\`)`
- ❌ `console.log(\`[useMetricsHistory] 定时刷新，使用 timeRange: ${timeRange}\`)`
- ❌ `console.log('[useMetricsHistory] 组件挂载，设置 mounted = true')`
- ❌ `console.log('[useMetricsHistory] 组件卸载，设置 mounted = false')`
- ❌ `console.log(\`[useMetricsHistory] 手动刷新，使用 range: ${rangeToUse}\`)`

保留了错误日志：
- ✅ `console.error('[useMetricsHistory] 查询失败:', message)`

## 效果

### 清理前
日志每 60 秒输出一次，包含大量调试信息：
```
[Metrics History] 查询 xuanwu-factory-next 的历史数据: 1h
[Metrics History] 返回 121 个数据点
[useMetricsHistory] fetchPrometheusData 调用，range: 1h, serviceId: xxx, mounted: true
[useMetricsHistory] 查询 Prometheus 历史数据: 1h
[useMetricsHistory] 获取到 121 个数据点
[useMetricsHistory] 定时刷新，使用 timeRange: 1h
```

### 清理后
正常情况下不输出日志，只在出错时输出错误信息：
```
(无日志输出)
```

出错时：
```
[useMetricsHistory] 查询失败: API 请求失败: Internal Server Error
[Metrics History] 查询失败: Error: ...
```

## 原则

1. **移除调试日志**: 开发阶段的调试日志不应该出现在生产环境
2. **保留错误日志**: 错误信息对于问题排查至关重要
3. **减少噪音**: 正常运行时不应该有大量重复日志
4. **按需调试**: 如需调试，可以临时添加日志，调试完成后移除

## 最佳实践

### 应该保留的日志
- ❌ 错误日志 (`console.error`)
- ❌ 警告日志 (`console.warn`)
- ❌ 关键业务操作（如用户登录、支付等）

### 应该移除的日志
- ✅ 调试信息 (`console.log` 用于开发调试)
- ✅ 函数调用追踪
- ✅ 数据查询结果统计
- ✅ 组件生命周期日志
- ✅ 定时任务执行日志

### 建议
如果需要详细的调试信息，可以：
1. 使用环境变量控制日志级别
2. 使用专业的日志库（如 winston、pino）
3. 在开发环境启用详细日志，生产环境只输出错误

示例：
```typescript
const DEBUG = process.env.NODE_ENV === 'development'

if (DEBUG) {
  console.log('[Debug] 查询数据:', data)
}
```
