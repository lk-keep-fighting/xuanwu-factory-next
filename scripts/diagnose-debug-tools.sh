#!/bin/bash

echo "🔍 开始诊断调试工具功能..."
echo ""

# 1. 检查数据库字段
echo "1️⃣ 检查数据库字段..."
mysql -h 192.168.154.154 -u root -proot xuanwu_next -e "DESCRIBE services;" 2>/dev/null | grep debug_config && echo "✅ debug_config 字段存在" || echo "❌ debug_config 字段不存在"
echo ""

# 2. 检查 Prisma schema
echo "2️⃣ 检查 Prisma schema..."
grep -q "debug_config.*Json?" prisma/schema.prisma && echo "✅ Prisma schema 包含 debug_config" || echo "❌ Prisma schema 缺少 debug_config"
echo ""

# 3. 检查 UI 组件
echo "3️⃣ 检查 UI 组件..."
test -f src/components/services/configuration/DebugToolsSection.tsx && echo "✅ DebugToolsSection.tsx 存在" || echo "❌ DebugToolsSection.tsx 不存在"
test -f src/components/ui/alert.tsx && echo "✅ alert.tsx 存在" || echo "❌ alert.tsx 不存在"
test -f src/components/ui/switch.tsx && echo "✅ switch.tsx 存在" || echo "❌ switch.tsx 不存在"
test -f src/components/ui/radio-group.tsx && echo "✅ radio-group.tsx 存在" || echo "❌ radio-group.tsx 不存在"
echo ""

# 4. 检查类型定义
echo "4️⃣ 检查类型定义..."
grep -q "interface DebugConfig" src/types/project.ts && echo "✅ DebugConfig 类型存在" || echo "❌ DebugConfig 类型不存在"
echo ""

# 5. 检查 K8s 服务
echo "5️⃣ 检查 K8s 服务..."
grep -q "buildDebugInitContainer" src/lib/k8s.ts && echo "✅ buildDebugInitContainer 方法存在" || echo "❌ buildDebugInitContainer 方法不存在"
echo ""

# 6. 检查 API helpers
echo "6️⃣ 检查 API helpers..."
grep -q "debug_config" src/app/api/services/helpers.ts && echo "✅ API helpers 支持 debug_config" || echo "❌ API helpers 不支持 debug_config"
echo ""

# 7. 检查缓存
echo "7️⃣ 检查缓存..."
test -d .next && echo "⚠️  .next 缓存存在（可能需要清理）" || echo "✅ .next 缓存已清理"
test -d .turbo && echo "⚠️  .turbo 缓存存在（可能需要清理）" || echo "✅ .turbo 缓存已清理"
echo ""

# 8. 检查 Prisma Client
echo "8️⃣ 检查 Prisma Client..."
if [ -f "node_modules/.prisma/client/index.d.ts" ]; then
    grep -q "debug_config" node_modules/.prisma/client/index.d.ts && echo "✅ Prisma Client 包含 debug_config" || echo "❌ Prisma Client 不包含 debug_config（需要重新生成）"
else
    echo "❌ Prisma Client 未生成"
fi
echo ""

echo "✅ 诊断完成！"
echo ""
echo "如果发现问题，请运行："
echo "  bash scripts/restart-after-migration.sh"
echo ""
echo "然后手动重启开发服务器："
echo "  pnpm dev"
