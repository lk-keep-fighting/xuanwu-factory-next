#!/bin/bash

# ===================================
# 数据库迁移后重启服务脚本
# ===================================

set -e

echo "🔄 开始重启流程..."

# 1. 清理 Next.js 缓存
echo "1️⃣ 清理 Next.js 缓存..."
rm -rf .next
echo "✅ 缓存已清理"

# 2. 清理 Turbopack 缓存
echo "2️⃣ 清理 Turbopack 缓存..."
rm -rf .turbo
echo "✅ Turbopack 缓存已清理"

# 3. 重新生成 Prisma Client
echo "3️⃣ 重新生成 Prisma Client..."
npx prisma generate
echo "✅ Prisma Client 已生成"

# 4. 验证数据库字段
echo "4️⃣ 验证数据库字段..."
mysql -h 192.168.154.154 -u root -proot xuanwu_next -e "DESCRIBE services;" 2>/dev/null | grep debug_config && echo "✅ debug_config 字段存在" || echo "❌ debug_config 字段不存在"

echo ""
echo "✅ 重启流程完成！"
echo ""
echo "请手动重启开发服务器："
echo "  pnpm dev"
echo ""
echo "或者如果使用 Docker："
echo "  docker-compose restart"
echo "  或"
echo "  kubectl rollout restart deployment/xuanwu-factory-next -n xuanwu-factory"
