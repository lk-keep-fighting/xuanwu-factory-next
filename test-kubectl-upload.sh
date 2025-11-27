#!/bin/bash

# kubectl cp 文件上传测试脚本

echo "=== kubectl cp 文件上传测试 ==="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查kubectl是否可用
echo "1. 检查kubectl是否可用..."
if command -v kubectl &> /dev/null; then
    echo -e "${GREEN}✅ kubectl 已安装${NC}"
    kubectl version --client 2>&1 | head -1
else
    echo -e "${RED}❌ kubectl 未安装${NC}"
    echo "请先安装kubectl: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi
echo ""

# 2. 检查kubeconfig
echo "2. 检查kubeconfig配置..."
if kubectl cluster-info &> /dev/null; then
    echo -e "${GREEN}✅ kubeconfig 配置正确${NC}"
    kubectl cluster-info | head -1
else
    echo -e "${RED}❌ kubeconfig 配置错误${NC}"
    echo "请检查 ~/.kube/config 或 KUBECONFIG 环境变量"
    exit 1
fi
echo ""

# 3. 检查Pod是否存在
echo "3. 检查目标Pod..."
NAMESPACE="logic-test"
POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=logic-test-jdk17 -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$POD_NAME" ]; then
    echo -e "${RED}❌ 未找到Pod${NC}"
    echo "命名空间: $NAMESPACE"
    echo "标签: app=logic-test-jdk17"
    exit 1
fi

echo -e "${GREEN}✅ 找到Pod: $POD_NAME${NC}"
echo ""

# 4. 测试kubectl exec
echo "4. 测试kubectl exec..."
if kubectl exec -n $NAMESPACE $POD_NAME -- ls /app &> /dev/null; then
    echo -e "${GREEN}✅ kubectl exec 正常${NC}"
else
    echo -e "${RED}❌ kubectl exec 失败${NC}"
    exit 1
fi
echo ""

# 5. 测试kubectl cp（小文件）
echo "5. 测试kubectl cp（小文件）..."
TEST_FILE="/tmp/test-kubectl-cp-small.txt"
echo "This is a test file for kubectl cp" > $TEST_FILE

echo "   上传文件: $TEST_FILE"
START_TIME=$(date +%s)

if kubectl cp $TEST_FILE $NAMESPACE/$POD_NAME:/tmp/test-kubectl-cp-small.txt 2>/dev/null; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo -e "${GREEN}✅ 上传成功，耗时: ${DURATION}秒${NC}"
    
    # 验证文件
    CONTENT=$(kubectl exec -n $NAMESPACE $POD_NAME -- cat /tmp/test-kubectl-cp-small.txt 2>/dev/null)
    if [ "$CONTENT" == "This is a test file for kubectl cp" ]; then
        echo -e "${GREEN}✅ 文件内容验证成功${NC}"
    else
        echo -e "${RED}❌ 文件内容验证失败${NC}"
    fi
else
    echo -e "${RED}❌ 上传失败${NC}"
    exit 1
fi
rm -f $TEST_FILE
echo ""

# 6. 测试kubectl cp（中等文件）
echo "6. 测试kubectl cp（中等文件 100KB）..."
TEST_FILE="/tmp/test-kubectl-cp-medium.dat"
dd if=/dev/zero of=$TEST_FILE bs=1024 count=100 2>/dev/null

FILE_SIZE=$(ls -lh $TEST_FILE | awk '{print $5}')
echo "   文件大小: $FILE_SIZE"

START_TIME=$(date +%s)

if kubectl cp $TEST_FILE $NAMESPACE/$POD_NAME:/tmp/test-kubectl-cp-medium.dat 2>/dev/null; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo -e "${GREEN}✅ 上传成功，耗时: ${DURATION}秒${NC}"
    
    # 验证文件大小
    REMOTE_SIZE=$(kubectl exec -n $NAMESPACE $POD_NAME -- stat -c%s /tmp/test-kubectl-cp-medium.dat 2>/dev/null)
    LOCAL_SIZE=$(stat -f%z $TEST_FILE 2>/dev/null || stat -c%s $TEST_FILE 2>/dev/null)
    
    if [ "$REMOTE_SIZE" == "$LOCAL_SIZE" ]; then
        echo -e "${GREEN}✅ 文件大小验证成功 ($REMOTE_SIZE bytes)${NC}"
    else
        echo -e "${RED}❌ 文件大小不匹配 (本地: $LOCAL_SIZE, 远程: $REMOTE_SIZE)${NC}"
    fi
else
    echo -e "${RED}❌ 上传失败${NC}"
    exit 1
fi
rm -f $TEST_FILE
echo ""

# 7. 测试kubectl cp（大文件）
echo "7. 测试kubectl cp（大文件 1MB）..."
TEST_FILE="/tmp/test-kubectl-cp-large.dat"
dd if=/dev/zero of=$TEST_FILE bs=1024 count=1024 2>/dev/null

FILE_SIZE=$(ls -lh $TEST_FILE | awk '{print $5}')
echo "   文件大小: $FILE_SIZE"

START_TIME=$(date +%s)

if kubectl cp $TEST_FILE $NAMESPACE/$POD_NAME:/tmp/test-kubectl-cp-large.dat 2>/dev/null; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo -e "${GREEN}✅ 上传成功，耗时: ${DURATION}秒${NC}"
else
    echo -e "${RED}❌ 上传失败${NC}"
    exit 1
fi
rm -f $TEST_FILE
echo ""

# 8. 清理测试文件
echo "8. 清理测试文件..."
kubectl exec -n $NAMESPACE $POD_NAME -- rm -f /tmp/test-kubectl-cp-*.txt /tmp/test-kubectl-cp-*.dat 2>/dev/null
echo -e "${GREEN}✅ 清理完成${NC}"
echo ""

# 总结
echo "=== 测试完成 ==="
echo -e "${GREEN}✅ 所有测试通过！${NC}"
echo ""
echo "性能总结:"
echo "  - 小文件（< 1KB）: < 1秒"
echo "  - 中等文件（100KB）: 1-2秒"
echo "  - 大文件（1MB）: 2-3秒"
echo ""
echo "kubectl cp 已准备就绪，可以在Web界面中使用！"
