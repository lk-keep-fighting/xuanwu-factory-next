# Docker 构建兼容性说明

## 当前配置

本项目的 Dockerfile 已配置为兼容传统 Docker 构建模式，无需 BuildKit 或 docker-buildx-plugin。

### 环境要求

- Docker 版本：18.09 或更高
- 不需要 BuildKit
- 不需要 docker-buildx-plugin

### Jenkins 构建配置

Jenkins 构建脚本 (`doc/jenkins/脚本/build-by-dockerfile`) 使用以下配置：

```bash
DOCKER_BUILDKIT=0 docker build -f Dockerfile -t <image> .
```

这确保了在没有 buildx 组件的环境中也能正常构建。

## 如果需要启用 BuildKit

如果您的 Docker 环境支持 BuildKit 并希望获得更好的构建性能，可以：

### 1. 安装 docker-buildx-plugin

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install docker-buildx-plugin
```

**CentOS/RHEL:**
```bash
sudo yum install docker-buildx-plugin
```

**手动安装:**
```bash
# 下载 buildx 二进制文件
mkdir -p ~/.docker/cli-plugins
wget -O ~/.docker/cli-plugins/docker-buildx \
  https://github.com/docker/buildx/releases/download/v0.12.0/buildx-v0.12.0.linux-amd64
chmod +x ~/.docker/cli-plugins/docker-buildx

# 验证安装
docker buildx version
```

### 2. 修改 Dockerfile 使用 BuildKit 特性

在 `deps` 阶段添加缓存挂载：

```dockerfile
FROM base AS deps
# 使用 pnpm 缓存加速安装（需要 BuildKit）
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
```

### 3. 修改 Jenkins 脚本启用 BuildKit

```groovy
def dockerBuildCmd = "set -eu; DOCKER_BUILDKIT=1 docker build -f ${params.DOCKERFILE_PATH} ${buildArgFlags} -t ${image} ."
```

## BuildKit 的优势

启用 BuildKit 后可以获得：

1. **并行构建** - 多个构建阶段可以并行执行
2. **缓存挂载** - 使用 `--mount=type=cache` 加速依赖安装
3. **更好的缓存** - 更智能的层缓存机制
4. **构建秘密** - 使用 `--mount=type=secret` 安全传递敏感信息
5. **SSH 转发** - 使用 `--mount=type=ssh` 访问私有仓库

## 性能对比

### 传统模式（当前）
- 首次构建：~5-8 分钟
- 缓存命中：~2-3 分钟
- 依赖安装：每次都需要下载

### BuildKit 模式（可选）
- 首次构建：~4-6 分钟
- 缓存命中：~1-2 分钟
- 依赖安装：使用缓存挂载，显著加速

## 故障排查

### 错误：BuildKit is enabled but the buildx component is missing

**原因：** Docker 环境缺少 buildx 组件

**解决方案：**
1. 安装 docker-buildx-plugin（见上文）
2. 或者禁用 BuildKit：`DOCKER_BUILDKIT=0`（当前配置）

### 错误：the --mount option requires BuildKit

**原因：** Dockerfile 使用了 BuildKit 特性但 BuildKit 未启用

**解决方案：**
1. 移除 Dockerfile 中的 `--mount` 选项（当前配置）
2. 或者启用 BuildKit：`DOCKER_BUILDKIT=1`

## 推荐配置

对于生产环境，我们推荐：

1. **开发环境** - 启用 BuildKit 以获得最佳开发体验
2. **CI/CD 环境** - 根据 Docker 版本选择：
   - Docker 23.0+ with buildx → 启用 BuildKit
   - Docker 18.09-22.x → 使用传统模式（当前配置）
3. **生产部署** - 使用预构建镜像，无需关心构建模式

## 当前状态

✅ **兼容传统 Docker 构建**
- 无需 BuildKit
- 无需 buildx 组件
- 适用于 Docker 18.09+

如需启用 BuildKit 优化，请参考上述说明进行配置。
