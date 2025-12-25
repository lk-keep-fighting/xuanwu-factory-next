# PNPM Lockfile 兼容性修复

## 🚨 问题描述

前端项目构建时出现错误：
```
ERR_PNPM_LOCKFILE_BREAKING_CHANGE  Lockfile /app/pnpm-lock.yaml not compatible with current pnpm
Run with the --force parameter to recreate the lockfile.
```

## 🔍 问题原因

- `gplane/pnpm:node20-alpine` 镜像中的 pnpm 版本与项目的 `pnpm-lock.yaml` 版本不兼容
- `--frozen-lockfile` 严格模式要求完全匹配的 lockfile 版本

## ✅ 解决方案

### 修复策略
1. **可选复制 lockfile**: 使用 `COPY pnpm-lock.yaml* ./` 避免文件不存在错误
2. **条件安装**: 检查 lockfile 是否存在，采用不同安装策略
3. **降级处理**: 优先使用 `--frozen-lockfile`，失败时自动降级到 `--force`

### 修复后的 Dockerfile
```dockerfile
# PNPM前端构建模板（修复版）
FROM gplane/pnpm:node20-alpine

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 复制package.json
COPY package.json ./

# 复制pnpm-lock.yaml（如果存在）
COPY pnpm-lock.yaml* ./

# 安装依赖（兼容不同版本的lockfile）
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile || pnpm install --force; \
    else \
      pnpm install; \
    fi

# 复制应用代码
COPY . ./

# 构建应用
RUN pnpm run build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["pnpm", "start"]
```

## 🎯 修复效果

- ✅ **兼容性**: 支持不同版本的 pnpm-lock.yaml
- ✅ **容错性**: 支持没有 lockfile 的项目
- ✅ **一致性**: 优先保持依赖版本锁定
- ✅ **自动降级**: 构建失败时自动使用 --force 重建

## 🚀 使用方法

修复已自动应用到：
- `src/lib/dockerfile-templates.ts` - TypeScript 模板定义
- `doc/jenkins/脚本/build-template` - Jenkins 构建脚本

现在可以重新构建前端项目，系统会自动处理 lockfile 兼容性问题。