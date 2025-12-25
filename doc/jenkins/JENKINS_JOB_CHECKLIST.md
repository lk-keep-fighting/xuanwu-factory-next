# Jenkins Job配置检查清单

## 当前问题
- Job已创建：`http://192.168.44.121/view/工业操作系统/job/CICD-STD/job/build-template/`
- 但API调用返回500错误
- 需要检查Job配置是否完整

## 必须检查的配置项

### 1. 参数化构建配置 ✅
**位置**: Job配置 → General → This project is parameterized

**必须添加的参数**:
```
SERVICE_ID (String) - 服务ID
SERVICE_NAME (String) - 服务名称  
PROJECT_ID (String) - 项目ID
PROJECT_IDENTIFIER (String) - 项目标识
GIT_REPOSITORY (String) - Git仓库地址
GIT_BRANCH (String) - Git分支，默认值: main
GIT_PATH (String) - Git路径，默认值: .
GIT_PROVIDER (String) - Git提供商，默认值: gitlab
BUILD_TYPE (String) - 构建类型，默认值: template
IMAGE_REPOSITORY (String) - 镜像仓库
IMAGE_TAG (String) - 镜像标签
FULL_IMAGE (String) - 完整镜像名
SERVICE_IMAGE_ID (String) - 服务镜像ID
TEMPLATE_ID (String) - 模板ID
CUSTOM_DOCKERFILE (Text) - 自定义Dockerfile内容
```

### 2. Pipeline脚本配置 ✅
**位置**: Job配置 → Pipeline → Definition: Pipeline script

**脚本内容**: 使用我们提供的完整Pipeline脚本

### 3. 权限检查 ✅
- 确保API Token用户有构建权限
- 确保可以访问CICD-STD文件夹
- 确保可以触发build-template Job

## 快速验证步骤

### 步骤1: 检查参数配置
1. 进入Job配置页面
2. 确认勾选了"This project is parameterized"
3. 确认添加了所有必需参数

### 步骤2: 手动触发测试
1. 点击"Build with Parameters"
2. 填写测试参数：
   ```
   SERVICE_ID: test-123
   SERVICE_NAME: test-service
   PROJECT_ID: test-project
   GIT_REPOSITORY: https://github.com/octocat/Hello-World.git
   GIT_BRANCH: main
   IMAGE_REPOSITORY: test/app
   IMAGE_TAG: test
   FULL_IMAGE: test/app:test
   SERVICE_IMAGE_ID: test-image-123
   TEMPLATE_ID: node18-standard
   ```
3. 点击"Build"
4. 查看构建日志是否正常

### 步骤3: 检查API访问
使用curl测试API访问：
```bash
curl -X POST \
  "http://192.168.44.121/job/CICD-STD/job/build-template/buildWithParameters" \
  -u "用户名:API_TOKEN" \
  -d "SERVICE_ID=test-123" \
  -d "SERVICE_NAME=test-service" \
  -d "GIT_REPOSITORY=https://github.com/octocat/Hello-World.git" \
  -d "GIT_BRANCH=main" \
  -d "IMAGE_REPOSITORY=test/app" \
  -d "IMAGE_TAG=test" \
  -d "FULL_IMAGE=test/app:test" \
  -d "SERVICE_IMAGE_ID=test-image-123"
```

## 常见问题排查

### 问题1: 500错误 - Job未配置为参数化
**症状**: API调用返回500错误
**解决**: 确保勾选"This project is parameterized"并添加所有参数

### 问题2: 403错误 - 权限不足
**症状**: API调用返回403错误
**解决**: 检查API Token权限，确保用户可以构建Job

### 问题3: 404错误 - Job路径错误
**症状**: API调用返回404错误
**解决**: 确认Job路径正确，文件夹和Job名称匹配

### 问题4: 构建失败 - 脚本错误
**症状**: 构建开始但失败
**解决**: 检查Pipeline脚本，确保语法正确

## 完整的Pipeline脚本模板

