# Jenkins 配置与使用指南

本文档说明如何为本平台配置 Jenkins，以便在“服务详情”页面触发 Jenkins 构建任务并产出可部署的应用镜像。如果缺失任一关键配置，前端会提示“Jenkins 未配置：请设置 JENKINS_BASE_URL 环境变量”等错误。

## 1. 集成概述

平台在调用 `/api/services/{id}/build` 接口时会：

1. 读取预先配置的 Jenkins 环境变量并初始化 Jenkins 客户端；
2. 根据服务信息生成镜像仓库地址、标签以及 Git 相关参数；
3. 调用 Jenkins `buildWithParameters` 触发参数化构建，并轮询队列/构建状态；
4. 将 Jenkins 构建结果（成功/失败、日志、构建号等）写回平台数据库。

因此，Jenkins 端需支持参数化构建，并能够执行完整的源代码拉取、镜像构建与推送逻辑。

## 2. 准备 Jenkins 环境

### 2.1 版本与插件建议

- Jenkins 2.3 及以上版本；
- 建议启用 **Pipeline** 插件以便使用流水线脚本；
- 如果开启了 CSRF 保护（默认开启），请确保 `/crumbIssuer/api/json` 可访问，或在 Jenkins 系统设置中启用“代理兼容的 CSRF 防护”。

### 2.2 创建专用访问账号

1. 以管理员身份登录 Jenkins；
2. 在「管理 Jenkins → 管理用户」中新建一个仅供平台调用的服务账号；
3. 为该账号生成 **API Token**（「用户详情 → 设置 → API Token → 新建」）；
4. 复制保存生成的用户名与 API Token，后续会填入平台环境变量。

> 建议仅授予触发目标 Job 所需的最小权限，例如“构建/读取”指定 Job 及其所在文件夹的权限。

## 3. 在平台部署中配置环境变量

在部署平台（本地 `.env`、Docker、Kubernetes 等）时需设置以下环境变量：

| 变量名 | 是否必填 | 说明 | 示例 |
| ------ | -------- | ---- | ---- |
| `JENKINS_BASE_URL` | ✅ | Jenkins 基础访问 URL，末尾无需 `/` | `https://jenkins.example.com` |
| `JENKINS_USER` / `JENKINS_USERNAME` | ✅ | 上文创建的 Jenkins 服务账号用户名 | `deploy-bot` |
| `JENKINS_API_TOKEN` | ✅ | 该账号对应的 API Token | `11aa22bb33cc...` |
| `JENKINS_JOB_NAME` | ✅ | 需要触发的 Jenkins Job 路径；若位于文件夹内需使用 `/` 组合 | `factory/build-app` |
| `JENKINS_JOB_TOKEN` | ⭕ | （可选）若 Job 开启了「构建令牌触发」，可在此填写 Token；为空则仅用 API 认证 | `trigger-token` |
| `JENKINS_BUILD_TIMEOUT_MS` | ⭕ | （可选）平台等待 Jenkins 完成构建的超时时间，默认 15 分钟 | `1800000` |
| `JENKINS_POLL_INTERVAL_MS` | ⭕ | （可选）平台轮询 Jenkins 队列 & 构建状态的间隔，默认 5000ms | `3000` |
| `APPLICATION_IMAGE_REGISTRY` / `APP_IMAGE_REGISTRY` | ⭕ | 平台生成镜像地址时使用的镜像仓库域名 | `registry.example.com` |
| `APPLICATION_IMAGE_NAMESPACE` / `APP_IMAGE_NAMESPACE` | ⭕ | 生成镜像路径时追加的命名空间（支持多级 `/`） | `apps/team-a` |
| `APPLICATION_IMAGE_SCOPE` | ⭕ | 额外的 scope 前缀，可用于区分环境 | `prod` |

> 若同时设置了 `APPLICATION_IMAGE_REGISTRY` 与 `APP_IMAGE_REGISTRY`，以 `APPLICATION_IMAGE_REGISTRY` 优先。命名空间与 scope 会被 slug 化后拼接。

部署在 Kubernetes 场景下，可在 `k8s-deployment.yaml` 相应的 Deployment 环节中新增上表变量。

## 4. 配置 Jenkins 任务

### 4.1 新建（或修改）参数化 Job

1. 在 Jenkins 中创建 **Pipeline** 或 **自由风格** 任务；
2. 勾选「This project is parameterized」（本项目是参数化的）；
3. 按下表添加构建参数（全部为文本类型即可）：

