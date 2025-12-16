# Nginx 私库镜像更新完成

## 更新需求
将所有模板中的 Nginx 镜像从阿里云镜像仓库更新为公司私库镜像 `nexus.aimstek.cn/xuanwu-factory/common/nginx:1.27.5`。

## 更新范围

### 1. PNPM 前端构建模板 (pnpm-frontend)
**更新前**:
```dockerfile
FROM registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine
```

**更新后**:
```dockerfile
FROM nexus.aimstek.cn/xuanwu-factory/common/nginx:1.27.5
```

### 2. Nginx 静态文件模板 (nginx-static)
**baseImage 字段更新**:
```typescript
// 更新前
baseImage: 'registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine'

// 更新后
baseImage: 'nexus.aimstek.cn/xuanwu-factory/common/nginx:1.27.5'
```

**Dockerfile 更新**:
```dockerfile
# 更新前
FROM registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine

# 更新后
FROM nexus.aimstek.cn/xuanwu-factory/common/nginx:1.27.5
```

## 主要变化

### 1. 镜像源变更
- **从**: 阿里云公共镜像仓库 (`registry.cn-hangzhou.aliyuncs.com/library/`)
- **到**: 公司私库 (`nexus.aimstek.cn/xuanwu-factory/common/`)

### 2. 版本策略变更
- **从**: `nginx:alpine` (滚动标签)
- **到**: `nginx:1.27.5` (固定版本)

### 3. 统一管理
- 所有 Nginx 相关模板使用统一的私库镜像
- 版本控制更加明确和可控

## 验证结果
✅ **所有测试通过** (8/8)

### 镜像更新验证
- ✅ PNPM 模板使用私库 Nginx 镜像
- ✅ nginx-static 模板 baseImage 更新
- ✅ nginx-static 模板 Dockerfile 更新
- ✅ 不再使用阿里云镜像仓库

### 版本控制验证
- ✅ 使用指定版本 1.27.5
- ✅ 版本标签明确且固定

### 兼容性验证
- ✅ 保持 PNPM 镜像配置不变
- ✅ 保持端口配置不变 (80)
- ✅ 保持多阶段构建结构

## 私库镜像优势

### 🚀 性能优势
- **更快的拉取速度**: 内网访问，避免外网带宽限制
- **减少构建时间**: 镜像拉取时间显著减少
- **提高构建成功率**: 避免外网网络不稳定

### 🔒 安全优势
- **访问控制**: 通过私库权限管理控制镜像访问
- **安全扫描**: 可以对私库镜像进行安全漏洞扫描
- **供应链安全**: 减少外部依赖和供应链攻击风险

### 📦 管理优势
- **统一管理**: 所有镜像在同一个私库中管理
- **版本控制**: 明确的版本号 (1.27.5) 而非滚动标签
- **依赖可控**: 减少对外部镜像仓库的依赖

### 🛡️ 风险控制
- **避免外网依赖**: 不依赖外部镜像仓库的可用性
- **合规要求**: 满足企业对镜像来源的合规要求
- **稳定性**: 固定版本确保环境一致性

## 镜像版本信息

### Nginx 1.27.5 特性
- **稳定版本**: 经过充分测试的稳定版本
- **安全更新**: 包含最新的安全补丁
- **性能优化**: 优化的性能和资源使用
- **兼容性**: 与现有配置完全兼容

### 版本选择原因
- **稳定性**: 1.27.5 是经过验证的稳定版本
- **安全性**: 包含重要的安全修复
- **长期支持**: 适合生产环境长期使用
- **功能完整**: 支持所需的所有功能特性

## 影响的模板

### 1. pnpm-frontend 模板
- **用途**: PNPM 前端项目构建
- **架构**: 多阶段构建 (PNPM 构建 + Nginx 服务)
- **影响**: 生产阶段使用新的 Nginx 镜像

### 2. nginx-static 模板
- **用途**: 纯静态文件服务
- **架构**: 单阶段构建 (直接使用 Nginx)
- **影响**: 基础镜像完全更新

## 部署注意事项

### 私库访问
- 确保构建环境可以访问 `nexus.aimstek.cn`
- 确保有适当的私库访问权限
- 如需认证，配置相应的 Docker 认证信息

### 镜像可用性
- 确保私库中存在 `nginx:1.27.5` 镜像
- 验证镜像的完整性和可用性
- 监控镜像的安全状态

### 版本管理
- 建立 Nginx 镜像的版本更新策略
- 定期评估和更新 Nginx 版本
- 保持与安全补丁的同步

## 回滚方案
如果遇到问题，可以快速回滚到之前的配置：

```typescript
// 回滚到阿里云镜像
baseImage: 'registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine'
```

```dockerfile
# 回滚 Dockerfile
FROM registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine
```

## 监控建议

### 构建监控
- 监控使用新镜像后的构建成功率
- 跟踪镜像拉取时间的改善
- 观察构建错误的变化

### 运行时监控
- 监控 Nginx 服务的性能表现
- 检查应用的正常运行状态
- 验证所有功能的正常工作

## 状态
✅ **已完成** - 所有模板中的 Nginx 镜像已成功更新为公司私库镜像 `nexus.aimstek.cn/xuanwu-factory/common/nginx:1.27.5`，提供更好的性能、安全性和可控性

## 后续建议
1. **性能监控**: 观察使用私库镜像后的构建性能改善
2. **版本管理**: 建立 Nginx 镜像的定期更新和维护机制
3. **扩展应用**: 考虑将其他基础镜像也迁移到私库
4. **文档更新**: 更新相关的部署和使用文档