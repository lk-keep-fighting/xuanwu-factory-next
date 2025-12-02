# 调试工具功能故障排查指南

## 常见问题与解决方案

---

### 问题 1: Unknown argument `debug_config`

**错误信息**:
```
Unknown argument `debug_config`. Available options are marked with ?.
```

**原因**:
Prisma Client 缓存未更新，不知道新添加的 `debug_config` 字段。

**解决方案**:

#### 方案 A: 使用自动脚本（推荐）

```bash
bash scripts/restart-after-migration.sh
```

然后手动重启开发服务器：
```bash
pnpm dev
```

#### 方案 B: 手动步骤

```bash
# 1. 清理缓存
rm -rf .next .turbo

# 2. 重新生成 Prisma Client
npx prisma generate

# 3. 重启开发服务器
# 停止当前服务器（Ctrl+C）
pnpm dev
```

#### 方案 C: 生产环境

```bash
# Docker 环境
docker-compose restart

# Kubernetes 环境
kubectl rollout restart deployment/xuanwu-factory-next -n xuanwu-factory
```

**验证**:
```bash
# 检查数据库字段
mysql -h 192.168.154.154 -u root -proot xuanwu_next -e "DESCRIBE services;" | grep debug_config

# 应该看到:
# debug_config    json    YES             NULL
```

---

### 问题 2: Unknown argument `project_id`

**错误信息**:
```
Unknown argument `project_id`. Did you mean `project`?
```

**原因**:
`project_id` 是 Prisma 关系字段，不能在 update 操作中直接修改。

**解决方案**:
这个问题已在代码中修复（v1.0.1），确保使用最新代码：

```typescript
// src/app/api/services/[id]/route.ts
// 移除 project_id，因为它是关系字段
delete (data as { project_id?: unknown }).project_id
```

如果仍然遇到此问题，请：
1. 拉取最新代码
2. 重启开发服务器

---

### 问题 3: 保存配置后刷新页面配置丢失

**症状**:
保存调试工具配置后，刷新页面配置变回默认值。

**可能原因**:
1. 数据库保存失败
2. 前端状态管理问题
3. API 返回数据不完整

**排查步骤**:

```bash
# 1. 检查数据库中的数据
mysql -h 192.168.154.154 -u root -proot xuanwu_next -e "
  SELECT id, name, debug_config 
  FROM services 
  WHERE id = 'your-service-id';
"

# 2. 检查 API 响应
# 在浏览器开发者工具 Network 标签中查看 PUT /api/services/{id} 的响应

# 3. 检查浏览器控制台是否有错误
```

**解决方案**:
- 如果数据库中有数据但前端不显示：清除浏览器缓存
- 如果数据库中没有数据：检查 API 日志，查看保存失败原因

---

### 问题 4: 部署后 Init Container 失败

**症状**:
Pod 一直处于 `Init:Error` 或 `Init:CrashLoopBackOff` 状态。

**排查步骤**:

```bash
# 1. 查看 Pod 状态
kubectl get pods -n <namespace> -l app=<service-name>

# 2. 查看 Init Container 日志
kubectl logs <pod-name> -n <namespace> -c install-debug-tools

# 3. 查看 Pod 事件
kubectl describe pod <pod-name> -n <namespace>
```

**常见原因与解决方案**:

#### 原因 A: 镜像拉取失败

**日志示例**:
```
Failed to pull image "busybox:latest": rpc error: code = Unknown desc = Error response from daemon: Get https://registry-1.docker.io/v2/: net/http: request canceled
```

**解决方案**:
1. 检查集群网络连接
2. 使用国内镜像源
3. 预先拉取镜像到节点

```bash
# 在所有节点上预先拉取镜像
docker pull busybox:latest
docker pull nicolaka/netshoot:latest
docker pull ubuntu:22.04
```

#### 原因 B: 脚本执行失败

**日志示例**:
```
sh: /debug-tools/busybox: not found
```

**解决方案**:
检查 Init Container 脚本是否正确，确保路径和命令正确。

