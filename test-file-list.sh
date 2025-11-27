#!/bin/bash

# 测试文件列表功能
# 用法: ./test-file-list.sh <service-id> <path>

SERVICE_ID=${1:-"c641d9d6-1706-4230-a24a-881a4badb8b2"}
PATH=${2:-"/"}

echo "测试文件列表功能"
echo "Service ID: $SERVICE_ID"
echo "Path: $PATH"
echo ""

# 发送请求
RESPONSE=$(curl -s "http://localhost:3000/api/services/$SERVICE_ID/files?path=$PATH")

echo "响应:"
echo "$RESPONSE" | jq '.'

# 检查条目数量
ENTRY_COUNT=$(echo "$RESPONSE" | jq '.entries | length')
echo ""
echo "文件/目录数量: $ENTRY_COUNT"