| 参数名 | 说明 | 是否必填 |
| ------ | ---- | -------- |
| `SERVICE_ID` | 平台内部服务 ID（可用于回调或记录） | ✅ |
| `SERVICE_NAME` | 服务名称 | ✅ |
| `PROJECT_ID` | 所属项目 ID | ✅ |
| `PROJECT_IDENTIFIER` | 项目标识（常用于拼接域名） | ⭕ |
| `GIT_REPOSITORY` | Git 仓库地址（含协议） | ✅ |
| `GIT_BRANCH` | 构建分支，若为空应回退到平台默认分支 | ✅ |
| `GIT_PATH` | 仓库内相对子路径（Monorepo 时使用） | ⭕ |
| `GIT_PROVIDER` | Git 提供商标识（github/gitlab/bitbucket/gitea） | ⭕ |
| `DOCKERFILE_PATH` | Dockerfile 路径（相对仓库根目录） | ⭕ |
| `BUILD_TYPE` | 构建方式（dockerfile） | ⭕ |
| `BUILD_ARGS` | JSON 字符串，描述额外的 `build-arg` 键值对 | ⭕ |
| `IMAGE_REPOSITORY` | 镜像仓库路径（不含标签） | ✅ |
| `IMAGE_TAG` | 镜像标签 | ✅ |
| `FULL_IMAGE` | 完整镜像名（`{repository}:{tag}`） | ✅ |

> 平台会保证 `BUILD_ARGS` 为合法 JSON；如不需要可忽略。

### 4.2 示例 Jenkinsfile

以下示例演示如何使用参数构建并推送 Docker 镜像（需 Jenkins 具备 Docker 环境，以及名为 `registry-credentials` 的凭证用于登录镜像仓库）：

```groovy
pipeline {
  agent any
  options {
    timestamps()
    ansiColor('xterm')
  }
  environment {
    REGISTRY = params.IMAGE_REPOSITORY.split('/')[0]
  }
  stages {
    stage('Checkout') {
      steps {
        checkout([
          $class: 'GitSCM',
          branches: [[name: params.GIT_BRANCH ?: 'main']],
          userRemoteConfigs: [[
            url: params.GIT_REPOSITORY
          ]]
        ])
        script {
          if (params.GIT_PATH?.trim()) {
            dir(params.GIT_PATH) {
              stash name: 'source'
            }
            deleteDir()
            unstash 'source'
          }
        }
      }
    }
    stage('Docker Build') {
      steps {
        script {
          def buildArgs = []
          if (params.BUILD_ARGS?.trim()) {
            def parsed = readJSON text: params.BUILD_ARGS
            parsed.each { key, value ->
              if (value != null && value.toString().trim()) {
                buildArgs << "--build-arg ${key}=${value}"
              }
            }
          }
          sh """
            docker build \
              -f ${params.DOCKERFILE_PATH ?: 'Dockerfile'} \
              ${buildArgs.join(' ')} \
              -t ${params.FULL_IMAGE} .
          """
        }
      }
    }
    stage('Push Image') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'registry-credentials', passwordVariable: 'REGISTRY_PASSWORD', usernameVariable: 'REGISTRY_USERNAME')]) {
          sh """
            echo "Login to ${REGISTRY}"
            echo ${REGISTRY_PASSWORD} | docker login ${REGISTRY} --username ${REGISTRY_USERNAME} --password-stdin
            docker push ${params.FULL_IMAGE}
          """
        }
      }
    }
  }
  post {
    always {
      sh 'docker image prune -f'
    }
  }
}
```

根据自身环境，替换镜像仓库凭证 ID、构建/推送逻辑，或拓展对 Nixpacks、Buildpacks 的支持。

### 4.3 （可选）配置 Job Token

若希望通过 Token 限制触发来源，可在 Job 的「构建触发器」中勾选「Build with Parameters → Trigger builds remotely」，并设定 Token；随后在平台中填写 `JENKINS_JOB_TOKEN`。

## 5. 验证集成

1. 确认平台部署已加载上述环境变量（重启服务后可通过日志打印或进程环境校验）；
2. 在 Jenkins 任务页面手动执行一次参数化构建，确保脚本能够正常拉取仓库、构建并推送镜像；
3. 在平台前端打开任一 Application 服务详情页，点击「触发构建」并填写分支/标签；
4. Jenkins 中应出现新的构建记录，完成后平台页面将刷新镜像列表；
5. 若 Jenkins 构建失败，平台会在镜像记录中显示失败日志片段。

## 6. 常见问题与排查

| 现象 | 可能原因 | 排查建议 |
| ---- | -------- | -------- |
| `Jenkins 未配置：请设置 JENKINS_BASE_URL 环境变量。` | 平台进程环境缺失必须变量 | 检查部署配置，确认变量已写入容器/服务并重启 |
| Jenkins 返回 401/403 | 用户名或 Token 无效、无权限、CSRF 限制 | 重新生成 Token；检查 Job/文件夹权限；确认 crumb 配置或在系统设置中允许 API 触发 |
| 构建成功但平台显示失败 | Jenkins 控制台日志长度超过限制或 Job 未返回 `SUCCESS` | 检查 Jenkins 构建结果是否为 `SUCCESS`；如使用 Pipeline，请确保未调用 `currentBuild.result = 'UNSTABLE'` |
| 镜像推送失败 | Jenkins 节点缺少 Docker/registry 凭证 | 在 Jenkins 上配置 Docker 客户端与凭证，并在脚本中 `docker login` |
| 未生成正确的镜像地址 | 未配置 `APPLICATION_IMAGE_*` 环境变量 | 根据需要补充镜像仓库、命名空间与 scope 变量 |

配置完成后，平台即可与 Jenkins 协同，通过一键构建产出可部署的应用镜像。
