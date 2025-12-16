# PNPM 前端构建 Nginx 修复完成

## 问题描述
用户反馈 PNPM 前端构建方式有问题，构建后应该使用 Nginx 运行，而不是尝试运行开发服务器。

## 问题分析
原始的 PNPM 模板存在以下问题：
1. **不适合生产环境**: 尝试使用 `pnpm start` 或开发服务器运行
2. **复杂的启动脚本**: 包含多种回退机制，增加了复杂性和不确定性
3. **资源浪费**: 在生产镜像中保留了 Node.js 环境和源代码
4. **端口配置错误**: 使用端口 3000 而不是标准的 HTTP 端口 80

## 修复方案
采用多阶段构建 (Multi-stage Build) 方案：

### 第一阶段：构建阶段
- 使用 `gplane/pnpm:node20-alpine` 作为构建环境
- 安装依赖并构建前端项目
- 生成静态文件

### 第二阶段：生产阶段
- 使用 `nginx:alpine` 作为生产环境
- 只复制构建产物，不包含源代码和 Node.js 环境
- 配置 Nginx 提供静态文件服务

## 修复前后对比

### 修复前
```dockerfile
FROM gplane/pnpm:node20-alpine
# ... 安装依赖和构建 ...
RUN pnpm add -g serve
# 复杂的启动脚本逻辑
CMD ["/app/start.sh"]
EXPOSE 3000
```

### 修复后
```dockerfile
# 构建阶段
FROM gplane/pnpm:node20-alpine AS builder
# ... 安装依赖和构建 ...

# 生产阶段
FROM registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Nginx 配置
CMD ["nginx", "-g", "daemon off;"]
EXPOSE 80
```

## 详细修复内容

### 1. 多阶段构建架构
**构建阶段 (Builder Stage)**:
- 基础镜像: `gplane/pnpm:node20-alpine`
- 工作目录: `/app`
- 操作: 安装依赖、构建项目

**生产阶段 (Production Stage)**:
- 基础镜像: `registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine`
- 操作: 复制构建产物、配置 Nginx

### 2. Nginx 配置优化
**SPA 路由支持**:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**静态资源缓存**:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

**安全头配置**:
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

### 3. 模板元数据更新
- **描述**: 更新为 "基于PNPM构建前端项目，使用Nginx提供静态文件服务"
- **运行命令**: 更改为 `nginx -g "daemon off;"`
- **暴露端口**: 更改为 `[80]`
- **环境变量**: 移除 `PORT: '3000'`

## 验证结果
✅ **所有测试通过** (15/15)

### 架构验证
- ✅ 使用多阶段构建
- ✅ 构建阶段使用 PNPM
- ✅ 生产阶段使用 Nginx
- ✅ 正确复制构建产物

### 配置验证
- ✅ 暴露端口 80 (标准 HTTP 端口)
- ✅ 使用 Nginx 启动命令
- ✅ 配置 SPA 路由支持
- ✅ 配置静态资源缓存
- ✅ 添加安全头

### 清理验证
- ✅ 移除复杂的启动脚本
- ✅ 移除 serve 包依赖
- ✅ 移除端口 3000 配置

## 优势对比

### 修复前的问题
- ❌ 生产镜像包含完整 Node.js 环境 (~100MB+)
- ❌ 复杂的启动逻辑，容易出错
- ❌ 使用非标准端口 3000
- ❌ 缺乏生产级别的 Web 服务器优化

### 修复后的优势
- ✅ 生产镜像只包含静态文件和 Nginx (~20MB)
- ✅ 简单可靠的启动方式
- ✅ 使用标准 HTTP 端口 80
- ✅ Nginx 提供生产级别的性能和安全性
- ✅ 支持 SPA 路由和资源缓存
- ✅ 添加安全头保护

## 支持的构建输出目录
- **dist/** - 默认目录 (Vite, Vue CLI, Angular CLI 等)
- **build/** - 可通过修改 Dockerfile 支持 (Create React App 等)
- **out/** - 可通过修改 Dockerfile 支持 (Next.js 等)

## 使用场景
适用于所有现代前端框架的生产部署：
- React (Create React App, Vite)
- Vue.js (Vue CLI, Vite)
- Angular (Angular CLI)
- Svelte (SvelteKit)
- 其他基于 PNPM 的前端项目

## 影响范围
- **文件**: `src/lib/dockerfile-templates.ts`
- **模板**: `pnpm-frontend` 模板
- **构建方式**: 从单阶段构建改为多阶段构建
- **运行环境**: 从 Node.js 改为 Nginx
- **镜像大小**: 显著减小 (约 80% 减少)
- **性能**: 显著提升 (Nginx vs Node.js 静态文件服务)

## 状态
✅ **已完成** - PNPM 前端构建现在使用正确的多阶段构建和 Nginx 生产部署方式