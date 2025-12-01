# ===================================
# 玄武工厂平台 - 双服务器架构 Dockerfile
# Next.js (3000) + WebSocket Terminal (3001)
# ===================================

# ============ 阶段 1: 基础环境 ============
FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# 仅复制依赖安装所需文件，确保缓存命中
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma
COPY scripts ./scripts

# ============ 阶段 2: 安装全部依赖 ============
FROM base AS deps
RUN pnpm install --frozen-lockfile

# ============ 阶段 3: 构建应用 ============
FROM deps AS builder

# 复制源代码
COPY . .

# 构建环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 执行构建
RUN pnpm build

# ============ 阶段 4: 运行时镜像 ============
FROM node:20-alpine AS runner

# 安装必要的系统依赖（包括 kubectl）
RUN apk add --no-cache \
    ca-certificates \
    curl \
    tzdata \
    kubectl && \
    kubectl version --client || echo "kubectl installed"

# 设置时区
ENV TZ=Asia/Shanghai

WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
ENV WS_PORT=3001

# 复制Next.js standalone服务器（自包含最小化依赖，包括Prisma）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 复制Prisma schema（用于运行时读取）
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# 复制WebSocket服务器
COPY --from=builder --chown=nextjs:nodejs /app/websocket-server.js ./

# 复制WebSocket依赖（standalone不会追踪外部.js文件的依赖）
# 直接复制整个.pnpm store 保证依赖完整
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.pnpm ./node_modules/.pnpm

# 复制启动脚本
COPY --chown=nextjs:nodejs start-servers.sh ./
RUN chmod +x start-servers.sh

# 为WebSocket服务器创建符号链接（pnpm需要）
RUN ln -s .pnpm/ws@8.18.3/node_modules/ws ./node_modules/ws && \
    ln -s .pnpm/@kubernetes+client-node@1.4.0/node_modules/@kubernetes ./node_modules/@kubernetes

# 配置 kubectl 使用 in-cluster 认证
# 创建 .kube 目录并设置权限
RUN mkdir -p /home/nextjs/.kube && \
    chown -R nextjs:nodejs /home/nextjs/.kube

# 切换到非 root 用户
USER nextjs

# 暴露两个端口
EXPOSE 3000 3001

# 健康检查（检查两个服务）
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health && curl -f http://localhost:3001/ || exit 1

# 启动双服务器
CMD ["sh", "start-servers.sh"]
