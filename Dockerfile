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

# ============ 阶段 4: 精简生产依赖 ============
FROM deps AS prod-deps
RUN pnpm prune --prod

# ============ 阶段 5: 运行时镜像 ============
FROM node:20-alpine AS runner

# 安装必要的系统依赖
RUN apk add --no-cache \
    ca-certificates \
    curl \
    tzdata

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

# 复制生产依赖
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# 复制构建产物和源文件
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# 复制WebSocket服务器
COPY --from=builder --chown=nextjs:nodejs /app/websocket-server.js ./

# 复制启动脚本
COPY --chown=nextjs:nodejs start-servers.sh ./
RUN chmod +x start-servers.sh

# 切换到非 root 用户
USER nextjs

# 暴露两个端口
EXPOSE 3000 3001

# 健康检查（检查两个服务）
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health && curl -f http://localhost:3001/ || exit 1

# 启动双服务器
CMD ["sh", "start-servers.sh"]
