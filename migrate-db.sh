#!/bin/bash

# Supabase 数据库迁移脚本
# 添加 network_config 字段到 services 表

echo "🚀 开始执行数据库迁移..."
echo ""

# 检查是否设置了 Supabase 连接信息
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "❌ 错误：未设置 SUPABASE_URL 或 SUPABASE_SERVICE_KEY 环境变量"
  echo ""
  echo "请设置环境变量："
  echo "  export SUPABASE_URL='https://your-project.supabase.co'"
  echo "  export SUPABASE_SERVICE_KEY='your-service-key'"
  echo ""
  echo "或者手动在 Supabase Dashboard 中执行 SQL："
  echo "  1. 打开 Supabase Dashboard"
  echo "  2. 进入 SQL Editor"
  echo "  3. 复制并执行 supabase-add-network-config.sql 文件内容"
  exit 1
fi

echo "📝 迁移文件: supabase-add-network-config.sql"
echo ""

# 使用 psql 执行迁移（如果可用）
if command -v psql &> /dev/null; then
  echo "✅ 检测到 psql，尝试自动执行迁移..."
  
  # 从 Supabase URL 提取数据库连接信息
  # 注意：这需要根据实际的 Supabase 配置调整
  
  echo "⚠️  自动执行需要配置数据库连接字符串"
  echo "建议手动执行迁移脚本"
else
  echo "ℹ️  未检测到 psql 工具"
fi

echo ""
echo "📋 手动执行步骤："
echo "  1. 登录 Supabase Dashboard: https://app.supabase.com"
echo "  2. 选择你的项目"
echo "  3. 进入 SQL Editor"
echo "  4. 复制 supabase-add-network-config.sql 的内容"
echo "  5. 粘贴并执行"
echo ""
echo "💡 迁移完成后，services 表将包含 network_config 字段"
echo "   该字段用于配置 Kubernetes Service 的网络访问"
