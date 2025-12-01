# Jenkins 构建优化：自动追加 Commit ID

## 改进内容

### 1. 自动获取 Git Commit 信息

在 `Checkout` 阶段自动获取：
- `GIT_COMMIT_SHORT` - 短格式 commit ID（7位）
- `GIT_COMMIT_FULL` - 完整 commit ID
- `GIT_COMMIT_MESSAGE` - commit 消息
- `GIT_AUTHOR` - 提交作者

```groovy
// 获取 Git commit ID
env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
env.GIT_COMMIT_FULL = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
env.GIT_COMMIT_MESSAGE = sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
env.GIT_AUTHOR = sh(script: 'git log -1 --pretty=%an', returnStdout: true).trim()
```

### 2. 镜像 Tag 自动追加 Commit ID

新增参数：
```groovy
booleanParam(name: 'APPEND_COMMIT_ID', defaultValue: true, description: '是否在镜像 tag 后追加 commit ID')
```

**Tag 生成逻辑**：

| 原始 Tag | APPEND_COMMIT_ID | Commit ID | 最终 Tag |
|----------|------------------|-----------|----------|
| `latest` | `true` | `a1b2c3d` | `a1b2c3d` |
| `dev` | `true` | `a1b2c3d` | `dev-a1b2c3d` |
| `v1.0.0` | `true` | `a1b2c3d` | `v1.0.0-a1b2c3d` |
| `latest` | `false` | `a1b2c3d` | `latest` |

**实现代码**：
```groovy
def finalTag = params.IMAGE_TAG?.trim() ?: 'latest'

if (params.APPEND_COMMIT_ID && env.GIT_COMMIT_SHORT) {
  if (finalTag == 'latest') {
    // latest 替换为 commit ID
    finalTag = env.GIT_COMMIT_SHORT
  } else {
    // 其他 tag 追加 commit ID
    finalTag = "${finalTag}-${env.GIT_COMMIT_SHORT}"
  }
  echo "Tag with commit ID: ${finalTag}"
}
```

### 3. Git 信息作为 Build Args

自动将 Git 信息传递给 Docker 构建：

```groovy
buildArgFlags += " --build-arg GIT_COMMIT=${env.GIT_COMMIT_FULL}"
buildArgFlags += " --build-arg GIT_COMMIT_SHORT=${env.GIT_COMMIT_SHORT}"
buildArgFlags += " --build-arg GIT_BRANCH=${params.GIT_BRANCH}"
```

**在 Dockerfile 中使用**：
```dockerfile
ARG GIT_COMMIT
ARG GIT_COMMIT_SHORT
ARG GIT_BRANCH

# 添加标签
LABEL git.commit="${GIT_COMMIT}" \
      git.commit.short="${GIT_COMMIT_SHORT}" \
      git.branch="${GIT_BRANCH}"

# 或者写入文件
RUN echo "${GIT_COMMIT_SHORT}" > /app/version.txt
```

### 4. 回调数据增强

在构建回调中包含更多 Git 信息：

```groovy
metadata: [
  builder: 'jenkins',
  node: env.NODE_NAME ?: 'unknown',
  job_name: env.JOB_NAME,
  git_branch: params.GIT_BRANCH,
  git_repository: params.GIT_REPOSITORY,
  git_commit: env.GIT_COMMIT_FULL ?: '',
  git_commit_short: env.GIT_COMMIT_SHORT ?: '',
  git_commit_message: env.GIT_COMMIT_MESSAGE ?: '',
  git_author: env.GIT_AUTHOR ?: ''
]
```

## 使用示例

### 示例 1：默认行为（追加 commit ID）

**参数**：
```
GIT_REPOSITORY: https://gitlab.com/myproject/myapp.git
GIT_BRANCH: main
IMAGE_REPOSITORY: xuanwu-factory/myapp
IMAGE_TAG: dev
APPEND_COMMIT_ID: true (默认)
```

**结果**：
```
Commit ID: a1b2c3d
最终镜像: nexus.aimstek.cn/xuanwu-factory/myapp:dev-a1b2c3d
```

### 示例 2：latest 标签

**参数**：
```
IMAGE_TAG: latest
APPEND_COMMIT_ID: true
```

**结果**：
```
Commit ID: a1b2c3d
最终镜像: nexus.aimstek.cn/xuanwu-factory/myapp:a1b2c3d
```

### 示例 3：禁用 commit ID

**参数**：
```
IMAGE_TAG: v1.0.0
APPEND_COMMIT_ID: false
```

**结果**：
```
最终镜像: nexus.aimstek.cn/xuanwu-factory/myapp:v1.0.0
```

### 示例 4：在 Dockerfile 中使用

**Dockerfile**：
```dockerfile
FROM node:20-alpine

# 接收 build args
ARG GIT_COMMIT_SHORT
ARG GIT_BRANCH

# 设置环境变量
ENV APP_VERSION=${GIT_COMMIT_SHORT} \
    APP_BRANCH=${GIT_BRANCH}

# 添加标签
LABEL version="${GIT_COMMIT_SHORT}" \
      branch="${GIT_BRANCH}"

WORKDIR /app
COPY . .

# 写入版本文件
RUN echo "Version: ${GIT_COMMIT_SHORT}" > /app/version.txt && \
    echo "Branch: ${GIT_BRANCH}" >> /app/version.txt

CMD ["node", "server.js"]
```

