#!/bin/bash
# ===================================
# 玄武工厂平台 - Docker 构建与部署脚本
# ===================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量（请根据实际情况修改）
# 默认 IMAGE_TAG 使用当前日期和时分秒（格式：YYYYMMDD-HHMMSS），例如 20251103-141530
IMAGE_NAME="${IMAGE_NAME:-xuanwu-factory}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"
REGISTRY="${REGISTRY:-nexus.aimstek.cn}"  # 替换为实际的镜像仓库地址
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
PUSH_IMAGE="${PUSH_IMAGE:-true}"  # 是否推送镜像到仓库

echo -e "${GREEN}=== 玄武工厂平台 Docker 构建脚本 ===${NC}"
echo "镜像名称: ${FULL_IMAGE}"
echo ""

# 步骤 1: 清理旧的构建缓存（可选）
if [ "$CLEAN_BUILD" = "true" ]; then
    echo -e "${YELLOW}清理构建缓存...${NC}"
    docker builder prune -f
fi

# 步骤 2: 构建 Docker 镜像
echo -e "${GREEN}开始构建 Docker 镜像...${NC}"
docker build \
    --platform linux/amd64 \
    --build-arg NODE_ENV=production \
    -t ${IMAGE_NAME}:${IMAGE_TAG} \
    -t ${FULL_IMAGE} \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Docker 镜像构建成功${NC}"
else
    echo -e "${RED}✗ Docker 镜像构建失败${NC}"
    exit 1
fi

# 步骤 3: 推送镜像到仓库（可选）
if [ "$PUSH_IMAGE" = "true" ]; then
    echo -e "${GREEN}推送镜像到仓库...${NC}"
    docker push ${FULL_IMAGE}
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 镜像推送成功${NC}"
    else
        echo -e "${RED}✗ 镜像推送失败${NC}"
        exit 1
    fi
fi

# 步骤 4: 本地测试（可选）
if [ "$TEST_LOCAL" = "true" ]; then
    echo -e "${GREEN}启动本地测试容器...${NC}"
    
    # 停止并删除旧容器
    docker stop xuanwu-factory-test 2>/dev/null || true
    docker rm xuanwu-factory-test 2>/dev/null || true
    
    # 运行测试容器
    docker run -d \
        --name xuanwu-factory-test \
        -p 3000:3000 \
        -e NODE_ENV=production \
        -e SUPABASE_URL=${SUPABASE_URL} \
        -e SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY} \
        -e NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
        ${IMAGE_NAME}:${IMAGE_TAG}
    
    echo -e "${GREEN}✓ 测试容器已启动，访问 http://localhost:3000${NC}"
    echo -e "${YELLOW}使用 'docker logs -f xuanwu-factory-test' 查看日志${NC}"
    echo -e "${YELLOW}使用 'docker stop xuanwu-factory-test' 停止容器${NC}"
fi

echo ""
echo -e "${GREEN}=== 构建完成 ===${NC}"
echo -e "镜像: ${FULL_IMAGE}"
echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo "1. 推送镜像: PUSH_IMAGE=true ./build-docker.sh"
echo "2. 本地测试: TEST_LOCAL=true ./build-docker.sh"
echo "3. 部署到 K8s: kubectl apply -f k8s-deployment.yaml"