#### 原因 C: 权限问题

**日志示例**:
```
cp: can't create '/debug-tools/busybox': Permission denied
```

**解决方案**:
检查 Pod 的安全上下文，可能需要调整权限。

---

### 问题 5: 工具不可用

**症状**:
进入容器后，执行 `/debug-tools/ls` 提示 "not found"。

**排查步骤**:

```bash
# 1. 检查目录是否存在
kubectl exec -it <pod-name> -n <namespace> -- ls -la /debug-tools/

# 2. 如果目录为空，查看 Init Container 日志
kubectl logs <pod-name> -n <namespace> -c install-debug-tools

# 3. 检查卷挂载
kubectl describe pod <pod-name> -n <namespace> | grep -A 10 "Volumes:"
```

**解决方案**:
- 如果目录不存在：检查 K8s 配置中的 volumeMounts
- 如果目录为空：检查 Init Container 是否成功执行
- 如果 Init Container 失败：查看上面的"问题 4"

---

### 问题 6: 性能问题

**症状**:
启用调试工具后，Pod 启动时间明显变长。

**排查步骤**:

```bash
# 查看 Pod 启动时间
kubectl get events -n <namespace> --sort-by='.lastTimestamp' | grep <pod-name>

# 查看 Init Container 执行时间
kubectl logs <pod-name> -n <namespace> -c install-debug-tools --timestamps
```

**优化建议**:

1. **使用 BusyBox 而不是 Netshoot**
   - BusyBox: ~5MB, 启动快
   - Netshoot: ~300MB, 启动慢

2. **预先拉取镜像**
   ```bash
   # 在所有节点上预先拉取
   docker pull busybox:latest
   ```

3. **使用本地镜像仓库**
   ```typescript
   {
     "enabled": true,
     "toolset": "custom",
     "customImage": "your-registry.com/busybox:latest",
     "mountPath": "/debug-tools"
   }
   ```

---

### 问题 7: UI 组件不显示

**症状**:
配置页面中看不到"调试工具"部分。

**排查步骤**:

```bash
# 1. 检查文件是否存在
ls -la src/components/services/configuration/DebugToolsSection.tsx

# 2. 检查是否正确导入
grep "DebugToolsSection" src/components/services/ConfigurationTab.tsx

# 3. 检查浏览器控制台是否有错误
```

**解决方案**:
1. 确保所有文件都已创建
2. 清除浏览器缓存
3. 重启开发服务器

---

### 问题 8: TypeScript 类型错误

**错误信息**:
```
Property 'debug_config' does not exist on type 'Service'
```

**解决方案**:

```bash
# 1. 确保 Prisma schema 包含 debug_config 字段
grep "debug_config" prisma/schema.prisma

# 2. 重新生成 Prisma Client
npx prisma generate

# 3. 重启 TypeScript 服务器
# 在 VSCode 中: Cmd+Shift+P -> "TypeScript: Restart TS Server"

# 4. 重启开发服务器
pnpm dev
```

---

### 问题 9: 数据库字段不存在

**错误信息**:
```
Unknown column 'debug_config' in 'field list'
```

**解决方案**:

```bash
# 1. 检查数据库字段
mysql -h 192.168.154.154 -u root -proot xuanwu_next -e "DESCRIBE services;" | grep debug_config

# 2. 如果字段不存在，执行 migration
npx prisma migrate deploy

# 3. 或手动执行 SQL
mysql -h 192.168.154.154 -u root -proot xuanwu_next < prisma/migrations/20251202000000_add_debug_config/migration.sql

# 4. 验证字段已添加
mysql -h 192.168.154.154 -u root -proot xuanwu_next -e "DESCRIBE services;" | grep debug_config
```

---

### 问题 10: 多个服务冲突

**症状**:
多个服务启用调试工具后，工具互相干扰。

**原因**:
每个 Pod 的调试工具是独立的，不应该互相干扰。

**排查步骤**:

```bash
# 检查每个 Pod 的调试工具
for pod in $(kubectl get pods -n <namespace> -l app=<service-name> -o name); do
  echo "=== $pod ==="
  kubectl exec -n <namespace> $pod -- ls -la /debug-tools/ | head -5
done
```

**解决方案**:
如果确实存在冲突，可以为不同服务使用不同的挂载路径：
```typescript
{
  "enabled": true,
  "toolset": "busybox",
  "mountPath": "/debug-tools-service1"  // 使用不同的路径
}
```

---

## 快速诊断脚本

创建 `scripts/diagnose-debug-tools.sh`:

```bash
#!/bin/bash

echo "🔍 开始诊断调试工具功能..."
echo ""

# 1. 检查数据库字段
echo "1️⃣ 检查数据库字段..."
mysql -h 192.168.154.154 -u root -proot xuanwu_next -e "DESCRIBE services;" 2>/dev/null | grep debug_config && echo "✅ debug_config 字段存在" || echo "❌ debug_config 字段不存在"
echo ""

# 2. 检查 Prisma schema
echo "2️⃣ 检查 Prisma schema..."
grep -q "debug_config.*Json?" prisma/schema.prisma && echo "✅ Prisma schema 包含 debug_config" || echo "❌ Prisma schema 缺少 debug_config"
echo ""

# 3. 检查 UI 组件
echo "3️⃣ 检查 UI 组件..."
test -f src/components/services/configuration/DebugToolsSection.tsx && echo "✅ DebugToolsSection.tsx 存在" || echo "❌ DebugToolsSection.tsx 不存在"
test -f src/components/ui/alert.tsx && echo "✅ alert.tsx 存在" || echo "❌ alert.tsx 不存在"
test -f src/components/ui/switch.tsx && echo "✅ switch.tsx 存在" || echo "❌ switch.tsx 不存在"
test -f src/components/ui/radio-group.tsx && echo "✅ radio-group.tsx 存在" || echo "❌ radio-group.tsx 不存在"
echo ""

# 4. 检查类型定义
echo "4️⃣ 检查类型定义..."
grep -q "interface DebugConfig" src/types/project.ts && echo "✅ DebugConfig 类型存在" || echo "❌ DebugConfig 类型不存在"
echo ""

# 5. 检查 K8s 服务
echo "5️⃣ 检查 K8s 服务..."
grep -q "buildDebugInitContainer" src/lib/k8s.ts && echo "✅ buildDebugInitContainer 方法存在" || echo "❌ buildDebugInitContainer 方法不存在"
echo ""

# 6. 检查 API helpers
echo "6️⃣ 检查 API helpers..."
grep -q "debug_config" src/app/api/services/helpers.ts && echo "✅ API helpers 支持 debug_config" || echo "❌ API helpers 不支持 debug_config"
echo ""

# 7. 检查缓存
echo "7️⃣ 检查缓存..."
test -d .next && echo "⚠️  .next 缓存存在（可能需要清理）" || echo "✅ .next 缓存已清理"
test -d .turbo && echo "⚠️  .turbo 缓存存在（可能需要清理）" || echo "✅ .turbo 缓存已清理"
echo ""

echo "✅ 诊断完成！"
echo ""
echo "如果发现问题，请运行："
echo "  bash scripts/restart-after-migration.sh"
```

---

## 获取帮助

如果以上方案都无法解决问题，请：

1. 收集以下信息：
   - 错误信息完整日志
   - 浏览器控制台错误
   - Pod 日志（如果涉及部署）
   - 数据库字段信息

2. 运行诊断脚本：
   ```bash
   bash scripts/diagnose-debug-tools.sh
   ```

3. 查看相关文档：
   - [功能设计文档](./DEBUG_TOOLS_FEATURE_DESIGN.md)
   - [快速上手指南](./DEBUG_TOOLS_QUICK_START.md)
   - [测试指南](./DEBUG_TOOLS_TESTING.md)
   - [更新日志](./DEBUG_TOOLS_CHANGELOG.md)

4. 联系开发团队或提交 Issue
