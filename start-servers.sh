#!/bin/sh

# 配置 kubectl 使用 in-cluster 认证
echo "Configuring kubectl for in-cluster authentication..."
if [ -f /var/run/secrets/kubernetes.io/serviceaccount/token ]; then
  # 获取 ServiceAccount token 和证书
  KUBE_TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
  KUBE_CA=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
  
  # 配置 kubectl
  kubectl config set-cluster kubernetes \
    --server=https://kubernetes.default.svc \
    --certificate-authority=$KUBE_CA
  
  kubectl config set-credentials serviceaccount \
    --token=$KUBE_TOKEN
  
  kubectl config set-context default \
    --cluster=kubernetes \
    --user=serviceaccount
  
  kubectl config use-context default
  
  echo "✅ kubectl configured successfully"
  kubectl version --client --short 2>/dev/null || echo "kubectl client version check skipped"
else
  echo "⚠️  ServiceAccount token not found, kubectl will not be available"
fi

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
