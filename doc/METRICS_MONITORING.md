# CPU与内存监控功能

## 功能概述

在服务详情页的"服务状态"Tab中，新增实时的CPU和内存使用监控，包括：
- 实时使用量显示（例如：250m / 1000m，512Mi / 2Gi）
- 使用率百分比计算
- 彩色进度条可视化（绿色<60%，黄色60-80%，红色>80%）
- 自动刷新（与服务状态同步）

## 依赖要求

### Kubernetes Metrics Server

本功能依赖 Kubernetes Metrics Server 提供资源使用数据。

#### 检查是否已安装
```bash
kubectl get deployment metrics-server -n kube-system
```

#### 如果未安装，快速部署
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

#### 验证Metrics API可用
```bash
kubectl top pods -n your-namespace
```

### 权限配置

如果使用ServiceAccount认证，需要确保有读取metrics的权限：

```bash
# 创建ClusterRoleBinding（如果尚未配置）
kubectl create clusterrolebinding metrics-reader \
  --clusterrole=system:metrics-reader \
  --serviceaccount=default:default
```

## 技术实现

### 1. 数据结构 (src/types/k8s.ts)

扩展了 `K8sServiceStatus` 接口：

```typescript
export interface K8sServiceStatus {
  // ... 现有字段
  metrics?: {
    cpu: {
      used: string          // "250m" 或 "0.25"
      limit?: string        // "1000m" 或 "1"
      usagePercent?: number // 25.0
    }
    memory: {
      used: string          // "256Mi" 或 "512Mi"
      limit?: string        // "1Gi" 或 "2Gi"
      usagePercent?: number // 25.0
    }
    timestamp: string       // ISO 8601时间戳
  }
}
```

### 2. 后端实现 (src/lib/k8s.ts)

新增方法：
- `getServiceMetrics(serviceName, namespace)` - 获取服务metrics
- `calculateCpuPercent(used, limit)` - 计算CPU使用百分比
- `calculateMemoryPercent(used, limit)` - 计算内存使用百分比
- `parseCpuToMillicores(cpu)` - 解析CPU字符串（"250m" -> 250）
- `parseMemoryToBytes(memory)` - 解析内存字符串（"512Mi" -> bytes）

#### 实现逻辑
1. 通过 `app=${serviceName}` 标签查找Pod
2. 选择第一个Running状态的Pod
3. 调用 Metrics API：`/apis/metrics.k8s.io/v1beta1/namespaces/{namespace}/pods/{podName}`
4. 从Pod spec获取资源限制（limits）
5. 计算使用率百分比
6. 如果Metrics Server不可用或Pod无metrics，静默失败返回null

### 3. API层 (src/app/api/services/[id]/status/route.ts)

在现有的status API中添加metrics调用：

```typescript
const statusResult = await k8sService.getServiceStatus(serviceName, namespace)
const metrics = await k8sService.getServiceMetrics(serviceName, namespace)

return NextResponse.json({
  ...statusResult,
  metrics,  // 新增字段
  // ...
})
```

### 4. 前端UI (src/app/projects/[id]/services/[serviceId]/page.tsx)

在"服务状态"Tab中添加"资源使用"卡片，展示：
- CPU使用：文本显示 + 百分比 + 彩色进度条
- 内存使用：文本显示 + 百分比 + 彩色进度条
- 更新时间：显示metrics采样时间

#### 颜色规则
- 绿色：使用率 < 60%
- 黄色：使用率 60-80%
- 红色：使用率 > 80%

## 错误处理

### Metrics Server未安装
- **表现**：资源使用卡片不显示
- **原因**：API返回 `metrics: null`
- **影响**：其他功能正常，不影响服务状态查看

### Pod无metrics数据
- **表现**：资源使用卡片不显示
- **原因**：Pod刚启动或Metrics Server延迟
- **处理**：等待数据收集（通常15-30秒）

### 权限不足
- **表现**：控制台警告 `[K8s] 获取 metrics 失败: Forbidden`
- **原因**：ServiceAccount缺少metrics读取权限
- **解决**：参考"权限配置"章节

### 服务未配置资源限制
- **表现**：仅显示使用量，不显示百分比和进度条
- **原因**：Pod spec中未设置 `resources.limits`
- **说明**：这是正常情况，可考虑为服务配置资源限制

## 数据刷新

- 自动刷新：点击"刷新状态"按钮时同步刷新metrics
- 刷新频率：与服务状态查询同步，建议不超过5秒一次
- 数据延迟：Metrics Server通常有15-30秒的数据采集延迟

## 未来扩展

### 不建议做的事
❌ **历史数据存储与趋势图表**
- 原因：数据量爆炸（1天2880条/服务），增加数据库和代码复杂度
- 替代方案：直接集成Prometheus + Grafana，使用iframe嵌入

### 可考虑的优化
✅ **多容器聚合**
- 当前只显示主容器，可扩展为聚合所有容器的metrics

✅ **自动刷新**
- 添加定时器自动刷新metrics（可选功能）

✅ **内存单位优化**
- 自动转换为最合适的单位（Mi/Gi）显示

## 调试技巧

### 手动测试Metrics API
```bash
# 获取Pod metrics
kubectl get --raw "/apis/metrics.k8s.io/v1beta1/namespaces/xuanwu-factory/pods/your-pod-name"

# 查看原始JSON
kubectl get --raw "/apis/metrics.k8s.io/v1beta1/namespaces/xuanwu-factory/pods/your-pod-name" | jq
```

### 检查服务详情页
1. 打开浏览器开发者工具
2. 访问服务详情页
3. 查看Network标签中的 `/api/services/{id}/status` 请求
4. 确认响应包含 `metrics` 字段

### 后端日志
```bash
# 查看应用日志
kubectl logs -f deployment/xuanwu-factory-next -n xuanwu-factory

# 关键日志：
# - "[K8s] 获取 metrics 失败" - metrics获取失败
# - 无日志 - 正常（metrics可用时不输出日志）
```

## 总结

- ✅ 零依赖（复用现有K8s client）
- ✅ 渐进式（Metrics Server可选）
- ✅ 实用主义（实时数据满足90%需求）
- ✅ 代码量：~200行（含注释）
- ✅ 实现耗时：< 3小时
