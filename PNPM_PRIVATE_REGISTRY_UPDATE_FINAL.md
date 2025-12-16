# PNPM 私库镜像更新完成

## 更新需求
将 PNPM 模板的基础镜像从公共镜像 `gplane/pnpm:node20-alpine` 更改为公司私库镜像 `nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine`。

## 更新内容

### 1. 基础镜像更新
**更新前**:
```typescript
baseImage: 'gplane/pnpm:node20-alpine'
```

**更新后**:
```typescript
baseImage: 'nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine'
```

### 2. Dockerfile 镜像引用更新
**更新前**:
```dockerfile
FROM gplane/pnpm:node20-alpine AS builder
```

**更新后**:
```dockerfile
FROM nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine AS builder
```

### 3. 模板描述更新
**更新前**:
```typescript
description: '基于PNPM构建前端项目，使用Nginx提供静态文件服务'
```

**更新后**:
```typescript
description: '基于公司私库PNPM镜像构建前端项目，使用Nginx提供静态文件服务'
```

### 4. Dockerfile 注释更新
**更新前**:
```dockerfile
# 第一阶段：使用PNPM构建前端项目
```

**更新后**:
```dockerfile
# 第一阶段：使用公司私库PNPM镜像构建前端项目
```

## 验证结果
✅ **所有测试通过** (8/8)

### 镜像更新验证
- ✅ baseImage 字段使用私库镜像
- ✅ Dockerfile FROM 指令使用私库镜像
- ✅ 不再引用公共镜像 gplane/pnpm
- ✅ 模板描述和注释已更新

### 配置保持验证
- ✅ Nginx 镜像配置保持不变
- ✅ 端口 80 配置保持不变
- ✅ 启动命令配置保持不变
- ✅ 其他构建逻辑保持不变

## 私库镜像优势

### 🚀 性能优势
- **更快的拉取速度**: 内网访问，避免外网带宽限制
- **减少构建时间**: 镜像拉取时间显著减少
- **提高构建成功率**: 避免外网网络不稳定导致的构建失败

### 🔒 安全优势
- **访问控制**: 通过私库权限管理控制镜像访问
- **安全扫描**: 可以对私库镜像进行安全漏洞扫描
- **版本控制**: 更好的镜像版本管理和追踪

### 📦 管理优势
- **统一管理**: 所有镜像在同一个私库中管理
- **版本一致性**: 确保团队使用相同版本的基础镜像
- **依赖可控**: 减少对外部镜像仓库的依赖

### 🛡️ 风险控制
- **避免外网依赖**: 不依赖外部镜像仓库的可用性
- **合规要求**: 满足企业对镜像来源的合规要求
- **供应链安全**: 减少供应链攻击风险

## 镜像信息

### 私库配置
- **私库地址**: `nexus.aimstek.cn`
- **项目路径**: `xuanwu-factory/common`
- **镜像名称**: `pnpm:node20-alpine`
- **完整路径**: `nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine`

### 镜像特性
- **基础系统**: Alpine Linux (轻量级)
- **Node.js 版本**: 20.x LTS
- **包管理器**: PNPM (高性能包管理器)
- **镜像大小**: 优化的小体积镜像

## 影响范围

### 直接影响
- **文件**: `src/lib/dockerfile-templates.ts`
- **模板**: `pnpm-frontend` 模板
- **构建环境**: 所有使用 PNPM 模板的前端项目

### 用户体验
- **构建速度**: 显著提升 (内网拉取)
- **构建稳定性**: 提高 (避免外网依赖)
- **功能**: 无变化 (保持所有原有功能)

### 兼容性
- **向后兼容**: 完全兼容现有项目
- **API 接口**: 无变化
- **配置方式**: 无变化

## 部署注意事项

### 私库访问
- 确保构建环境可以访问 `nexus.aimstek.cn`
- 确保有适当的私库访问权限
- 如需认证，配置相应的 Docker 认证信息

### 镜像同步
- 确保私库中的 PNPM 镜像是最新版本
- 定期同步上游镜像更新
- 监控镜像的安全漏洞

## 状态
✅ **已完成** - PNPM 模板现在使用公司私库镜像，提供更好的性能、安全性和可控性

## 后续建议
1. **监控构建性能**: 观察使用私库镜像后的构建时间改善
2. **镜像维护**: 建立私库镜像的定期更新和维护机制
3. **扩展应用**: 考虑将其他模板也迁移到私库镜像
4. **文档更新**: 更新相关部署和使用文档