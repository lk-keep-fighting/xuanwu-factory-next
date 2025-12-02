# 调试工具功能更新日志

## v1.0.2 (2024-12-02)

### ⚡ 性能优化

#### 优化 Init Container 镜像拉取策略

**改进内容**:
Init Container 的镜像拉取策略从默认的 `Always` 改为 `IfNotPresent`。

**优势**:
- ✅ 优先使用节点本地缓存的镜像
- ✅ 减少镜像仓库的网络请求
- ✅ 加快 Pod 启动速度
- ✅ 降低镜像拉取失败的风险

**技术细节**:
```typescript
// src/lib/k8s.ts
return {
  name: 'install-debug-tools',
  image,
  imagePullPolicy: 'IfNotPresent', // 优先使用本地缓存
  command: ['sh', '-c'],
  args: [installScript],
  volumeMounts: [...]
}
```

**行为说明**:
- 如果节点上已有该镜像，直接使用本地镜像
- 如果节点上没有该镜像，才从镜像仓库拉取
- 对于 `latest` 标签的镜像，建议定期手动更新节点缓存

**最佳实践**:
```bash
# 在所有节点上预先拉取常用调试工具镜像
docker pull busybox:latest
docker pull nicolaka/netshoot:latest
docker pull ubuntu:22.04

# 或使用 DaemonSet 自动在所有节点拉取
kubectl apply -f k8s/debug-tools-image-puller.yaml
```

---

## v1.0.1 (2024-12-02)

### 🐛 Bug 修复

#### 修复服务更新 API 中的 project_id 错误

**问题描述**:
在更新服务配置（包括 debug_config）时，API 会报错：
```
Unknown argument `project_id`. Did you mean `project`?
```

**原因分析**:
- `project_id` 是 Prisma 中的关系字段
- 在 `update` 操作中不能直接修改关系字段
- 应该使用 `project` 关系或在更新前移除该字段

**解决方案**:
在 `src/app/api/services/[id]/route.ts` 的 PUT 请求处理中，在执行 Prisma update 操作前移除 `project_id` 字段：

```typescript
// 移除 project_id，因为它是关系字段，不能在 update 操作中直接修改
delete (data as { project_id?: unknown }).project_id
```

**影响范围**:
- 所有服务配置更新操作
- 包括调试工具配置的保存

**测试验证**:
```bash
# 测试更新服务配置
curl -X PUT http://localhost:3000/api/services/{service-id} \
  -H "Content-Type: application/json" \
  -d '{
    "debug_config": {
      "enabled": true,
      "toolset": "busybox",
      "mountPath": "/debug-tools"
    }
  }'

# 预期结果: 200 OK，配置成功保存
```

---

## v1.0.0 (2024-12-02)

### ✨ 新功能

#### 容器调试工具注入功能

为服务管理界面增加了容器调试工具注入功能，允许用户在部署服务时选择性地注入调试工具。

**核心特性**:
- ✅ 无侵入式：通过 Init Container 注入，不修改主镜像
- ✅ 按需启用：用户可选择是否启用
- ✅ 多种工具集：BusyBox、Netshoot、Ubuntu、自定义镜像
- ✅ 简单易用：UI 界面配置，一键启用
- ✅ 灵活配置：可自定义挂载路径

**新增文件**:
- `src/components/services/configuration/DebugToolsSection.tsx` - UI 组件
- `src/components/ui/alert.tsx` - Alert 提示组件
- `src/components/ui/switch.tsx` - 开关组件
- `src/components/ui/radio-group.tsx` - 单选按钮组组件
- `src/types/project.ts` - 添加 DebugConfig 类型
- `prisma/migrations/20251202000000_add_debug_config/` - 数据库 migration
- `doc/DEBUG_TOOLS_FEATURE_DESIGN.md` - 详细设计文档
- `doc/DEBUG_TOOLS_QUICK_START.md` - 快速上手指南
- `doc/DEBUG_TOOLS_README.md` - 功能概述
- `doc/DEBUG_TOOLS_TESTING.md` - 测试指南
- `doc/CONTAINER_DEBUG_GUIDE.md` - 容器调试指南

**修改文件**:
- `src/components/services/ConfigurationTab.tsx` - 集成调试工具组件
- `src/app/api/services/helpers.ts` - 添加 debug_config 字段支持
- `src/lib/k8s.ts` - 实现 Init Container 注入逻辑
- `prisma/schema.prisma` - 添加 debug_config 字段

**数据库变更**:
```sql
ALTER TABLE `services` ADD COLUMN `debug_config` JSON NULL;
```

**使用方法**:
1. 进入服务详情页 → 配置标签页
2. 启用"调试工具"开关
3. 选择工具集（推荐 BusyBox）
4. 保存并部署
5. 进入容器使用：`export PATH=/debug-tools:$PATH`

**工具集对比**:

| 工具集 | 大小 | 适用场景 | 推荐度 |
|--------|------|---------|--------|
| BusyBox | ~5MB | 日常调试 | ⭐⭐⭐⭐⭐ |
| Netshoot | ~300MB | 网络调试 | ⭐⭐⭐⭐ |
| Ubuntu | ~80MB | 完整环境 | ⭐⭐⭐ |
| 自定义 | 取决于镜像 | 特殊需求 | ⭐⭐ |

---

## 升级指南

### 从无调试工具功能升级到 v1.0.1

#### 1. 数据库迁移

```bash
# 方式 1: 使用 Prisma CLI（推荐）
npx prisma migrate deploy

# 方式 2: 手动执行 SQL
mysql -u root -p xuanwu_next < prisma/migrations/20251202000000_add_debug_config/migration.sql
```

#### 2. 重新生成 Prisma Client

```bash
npx prisma generate
```

#### 3. 重启服务

```bash
# 开发环境
pnpm dev

# 生产环境
docker build -t xuanwu-factory-next:latest .
kubectl rollout restart deployment/xuanwu-factory-next -n xuanwu-factory
```

#### 4. 验证功能

```bash
# 检查数据库字段
mysql -u root -p xuanwu_next -e "DESCRIBE services;" | grep debug_config

# 访问服务详情页，查看"调试工具"配置项
```

---

## 已知问题

### v1.0.0

1. ~~服务更新时 project_id 字段导致错误~~ (已在 v1.0.1 修复)

---

## 计划功能

### v1.1.0 (计划中)

- [ ] Ephemeral Container 集成
- [ ] Web Terminal 自动连接
- [ ] 调试工具市场
- [ ] 一键调试模式
- [ ] 调试会话记录

### v1.2.0 (计划中)

- [ ] 性能分析工具集成
- [ ] 数据库调试工具集成
- [ ] 自定义工具脚本
- [ ] 调试工具使用统计

---

## 反馈与支持

如果您在使用过程中遇到问题或有改进建议，请：

1. 查看 [测试指南](./DEBUG_TOOLS_TESTING.md)
2. 查看 [快速上手指南](./DEBUG_TOOLS_QUICK_START.md)
3. 查看 [容器调试指南](./CONTAINER_DEBUG_GUIDE.md)
4. 提交 Issue 或联系开发团队

---

## 贡献者

- 设计与实现: Kiro AI Assistant
- 需求提出: 用户
- Bug 修复: Kiro AI Assistant

---

## 许可证

本功能遵循项目主许可证。