**构建后查看**：
```bash
# 查看镜像标签
docker inspect nexus.aimstek.cn/xuanwu-factory/myapp:dev-a1b2c3d

# 查看版本信息
docker run --rm nexus.aimstek.cn/xuanwu-factory/myapp:dev-a1b2c3d cat /app/version.txt
# 输出:
# Version: a1b2c3d
# Branch: main
```

## 优势

### 1. 可追溯性
- 每个镜像都包含 commit ID，可以追溯到具体代码版本
- 方便问题排查和回滚

### 2. 唯一性
- 不同 commit 生成不同的镜像 tag
- 避免镜像覆盖问题

### 3. 版本管理
- 清晰的版本标识：`dev-a1b2c3d`
- 易于识别和管理

### 4. 灵活性
- 可以通过 `APPEND_COMMIT_ID` 参数控制是否追加
- 兼容现有流程

### 5. 元数据丰富
- 镜像包含完整的 Git 信息
- 回调数据包含 commit 信息，方便平台展示

## 平台集成

### 前端显示优化

在构建历史中显示 commit 信息：

```tsx
// 从 metadata 中提取 commit 信息
const commitShort = image.metadata?.git_commit_short
const commitMessage = image.metadata?.git_commit_message
const author = image.metadata?.git_author

// 显示
<div className="text-xs text-gray-600">
  <GitCommit className="h-3 w-3" />
  <span>{commitShort}</span>
  {commitMessage && <span className="ml-2">{commitMessage}</span>}
</div>
```

### 数据库存储

确保 `service_images` 表的 `metadata` 字段包含：
```json
{
  "git_commit": "a1b2c3d4e5f6g7h8i9j0",
  "git_commit_short": "a1b2c3d",
  "git_commit_message": "feat: add new feature",
  "git_author": "张三",
  "git_branch": "main",
  "git_repository": "https://gitlab.com/myproject/myapp.git"
}
```

## 迁移指南

### 1. 更新 Jenkins Job

将 `build-by-dockerfile-optimized` 的内容复制到 Jenkins Job 配置中。

### 2. 测试构建

```bash
# 测试默认行为（追加 commit ID）
curl -X POST "http://jenkins.example.com/job/build-by-dockerfile/buildWithParameters" \
  -d "GIT_REPOSITORY=https://gitlab.com/myproject/myapp.git" \
  -d "GIT_BRANCH=main" \
  -d "IMAGE_REPOSITORY=xuanwu-factory/myapp" \
  -d "IMAGE_TAG=dev" \
  -d "APPEND_COMMIT_ID=true"

# 测试禁用 commit ID
curl -X POST "http://jenkins.example.com/job/build-by-dockerfile/buildWithParameters" \
  -d "GIT_REPOSITORY=https://gitlab.com/myproject/myapp.git" \
  -d "GIT_BRANCH=main" \
  -d "IMAGE_REPOSITORY=xuanwu-factory/myapp" \
  -d "IMAGE_TAG=v1.0.0" \
  -d "APPEND_COMMIT_ID=false"
```

### 3. 更新平台调用

在平台的构建 API 中添加 `APPEND_COMMIT_ID` 参数：

```typescript
// src/lib/jenkins.ts
export async function triggerBuild(params: {
  gitRepository: string
  gitBranch: string
  imageRepository: string
  imageTag: string
  appendCommitId?: boolean  // 新增
  // ... 其他参数
}) {
  const jenkinsParams = {
    GIT_REPOSITORY: params.gitRepository,
    GIT_BRANCH: params.gitBranch,
    IMAGE_REPOSITORY: params.imageRepository,
    IMAGE_TAG: params.imageTag,
    APPEND_COMMIT_ID: params.appendCommitId ?? true,  // 默认启用
    // ... 其他参数
  }
  
  // 触发 Jenkins 构建
  // ...
}
```

### 4. 验证

构建完成后，检查：
- ✅ 镜像 tag 包含 commit ID
- ✅ 回调数据包含 Git 信息
- ✅ 平台正确显示镜像信息

## 常见问题

### Q1: 如果不想追加 commit ID 怎么办？

设置 `APPEND_COMMIT_ID=false`。

### Q2: commit ID 会影响镜像缓存吗？

不会。commit ID 只影响镜像 tag，不影响构建过程和缓存。

### Q3: 如何在容器内获取版本信息？

方法 1：通过环境变量
```bash
docker run --rm myapp:dev-a1b2c3d env | grep APP_VERSION
```

方法 2：通过文件
```bash
docker run --rm myapp:dev-a1b2c3d cat /app/version.txt
```

方法 3：通过镜像标签
```bash
docker inspect myapp:dev-a1b2c3d --format '{{.Config.Labels.version}}'
```

### Q4: 旧的构建会受影响吗？

不会。`APPEND_COMMIT_ID` 默认为 `true`，但如果平台没有传递这个参数，Jenkins 会使用默认值。旧的构建流程保持不变。

## 总结

通过自动追加 commit ID，实现了：
- ✅ 镜像版本可追溯
- ✅ 避免镜像覆盖
- ✅ 丰富的元数据
- ✅ 灵活的配置
- ✅ 向后兼容

建议在所有新项目中启用此功能。
