# Jenkins模板构建Job设置指南

## 问题描述
当使用模板构建类型时，系统会尝试调用Jenkins的`CICD-STD/build-template` Job，但该Job不存在，导致构建失败并返回500错误。

## 解决方案

### 方案1：在Jenkins中创建模板构建Job（推荐）

#### 1.1 创建文件夹结构
1. 登录Jenkins管理界面
2. 如果不存在`CICD-STD`文件夹，先创建：
   - 点击"新建任务"
   - 选择"文件夹"类型
   - 名称填写：`CICD-STD`

#### 1.2 创建build-template Job
1. 进入`CICD-STD`文件夹
2. 点击"新建任务"
3. 任务名称：`build-template`
4. 选择"Pipeline"类型
5. 点击"确定"

#### 1.3 配置Job参数
在Job配置页面，勾选"This project is parameterized"，添加以下参数：

| 参数名 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| `SERVICE_ID` | String | - | 服务ID |
| `SERVICE_NAME` | String | - | 服务名称 |
| `PROJECT_ID` | String | - | 项目ID |
| `PROJECT_IDENTIFIER` | String | - | 项目标识 |
| `GIT_REPOSITORY` | String | - | Git仓库地址 |
| `GIT_BRANCH` | String | main | Git分支 |
| `GIT_PATH` | String | . | Git路径 |
| `GIT_PROVIDER` | String | gitlab | Git提供商 |
| `BUILD_TYPE` | String | template | 构建类型 |
| `IMAGE_REPOSITORY` | String | - | 镜像仓库 |
| `IMAGE_TAG` | String | - | 镜像标签 |
| `FULL_IMAGE` | String | - | 完整镜像名 |
| `SERVICE_IMAGE_ID` | String | - | 服务镜像ID |
| `TEMPLATE_ID` | String | - | 模板ID |
| `CUSTOM_DOCKERFILE` | Text | - | 自定义Dockerfile内容 |

#### 1.4 配置Pipeline脚本
将以下内容复制到Pipeline脚本区域：

