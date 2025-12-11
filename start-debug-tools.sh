#!/bin/bash

# Kubernetes 调试工具启动脚本

echo "🚀 启动 Kubernetes 调试工具..."
echo "=================================="

# 检查环境
echo "📋 检查环境..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# 检查 kubectl
if ! command -v kubectl &> /dev/null; then
    echo "⚠️ kubectl 未安装，部分功能可能不可用"
else
    echo "✅ kubectl: $(kubectl version --client --short 2>/dev/null || echo 'installed')"
fi

# 检查 Ollama (可选)
if command -v ollama &> /dev/null; then
    echo "✅ Ollama: $(ollama --version 2>/dev/null || echo 'installed')"
else
    echo "⚠️ Ollama 未安装，将使用基础AI功能"
fi

echo ""

# 设置环境变量
echo "🔧 设置环境变量..."
export NODE_ENV=development
export WEBSOCKET_PORT=3001
export AI_PROVIDER=ollama
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=qwen2.5:7b

# 如果没有设置数据库URL，使用默认值
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="postgresql://postgres:password@localhost:5432/xuanwu_factory"
    echo "⚠️ 使用默认数据库URL: $DATABASE_URL"
fi

echo "✅ 环境变量已设置"
echo ""

# 安装依赖
echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "📥 安装依赖..."
    npm install
else
    echo "✅ 依赖已安装"
fi
echo ""

# 启动服务
echo "🚀 启动服务..."

# 启动 WebSocket 服务器
echo "🔌 启动 WebSocket 服务器..."
node websocket-server.js &
WS_PID=$!
echo "✅ WebSocket 服务器已启动 (PID: $WS_PID)"

# 等待 WebSocket 服务器启动
sleep 2

# 启动 Next.js 开发服务器
echo "🌐 启动 Next.js 开发服务器..."
npm run dev &
NEXT_PID=$!
echo "✅ Next.js 服务器已启动 (PID: $NEXT_PID)"

echo ""
echo "🎉 所有服务已启动!"
echo "=================================="
echo "📱 Web 界面: http://localhost:3000"
echo "🔧 调试工具: http://localhost:3000/debug"
echo "🔌 WebSocket: ws://localhost:3001"
echo ""
echo "💡 使用说明:"
echo "1. 访问 http://localhost:3000/debug"
echo "2. 选择要调试的 Pod"
echo "3. 启动调试会话"
echo "4. 使用各种调试工具"
echo ""
echo "🛑 停止服务: Ctrl+C 或运行 ./stop-debug-tools.sh"
echo ""

# 创建停止脚本
cat > stop-debug-tools.sh << 'EOF'
#!/bin/bash
echo "🛑 停止调试工具服务..."

# 查找并停止相关进程
pkill -f "websocket-server.js"
pkill -f "next-server"
pkill -f "npm run dev"

echo "✅ 所有服务已停止"
EOF

chmod +x stop-debug-tools.sh

# 等待用户中断
echo "⏳ 服务运行中... (按 Ctrl+C 停止)"

# 捕获中断信号
trap 'echo ""; echo "🛑 正在停止服务..."; kill $WS_PID $NEXT_PID 2>/dev/null; echo "✅ 服务已停止"; exit 0' INT

# 等待进程
wait