# ===================================
# 玄武工厂平台 - 生产级多阶段构建 Dockerfile
# 基于 Next.js 16 + pnpm
# ===================================

# ============ 阶段 1: 依赖安装 ============
FROM node:20-alpine AS deps

# 设置 pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# 复制依赖配置文件
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma
COPY scripts ./scripts

# 安装生产依赖（仅安装必需的包）
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ============ 阶段 2: 构建应用 ============
FROM node:20-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# 复制依赖配置
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma
COPY scripts ./scripts

# 安装所有依赖（包括 devDependencies）
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建环境变量（构建时可覆盖）
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 执行构建
RUN pnpm build

# ============ 阶段 3: 运行时镜像 ============
FROM node:20-alpine AS runner

# 安装必要的系统依赖（用于 K8s 客户端）
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

# 从 builder 阶段复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 启动应用
CMD ["node", "server.js"]