```groovy
pipeline {
  agent any
  
  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }
  
  environment {
    // 默认值
    TEMPLATE_ID = "${params.TEMPLATE_ID ?: ''}"
    CUSTOM_DOCKERFILE = "${params.CUSTOM_DOCKERFILE ?: ''}"
    
    // Docker配置
    DOCKER_REGISTRY = "${env.DOCKER_REGISTRY ?: 'registry.cn-hangzhou.aliyuncs.com'}"
  }
  
  stages {
    stage('准备环境') {
      steps {
        script {
          echo "模板ID: ${env.TEMPLATE_ID}"
          echo "自定义Dockerfile: ${env.CUSTOM_DOCKERFILE ? '是' : '否'}"
          echo "目标镜像: ${params.FULL_IMAGE}"
        }
      }
    }
    
    stage('拉取代码') {
      steps {
        script {
          def gitPath = params.GIT_PATH?.trim() ?: '.'
          
          if (gitPath == '.' || gitPath == './') {
            checkout([
              $class: 'GitSCM',
              branches: [[name: "*/${params.GIT_BRANCH}"]],
              userRemoteConfigs: [[url: params.GIT_REPOSITORY]]
            ])
          } else {
            checkout([
              $class: 'GitSCM',
              branches: [[name: "*/${params.GIT_BRANCH}"]],
              userRemoteConfigs: [[url: params.GIT_REPOSITORY]],
              extensions: [[$class: 'SparseCheckoutPaths', sparseCheckoutPaths: [[path: gitPath]]]]
            ])
            
            // 切换到项目子目录
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
              // 使用自定义Dockerfile
              echo "使用自定义Dockerfile内容"
              writeFile file: 'Dockerfile.template', text: env.CUSTOM_DOCKERFILE
            } else {
              // 检查是否已存在Dockerfile
              if (fileExists('Dockerfile')) {
                echo "发现现有Dockerfile，将使用现有文件"
                sh 'cp Dockerfile Dockerfile.template'
              } else {
                // 生成默认Dockerfile（基于模板ID）
                echo "生成默认Dockerfile模板: ${env.TEMPLATE_ID}"
                def dockerfileContent = generateDefaultDockerfile(env.TEMPLATE_ID)
                writeFile file: 'Dockerfile.template', text: dockerfileContent
              }
            }
            
            // 显示Dockerfile内容
            echo "=== Dockerfile 内容 ==="
            sh 'cat Dockerfile.template'
            echo "======================="
          }
        }
      }
    }
    
    stage('构建Docker镜像') {
      steps {
        script {
          def gitPath = params.GIT_PATH?.trim() ?: '.'
          def workDir = (gitPath == '.' || gitPath == './') ? '.' : gitPath
          
          dir(workDir) {
            // 构建镜像
            def image = docker.build(params.FULL_IMAGE, '-f Dockerfile.template .')
            
            // 推送镜像
            docker.withRegistry("https://${env.DOCKER_REGISTRY}") {
              image.push()
              image.push('latest')
            }
            
            echo "镜像构建并推送成功: ${params.FULL_IMAGE}"
          }
        }
      }
    }
    
    stage('清理') {
      steps {
        script {
          def gitPath = params.GIT_PATH?.trim() ?: '.'
          def workDir = (gitPath == '.' || gitPath == './') ? '.' : gitPath
          
          dir(workDir) {
            // 清理临时文件
            sh 'rm -f Dockerfile.template'
            
            // 清理Docker镜像（保留最新的）
            sh """
              docker images --format 'table {{.Repository}}:{{.Tag}}' | grep '${params.IMAGE_REPOSITORY}' | tail -n +2 | head -n -1 | xargs -r docker rmi || true
            """
          }
        }
      }
    }
  }
  
  post {
    always {
      // 清理工作空间
      cleanWs()
    }
    
    success {
      echo "模板构建成功！"
      echo "模板ID: ${env.TEMPLATE_ID}"
      echo "镜像: ${params.FULL_IMAGE}"
    }
    
    failure {
      echo "模板构建失败！"
    }
  }
}

// 生成默认Dockerfile的函数
def generateDefaultDockerfile(templateId) {
  switch(templateId) {
    case 'pnpm-frontend':
      return '''# PNPM前端构建模板
FROM gplane/pnpm:node20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . ./
RUN pnpm run build

EXPOSE 3000
CMD ["pnpm", "start"]'''
    
    case 'maven-java21':
      return '''# Maven Java21构建模板
FROM nexus.aimstek.cn/aims-common/maven:3.9-eclipse-temurin-21

WORKDIR /app

ENV JAVA_OPTS="-Xms512m -Xmx1024m"
ENV MAVEN_OPTS="-Dmaven.repo.local=/root/.m2/repository"

COPY pom.xml ./
RUN mvn dependency:go-offline

COPY . ./
RUN mvn clean package -DskipTests

EXPOSE 8080
CMD ["java", "-jar", "target/*.jar"]'''
    
    case 'nginx-static':
      return '''# Nginx静态文件模板
FROM registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine

RUN rm -rf /usr/share/nginx/html/*
RUN rm -f /etc/nginx/conf.d/default.conf

COPY dist/ /usr/share/nginx/html/

RUN echo 'server { listen 80; server_name localhost; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]'''
    
    case 'node18-standard':
      return '''# Node.js 18标准应用模板
FROM registry.cn-hangzhou.aliyuncs.com/library/node:18-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

COPY . ./

EXPOSE 3000
CMD ["npm", "start"]'''
    
    case 'python-flask':
      return '''# Python Flask应用模板
FROM registry.cn-hangzhou.aliyuncs.com/library/python:3.11-slim

WORKDIR /app

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

EXPOSE 8000
CMD ["python", "app.py"]'''
    
    default:
      return '''# 自定义空白模板
FROM registry.cn-hangzhou.aliyuncs.com/library/ubuntu:22.04

WORKDIR /app

COPY . ./

EXPOSE 8080
CMD ["echo", "请配置启动命令"]'''
  }
}
```

#### 1.5 保存配置
点击"保存"完成Job创建。

### 方案2：临时使用默认Job（快速解决）

如果暂时无法创建专用Job，可以修改代码让模板构建使用默认Job：

```typescript
// 在 src/app/api/services/[id]/build/route.ts 中修改
} else if (serviceRecord.build_type === BuildType.TEMPLATE) {
  // 临时使用默认Job，直到创建专用的模板构建Job
  jobName = undefined // 使用环境变量中配置的默认 Job
  console.warn('[Services][Build] 模板构建暂时使用默认Job，建议创建 CICD-STD/build-template Job')
} else {
```

### 方案3：添加更好的错误处理

在构建失败时提供更清晰的错误信息：

```typescript
} catch (error) {
  let errorMessage = error instanceof JenkinsBuildError
    ? error.message || DEFAULT_BUILD_ERROR
    : error instanceof Error
      ? error.message
      : DEFAULT_BUILD_ERROR

  // 为模板构建提供特定的错误提示
  if (serviceRecord.build_type === BuildType.TEMPLATE && 
      error instanceof JenkinsBuildError && 
      error.message.includes('500')) {
    errorMessage = `模板构建Job不存在：请在Jenkins中创建 CICD-STD/build-template Job。详见文档：JENKINS_TEMPLATE_JOB_SETUP.md`
  }

  // ... 其余错误处理逻辑
}
```

## 推荐操作步骤

1. **立即解决**：使用方案2临时让模板构建工作
2. **长期解决**：按照方案1在Jenkins中创建专用Job
3. **用户体验**：实施方案3提供更好的错误提示

## 验证步骤

1. 创建Job后，在Jenkins中手动触发一次构建，确保脚本正常工作
2. 在平台中创建一个模板构建类型的服务
3. 触发构建，验证是否成功

## 注意事项

- 确保Jenkins有Docker环境和镜像仓库访问权限
- 根据实际情况调整镜像仓库地址和认证配置
- 模板ID必须与代码中定义的模板ID匹配