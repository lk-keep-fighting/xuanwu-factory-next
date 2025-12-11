# Pod 监控 API 修复

## 问题描述

Pod 监控弹框报错：`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

## 问题原因

1. **API 路径错误**：使用了不存在的 `/api/services/${serviceId}/k8s-status` 路径
2. **数据结构不匹配**：不同类型的 Kubernetes 资源（Deployment vs StatefulSet）返回不同的 Pod 状态结构

## 修复方案

### 1. 修正 API 路径
```typescript
// 错误的路径
const response = await fetch(`/api/services/${serviceId}/k8s-status`)

// 正确的路径
const response = await fetch(`/api/services/${serviceId}/status`)
```

### 2. 处理不同的数据结构
```typescript
// 处理不同的 podStatus 结构
const podStatus = data.podStatus
if (podStatus) {
  // Deployment: podStatus.pods (数组)
  if (podStatus.pods && Array.isArray(podStatus.pods)) {
    setPodStatus({ pods: podStatus.pods })
  }
  // StatefulSet: podStatus.containerStatuses (数组)
  else if (podStatus.containerStatuses && Array.isArray(podStatus.containerStatuses)) {
    setPodStatus({
      pods: [{
        name: `${serviceName}-pod`,
        phase: 'Running',
        containers: podStatus.containerStatuses.map((c: any) => ({
          name: c.name,
          ready: c.ready || false,
          restartCount: c.restartCount || 0,
          state: c.state
        }))
      }]
    })
  }
  else {
    setPodStatus({ pods: [] })
  }
}
```

## API 数据结构说明

### Deployment 类型服务
```json
{
  "status": "running",
  "podStatus": {
    "pods": [
      {
        "name": "service-name-xxx",
        "phase": "Running",
        "containers": [
          {
            "name": "container-name",
            "ready": true,
            "restartCount": 0,
            "state": { ... }
          }
        ]
      }
    ]
  }
}
```

### StatefulSet 类型服务
```json
{
  "status": "running",
  "podStatus": {
    "containerStatuses": [
      {
        "name": "container-name",
        "ready": true,
        "restartCount": 0,
        "state": { ... }
      }
    ]
  }
}
```

## 测试验证

修复后，Pod 监控功能应该能够：
1. 正确调用现有的 API 端点
2. 处理 Deployment 和 StatefulSet 两种类型的服务
3. 正确显示 Pod 和容器状态信息
4. 实时刷新状态数据

## 相关文件

- `src/components/services/OverviewTab.tsx` - Pod 监控组件
- `src/app/api/services/[id]/status/route.ts` - 服务状态 API
- `src/lib/k8s.ts` - Kubernetes 服务状态获取逻辑