#!/bin/bash
echo "🛑 停止调试工具服务..."

# 查找并停止相关进程
pkill -f "websocket-server.js"
pkill -f "next-server"
pkill -f "npm run dev"

echo "✅ 所有服务已停止"
