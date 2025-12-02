# 容器调试工具功能

## 概述

为服务管理界面增加了容器调试工具注入功能，允许用户在部署服务时选择性地注入调试工具（如 BusyBox、Netshoot、Ubuntu 等），无需修改原始镜像，大大提升容器调试效率。

## 核心特性

✅ **无侵入式**: 通过 Init Container 注入，不修改主镜像  
✅ **按需启用**: 用户可选择是否启用，避免资源浪费  
✅ **多种工具集**: 提供 BusyBox、Netshoot、Ubuntu 和自定义镜像选项  
✅ **简单易用**: UI 界面配置，一键启用  
✅ **灵活配置**: 可自定义挂载路径和工具集  
✅ **性能优化**: 使用 IfNotPresent 策略，优先使用本地缓存

## 快速开始

### 1. 启用调试工具

服务详情页 → 配置标签 → 调试工具 → 启用开关 → 选择工具集 → 保存 → 部署

### 2. 使用调试工具

```bash
# 进入容器
kubectl exec -it <pod-name> -n <namespace> -- sh

# 使用工具
export PATH=/debug-tools:$PATH
ls -la
ps aux
netstat -tulpn
curl http://example.com
```

## 工具集对比

| 工具集 | 大小 | 适用场景 | 推荐度 |
|--------|------|---------|--------|
| **BusyBox** | ~5MB | 日常调试、快速排查 | ⭐⭐⭐⭐⭐ |
| **Netshoot** | ~300MB | 网络问题深度调试 | ⭐⭐⭐⭐ |
| **Ubuntu** | ~80MB | 需要完整环境或特定工具 | ⭐⭐⭐ |
| **自定义** | 取决于镜像 | 特殊需求 | ⭐⭐ |

## 技术实现

### 架构

```
用户界面 (ConfigurationTab)
    ↓
调试工具配置 (DebugToolsSection)
    ↓
数据模型 (Service.debug_config)
    ↓
K8s 部署 (k8sService.deployService)
    ↓
Init Container 注入
```

### 数据结构

```typescript
interface DebugConfig {
  enabled: boolean
  toolset: 'busybox' | 'netshoot' | 'ubuntu' | 'custom'
  customImage?: string
  mountPath: string
}
```

### K8s 配置

```yaml
spec:
  initContainers:
  - name: install-debug-tools
    image: busybox:latest
    command: ['sh', '-c']
    args:
    - |
      cp /bin/busybox /debug-tools/
      /debug-tools/busybox --install -s /debug-tools/
    volumeMounts:
    - name: debug-tools
      mountPath: /debug-tools
  
  containers:
  - name: app
    volumeMounts:
    - name: debug-tools
      mountPath: /debug-tools
  
  volumes:
  - name: debug-tools
    emptyDir: {}
```

## 文件清单

### 新增文件

- `src/components/services/configuration/DebugToolsSection.tsx` - UI 组件
- `src/types/project.ts` - 添加 `DebugConfig` 类型
- `prisma/migrations/20251202000000_add_debug_config/` - 数据库 migration
- `doc/DEBUG_TOOLS_FEATURE_DESIGN.md` - 详细设计文档
- `doc/DEBUG_TOOLS_QUICK_START.md` - 快速上手指南
- `doc/DEBUG_TOOLS_README.md` - 功能概述（本文件）

### 修改文件

- `src/components/services/ConfigurationTab.tsx` - 集成调试工具组件
- `src/app/api/services/helpers.ts` - 添加 `debug_config` 字段支持
- `src/lib/k8s.ts` - 实现 Init Container 注入逻辑
- `prisma/schema.prisma` - 添加 `debug_config` 字段

## 使用示例

### 示例 1: 启用 BusyBox

```typescript
{
  "debug_config": {
    "enabled": true,
    "toolset": "busybox",
    "mountPath": "/debug-tools"
  }
}
```

### 示例 2: 启用 Netshoot

```typescript
{
  "debug_config": {
    "enabled": true,
    "toolset": "netshoot",
    "mountPath": "/debug-tools"
  }
}
```

### 示例 3: 自定义镜像

```typescript
{
  "debug_config": {
    "enabled": true,
    "toolset": "custom",
    "customImage": "myregistry.com/debug-tools:latest",
    "mountPath": "/debug-tools"
  }
}
```

## 部署步骤

### 1. 数据库迁移

```bash
# 应用 migration
npx prisma migrate deploy

# 或手动执行 SQL
mysql -u root -p xuanwu_next < prisma/migrations/20251202000000_add_debug_config/migration.sql
```

### 2. 重新生成 Prisma Client

```bash
npx prisma generate
```

### 3. 重启服务

```bash
# 本地开发
pnpm dev

# 生产环境
docker build -t xuanwu-factory-next:latest .
kubectl rollout restart deployment/xuanwu-factory-next -n xuanwu-factory
```

## 测试验证

### 1. 功能测试

1. 创建或编辑一个服务
2. 进入配置标签页
3. 启用调试工具，选择 BusyBox
4. 保存并部署
5. 进入容器验证工具可用

```bash
kubectl exec -it <pod-name> -n <namespace> -- /debug-tools/ls -la
```

### 2. 工具集测试

测试不同工具集是否正常工作：

```bash
# BusyBox
kubectl exec -it <pod-name> -n <namespace> -- /debug-tools/busybox --help

# Netshoot
kubectl exec -it <pod-name> -n <namespace> -- /debug-tools/bin/curl --version

# Ubuntu
kubectl exec -it <pod-name> -n <namespace> -- /debug-tools/bin/bash --version
```

## 常见问题

### Q1: 工具不可用怎么办？

查看 Init Container 日志：
```bash
kubectl logs <pod-name> -n <namespace> -c install-debug-tools
```

### Q2: 如何禁用调试工具？

在配置页面关闭开关，保存并重新部署。

### Q3: 是否影响性能？

Init Container 只在启动时运行一次，对运行时性能无影响。BusyBox 仅占用 ~5MB 存储。

### Q4: 生产环境是否推荐使用？

建议按需启用。调试完成后可以禁用并重新部署，或使用 Ephemeral Container（K8s 1.23+）。

## 扩展方案

### 方案 A: Ephemeral Container 集成

在服务详情页添加"临时调试"按钮，直接注入 Ephemeral Container，无需重新部署。

### 方案 B: 调试工具市场

提供更多预配置的工具集：性能分析、数据库调试、开发工具、监控工具等。

### 方案 C: 一键调试模式

自动注入工具 + 打开 Web Terminal + 提供常用命令快捷方式。

## 相关文档

- [详细设计文档](./DEBUG_TOOLS_FEATURE_DESIGN.md)
- [快速上手指南](./DEBUG_TOOLS_QUICK_START.md)
- [容器调试指南](./CONTAINER_DEBUG_GUIDE.md)

## 贡献者

- 设计与实现: Kiro AI Assistant
- 需求提出: 用户

## 更新日志

### v1.0.2 (2024-12-02)

- ⚡ 优化镜像拉取策略为 `IfNotPresent`
- ⚡ 提供 DaemonSet 配置用于预拉取镜像
- 📝 更新文档说明镜像拉取优化

### v1.0.1 (2024-12-02)

- 🐛 修复服务更新 API 中的 project_id 错误

### v1.0.0 (2024-12-02)

- ✨ 新增调试工具注入功能
- ✨ 支持 BusyBox、Netshoot、Ubuntu 和自定义镜像
- ✨ UI 配置界面
- ✨ Init Container 自动注入
- 📝 完善文档和使用指南
