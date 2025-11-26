#!/bin/sh

# 启动WebSocket服务器（后台）
echo "Starting WebSocket server on port ${WS_PORT:-3001}..."
node websocket-server.js &
WS_PID=$!

# 等待WebSocket服务器启动
sleep 2

# 启动Next.js standalone服务器（前台）
echo "Starting Next.js standalone server on port ${PORT:-3000}..."
node server.js

# 如果Next.js退出，也杀掉WebSocket服务器
kill $WS_PID 2>/dev/null
