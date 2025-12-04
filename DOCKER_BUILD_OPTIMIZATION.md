# Docker 构建优化指南

## 问题分析

当前构建中 kubectl 安装耗时超过 33 分钟（18:47:01 到 19:20:23），是构建时间的主要瓶颈。

## 优化方案对比

| 方案 | 预计构建时间 | 优点 | 缺点 | 推荐度 |
|------|------------|------|------|--------|
| **方案1: 预构建基础镜像** | 首次: 35分钟<br>后续: 5-10分钟 | 后续构建极快，一次投入长期受益 | 需要维护额外镜像 | ⭐⭐⭐⭐⭐ |
| **方案2: 优化 apk 安装** | 20-25分钟 | 无需额外镜像，简单直接 | 仍需等待 apk 安装 | ⭐⭐⭐ |
| **方案3: 二进制安装** | 5-10分钟 | 最快，无需 apk | 需要手动管理版本 | ⭐⭐⭐⭐⭐ |

## 推荐方案：方案3（二进制安装）

### 快速开始

1. **替换 Dockerfile**
```bash
# 备份原文件
cp Dockerfile Dockerfile.old

# 使用优化版本
cp Dockerfile.binary Dockerfile
```

2. **构建镜像**
```bash
docker build -t your-app:latest .
```

3. **如果国内网络慢，使用镜像源**
编辑 Dockerfile，找到 kubectl 下载部分，使用镜像源：
```dockerfile
RUN curl -LO "https://mirror.ghproxy.com/https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/
```

### 预期效果
- **构建时间**: 从 35+ 分钟降至 5-10 分钟
- **镜像大小**: 基本不变（kubectl 二进制约 50MB）
- **功能**: 完全一致

## 方案1：预构建基础镜像（适合团队使用）

### 步骤

1. **构建基础镜像**（只需执行一次）
```bash
# 构建包含 kubectl 的基础镜像
docker build -f Dockerfile.base -t your-registry/node-kubectl:20-alpine .

# 推送到私有仓库
docker push your-registry/node-kubectl:20-alpine
```

2. **更新主 Dockerfile**
```bash
cp Dockerfile.optimized Dockerfile
```

编辑 Dockerfile，修改第 28 行：
```dockerfile
FROM your-registry/node-kubectl:20-alpine AS runner
```

3. **后续构建**
```bash
docker build -t your-app:latest .
```

### 优势
- 首次构建后，后续构建只需 5-10 分钟
- 团队成员共享基础镜像，统一环境
- 可以预装更多常用工具

## 方案2：优化当前 Dockerfile（最简单）

### 步骤

1. **使用优化版本**
```bash
cp Dockerfile.fast Dockerfile
```

2. **主要优化点**
- 移除不必要的调试工具（htop, vim, tcpdump, strace 等）
- 使用 `--no-cache` 避免下载索引
- 清理 apk 缓存

3. **构建**
```bash
docker build -t your-app:latest .
```

### 预期效果
- 构建时间: 20-25 分钟（节省约 30%）
- 镜像更小（移除了调试工具）

## 额外优化建议

### 1. 使用 BuildKit 缓存

在 `docker-compose.yml` 或构建脚本中启用 BuildKit：

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      cache_from:
        - your-registry/your-app:cache
      cache_to:
        - type=inline
```

或使用环境变量：
```bash
export DOCKER_BUILDKIT=1
docker build -t your-app:latest .
```

### 2. 并行构建多个镜像

如果有多个服务，使用 BuildKit 并行构建：
```bash
docker buildx build --platform linux/amd64 -t your-app:latest .
```

### 3. 使用 .dockerignore

确保 `.dockerignore` 文件排除不必要的文件：
```
node_modules
.next
.git
.env.local
*.log
.DS_Store
```

### 4. 分离开发和生产镜像

创建 `Dockerfile.dev`（包含调试工具）和 `Dockerfile.prod`（精简版）：

```bash
# 开发环境
docker build -f Dockerfile.dev -t your-app:dev .

# 生产环境
docker build -f Dockerfile.binary -t your-app:prod .
```

## CI/CD 集成

### GitHub Actions 示例

```yaml
name: Build Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./Dockerfile.binary
          push: true
          tags: your-registry/your-app:latest
          cache-from: type=registry,ref=your-registry/your-app:cache
          cache-to: type=inline
```

### Jenkins 示例

```groovy
pipeline {
    agent any
    
    environment {
        DOCKER_BUILDKIT = '1'
    }
    
    stages {
        stage('Build') {
            steps {
                sh 'docker build -f Dockerfile.binary -t your-app:${BUILD_NUMBER} .'
            }
        }
    }
}
```

## 验证优化效果

构建前后对比：
```bash
# 记录构建时间
time docker build -t your-app:test .

# 查看镜像大小
docker images your-app:test

# 验证 kubectl 可用
docker run --rm your-app:test kubectl version --client
```

## 故障排查

### 问题1: kubectl 下载失败

**症状**: `curl: (7) Failed to connect`

**解决**:
```dockerfile
# 使用国内镜像源
RUN curl -LO "https://mirror.ghproxy.com/https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
```

### 问题2: 架构不匹配

**症状**: `exec format error`

**解决**: 确保下载正确架构的二进制
```dockerfile
# ARM64 架构
RUN curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/arm64/kubectl"

# AMD64 架构（默认）
RUN curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
```

### 问题3: 权限问题

**症状**: `permission denied`

**解决**: 确保 kubectl 有执行权限
```dockerfile
RUN chmod +x /usr/local/bin/kubectl
```

## 总结

**立即可用的最佳方案**: 使用 `Dockerfile.binary`
- 构建时间从 35+ 分钟降至 5-10 分钟
- 无需维护额外镜像
- 功能完全一致

**长期最佳方案**: 使用 `Dockerfile.base` + `Dockerfile.optimized`
- 首次投入后，后续构建极快
- 适合团队协作
- 便于统一环境管理