```groovy
pipeline {
  agent any
  
  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }
  
  environment {
    TEMPLATE_ID = "${params.TEMPLATE_ID ?: ''}"
    CUSTOM_DOCKERFILE = "${params.CUSTOM_DOCKERFILE ?: ''}"
    DOCKER_REGISTRY = "${env.DOCKER_REGISTRY ?: 'registry.cn-hangzhou.aliyuncs.com'}"
  }
  
  stages {
    stage('验证参数') {
      steps {
        script {
          echo "=== 构建参数 ==="
          echo "服务ID: ${params.SERVICE_ID}"
          echo "服务名称: ${params.SERVICE_NAME}"
          echo "Git仓库: ${params.GIT_REPOSITORY}"
          echo "Git分支: ${params.GIT_BRANCH}"
          echo "模板ID: ${env.TEMPLATE_ID}"
          echo "目标镜像: ${params.FULL_IMAGE}"
          echo "==============="
          
          // 验证必需参数
          if (!params.SERVICE_ID) error("缺少参数: SERVICE_ID")
          if (!params.GIT_REPOSITORY) error("缺少参数: GIT_REPOSITORY")
          if (!params.FULL_IMAGE) error("缺少参数: FULL_IMAGE")
        }
      }
    }
    
    stage('拉取代码') {
      steps {
        script {
          def gitPath = params.GIT_PATH?.trim() ?: '.'
          
          checkout([
            $class: 'GitSCM',
            branches: [[name: "*/${params.GIT_BRANCH ?: 'main'}"]],
            userRemoteConfigs: [[url: params.GIT_REPOSITORY]]
          ])
          
          if (gitPath != '.' && gitPath != './') {
            dir(gitPath) {
              echo "切换到项目目录: ${gitPath}"
            }
          }
        }
      }
    }
    
    stage('准备Dockerfile') {
      steps {
        script {
          def gitPath = params.GIT_PATH?.trim() ?: '.'
          def workDir = (gitPath == '.' || gitPath == './') ? '.' : gitPath
          
          dir(workDir) {
            if (env.CUSTOM_DOCKERFILE && env.CUSTOM_DOCKERFILE.trim()) {
              echo "使用自定义Dockerfile"
              writeFile file: 'Dockerfile.template', text: env.CUSTOM_DOCKERFILE
            } else if (fileExists('Dockerfile')) {
              echo "使用现有Dockerfile"
              sh 'cp Dockerfile Dockerfile.template'
            } else {
              echo "生成默认Dockerfile: ${env.TEMPLATE_ID}"
              def dockerfileContent = generateDefaultDockerfile(env.TEMPLATE_ID)
              writeFile file: 'Dockerfile.template', text: dockerfileContent
            }
            
            echo "=== Dockerfile内容 ==="
            sh 'cat Dockerfile.template'
            echo "===================="
          }
        }
      }
    }
    
    stage('构建镜像') {
      steps {
        script {
          def gitPath = params.GIT_PATH?.trim() ?: '.'
          def workDir = (gitPath == '.' || gitPath == './') ? '.' : gitPath
          
          dir(workDir) {
            echo "开始构建镜像: ${params.FULL_IMAGE}"
            sh "docker build -f Dockerfile.template -t ${params.FULL_IMAGE} ."
            echo "镜像构建完成"
          }
        }
      }
    }
  }
  
  post {
    always {
      cleanWs()
    }
    success {
      echo "✅ 构建成功: ${params.FULL_IMAGE}"
    }
    failure {
      echo "❌ 构建失败"
    }
  }
}

def generateDefaultDockerfile(templateId) {
  switch(templateId) {
    case 'node18-standard':
      return '''FROM registry.cn-hangzhou.aliyuncs.com/library/node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --only=production
COPY . ./
EXPOSE 3000
CMD ["npm", "start"]'''
    
    case 'pnpm-frontend':
      return '''FROM gplane/pnpm:node20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . ./
RUN pnpm run build
EXPOSE 3000
CMD ["pnpm", "start"]'''
    
    default:
      return '''FROM registry.cn-hangzhou.aliyuncs.com/library/ubuntu:22.04
WORKDIR /app
COPY . ./
EXPOSE 8080
CMD ["echo", "Hello from template build"]'''
  }
}
```

## 验证成功标志
- ✅ 手动构建可以成功触发
- ✅ 构建日志显示正常
- ✅ API调用不再返回500错误
- ✅ 平台可以正常触发构建

完成以上检查后，模板构建应该可以正常工作。