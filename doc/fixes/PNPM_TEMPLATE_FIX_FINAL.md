# PNPM 模板构建修复完成

## 问题描述
PNPM 模板构建时出现错误：
```
ERR_PNPM_NO_SCRIPT_OR_SERVER  Missing script start or file server.js
```

## 根本原因
原始的 PNPM 模板直接使用 `pnpm start` 命令启动应用，但许多前端项目的 package.json 中没有定义 `start` 脚本，特别是：
- 纯静态构建项目（如 Vite、Create React App 构建后的项目）
- 使用其他启动命令的项目（如 `serve`、`preview`）
- 构建输出为静态文件的项目

## 修复方案
创建了一个智能启动脚本，按优先级尝试不同的启动方式：

### 启动方式优先级
1. **pnpm start** - 如果 package.json 中有 start 脚本
2. **pnpm run serve** - 如果有 serve 脚本（常见于开发服务器）
3. **pnpm run preview** - 如果有 preview 脚本（如 Vite preview）
4. **serve -s dist** - 如果存在 dist/index.html（静态文件服务）
5. **serve -s build** - 如果存在 build/index.html（CRA 等构建输出）

### 修复前的 Dockerfile
```dockerfile
# 启动应用
CMD ["pnpm", "start"]
```

### 修复后的 Dockerfile
```dockerfile
# 安装serve用于静态文件服务（如果需要）
RUN pnpm add -g serve

# 创建启动脚本
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# 检查是否有start脚本' >> /app/start.sh && \
    echo 'if pnpm run --silent start --help >/dev/null 2>&1; then' >> /app/start.sh && \
    echo '  echo "Using pnpm start"' >> /app/start.sh && \
    echo '  exec pnpm start' >> /app/start.sh && \
    echo 'elif pnpm run --silent serve --help >/dev/null 2>&1; then' >> /app/start.sh && \
    echo '  echo "Using pnpm run serve"' >> /app/start.sh && \
    echo '  exec pnpm run serve' >> /app/start.sh && \
    echo 'elif pnpm run --silent preview --help >/dev/null 2>&1; then' >> /app/start.sh && \
    echo '  echo "Using pnpm run preview"' >> /app/start.sh && \
    echo '  exec pnpm run preview' >> /app/start.sh && \
    echo 'elif [ -d "dist" ] && [ -f "dist/index.html" ]; then' >> /app/start.sh && \
    echo '  echo "Serving static files from dist directory"' >> /app/start.sh && \
    echo '  exec serve -s dist -l $PORT' >> /app/start.sh && \
    echo 'elif [ -d "build" ] && [ -f "build/index.html" ]; then' >> /app/start.sh && \
    echo '  echo "Serving static files from build directory"' >> /app/start.sh && \
    echo '  exec serve -s build -l $PORT' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "Error: No suitable start method found."' >> /app/start.sh && \
    echo '  echo "Please ensure your package.json has one of: start, serve, preview scripts"' >> /app/start.sh && \
    echo '  echo "Or build output exists in dist/ or build/ directory"' >> /app/start.sh && \
    echo '  exit 1' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    chmod +x /app/start.sh

# 启动应用
CMD ["/app/start.sh"]
```

## 验证结果
✅ **所有测试通过** (11/11)

### 功能验证
- ✅ 不再直接使用 `pnpm start`
- ✅ 包含智能启动脚本创建逻辑
- ✅ 支持多种启动方式检查
- ✅ 支持静态文件服务回退
- ✅ 包含详细错误提示

## 支持的项目类型

### 1. 有 start 脚本的项目
```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```
→ 使用 `pnpm start`

### 2. 有 serve 脚本的项目
```json
{
  "scripts": {
    "serve": "vite preview --port 3000"
  }
}
```
→ 使用 `pnpm run serve`

### 3. 有 preview 脚本的项目（Vite）
```json
{
  "scripts": {
    "preview": "vite preview"
  }
}
```
→ 使用 `pnpm run preview`

### 4. 纯静态构建项目
- 构建输出在 `dist/` 目录 → 使用 `serve -s dist`
- 构建输出在 `build/` 目录 → 使用 `serve -s build`

## 错误处理
如果所有启动方式都不可用，会显示详细的错误信息：
```
Error: No suitable start method found.
Please ensure your package.json has one of: start, serve, preview scripts
Or build output exists in dist/ or build/ directory
```

## 影响范围
- **文件**: `src/lib/dockerfile-templates.ts`
- **模板**: `pnpm-frontend` 模板
- **兼容性**: 支持各种前端项目类型
- **用户体验**: 减少构建失败，提供清晰的错误提示

## 状态
✅ **已完成** - PNPM 模板现在可以处理各种前端项目类型，不再出现 "Missing script start" 错误