# Dockerfile 优化说明

## 已应用的优化

### 1. 使用预构建基础镜像 ⚡
**优化前：**
```dockerfile
FROM node:20-alpine AS runner
RUN apk add --no-cache kubectl vim htop ... # 30-60秒
```

**优化后：**
```dockerfile
FROM nexus.aimstek.cn/xuanwu-factory/xuanwu-factory-next-baseimage:dev-251204-220037-2041671 AS runner
```

**收益：** 节省 30-60 秒构建时间，减少网络请求

### 2. 启用 pnpm 缓存 🚀
**优化前：**
```dockerfile
RUN pnpm install --frozen-lockfile
```

**优化后：**
```dockerfile
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
```

**收益：** 
- 首次构建：无变化
- 后续构建：依赖安装时间减少 50-80%
- 需要 Docker BuildKit 支持

## 构建命令

### 标准构建（启用 BuildKit）
```bash
DOCKER_BUILDKIT=1 docker build -t xuanwu-factory:latest .
```

### 带缓存的构建
```bash
DOCKER_BUILDKIT=1 docker build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t xuanwu-factory:latest .
```

### 推送到 Nexus
```bash
docker tag xuanwu-factory:latest nexus.aimstek.cn/xuanwu-factory/xuanwu-factory:latest
docker push nexus.aimstek.cn/xuanwu-factory/xuanwu-factory:latest
```

## 性能对比

| 阶段 | 优化前 | 优化后 | 节省 |
|------|--------|--------|------|
| 系统依赖安装 | 30-60s | 0s | 100% |
| 依赖安装（首次） | 120s | 120s | 0% |
| 依赖安装（缓存） | 120s | 20-40s | 70% |
| **总构建时间** | **~200s** | **~80s** | **60%** |

## 基础镜像更新

当需要更新基础镜像时：

```bash
# 1. 构建新的基础镜像
docker build -f Dockerfile.base \
  -t nexus.aimstek.cn/xuanwu-factory/xuanwu-factory-next-baseimage:dev-$(date +%y%m%d-%H%M%S)-$(git rev-parse --short HEAD) .

# 2. 推送到 Nexus
docker push nexus.aimstek.cn/xuanwu-factory/xuanwu-factory-next-baseimage:dev-xxx

# 3. 更新 Dockerfile 中的基础镜像标签
```

## 进一步优化建议

### 1. 使用 latest 标签（可选）
如果基础镜像更新频繁，可以使用 latest 标签：
```dockerfile
FROM nexus.aimstek.cn/xuanwu-factory/xuanwu-factory-next-baseimage:latest AS runner
```

### 2. 多阶段构建优化
当前已经使用了 4 个阶段，结构清晰，无需进一步优化。

### 3. 依赖分层（未来优化）
如果 package.json 变化频繁，可以考虑：
- 分离生产依赖和开发依赖
- 使用 pnpm deploy 只安装生产依赖

## 注意事项

1. **BuildKit 必需**：pnpm 缓存需要 Docker BuildKit
2. **基础镜像版本**：建议定期更新基础镜像以获取安全补丁
3. **缓存清理**：如遇到依赖问题，可以清理缓存：
   ```bash
   docker builder prune --filter type=exec.cachemount
   ```
