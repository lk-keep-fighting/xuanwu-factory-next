# Java JAR构建Job配置指南

## 📋 概述

本文档说明如何在Jenkins中创建和配置`build-java-jar` Job，用于构建Java应用并将JAR包上传到Nexus仓库。

## 🔧 Jenkins Job创建步骤

### 1. 创建新的Pipeline Job

1. 登录Jenkins管理界面
2. 点击"新建任务"
3. 输入任务名称：`build-java-jar`
4. 选择"Pipeline"类型
5. 点击"确定"

### 2. 配置Job基本信息

在Job配置页面中：

**General 配置**:
- ✅ 勾选"参数化构建过程"
- ✅ 勾选"丢弃旧的构建"，保留构建数量：20

**Build Triggers**:
- 不需要配置定时触发，由平台API调用触发

### 3. Pipeline配置

**Pipeline 配置**:
- Definition: `Pipeline script`
- Script: 复制 `doc/jenkins/脚本/build-java-jar` 文件的完整内容

### 4. 必需的Jenkins插件

确保Jenkins已安装以下插件：
- Pipeline Plugin
- Git Plugin
- Credentials Plugin
- HTTP Request Plugin

### 5. 凭证配置

需要在Jenkins中配置以下凭证：

#### Git凭证 (jenkins-gitlab)
- **类型**: Username with password
- **ID**: `jenkins-gitlab`
- **用户名**: GitLab用户名或Token名称
- **密码**: GitLab密码或Personal Access Token
- **描述**: GitLab访问凭证

#### Nexus凭证 (nexus-admin)
- **类型**: Username with password  
- **ID**: `nexus-admin`
- **用户名**: Nexus管理员用户名
- **密码**: Nexus管理员密码
- **描述**: Nexus仓库访问凭证

### 6. 环境变量配置

在Jenkins系统配置中设置以下环境变量：

```bash
# Nexus配置
NEXUS_RAW_REPO=https://nexus.aimstek.cn/repository/raw-hosted

# 平台回调配置
BUILD_CALLBACK_BASE_URL=http://api.xuanwu-factory.dev.aimstek.cn
```

## 🏗️ Job参数说明

### 必需参数

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `GIT_REPOSITORY` | String | - | Git仓库地址（必填） |
| `SERVICE_NAME` | String | - | 服务名称 |
| `PROJECT_IDENTIFIER` | String | - | 项目标识 |

### 构建配置参数

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `BUILD_TOOL` | String | maven | 构建工具（maven/gradle） |
| `JAVA_VERSION` | String | 17 | Java版本（8/11/17/21） |
| `RUNTIME_IMAGE` | String | openjdk:17-jre-slim | 运行时镜像 |
| `JAVA_OPTIONS` | String | - | JVM参数 |
| `MAVEN_PROFILES` | String | - | Maven Profiles |
| `GRADLE_TASKS` | String | build | Gradle Tasks |

### 可选参数

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `GIT_BRANCH` | String | main | 构建分支 |
| `GIT_PATH` | String | - | 仓库子路径 |
| `BUILD_ARGS` | Text | - | 额外构建参数（JSON） |
| `SERVICE_IMAGE_ID` | String | - | 平台镜像记录ID |
| `BUILD_CALLBACK_URL` | String | - | 构建回调URL |

## 🔄 构建流程

### 1. 代码检出
- 从Git仓库检出指定分支的代码
- 支持子路径构建

### 2. Java环境设置
- 根据`JAVA_VERSION`参数设置Java环境
- 验证Java版本和环境变量

### 3. JAR包构建
- **Maven**: 执行`mvn clean package -DskipTests`
- **Gradle**: 执行`./gradlew build`或指定的tasks
- 支持Maven Profiles和Gradle自定义任务

### 4. JAR包准备
- 自动查找构建产物中的JAR文件
- 排除sources和javadoc JAR包
- 复制到标准位置`artifacts/application.jar`

### 5. 上传到Nexus
- 上传带版本号的JAR包：`{project}/{service}/{branch}/{service}-{branch}-{build}.jar`
- 上传最新版本JAR包：`{project}/{service}/latest/{service}-latest.jar`

### 6. 验证和回调
- 验证JAR包上传成功
- 发送构建结果回调到平台API

## 📁 Nexus存储结构

JAR包在Nexus中的存储路径结构：

```
raw-hosted/
├── {project_identifier}/
│   └── {service_name}/
│       ├── main/
│       │   ├── {service_name}-main-1.jar
│       │   ├── {service_name}-main-2.jar
│       │   └── ...
│       ├── develop/
│       │   ├── {service_name}-develop-1.jar
│       │   └── ...
│       └── latest/
│           └── {service_name}-latest.jar  # 最新版本的符号链接
```

### 示例路径

对于项目`xuanwu-platform`中的服务`user-service`：

```
# 带版本号的JAR包
https://nexus.aimstek.cn/repository/raw-hosted/xuanwu-platform/user-service/main/user-service-main-15.jar

# 最新版本JAR包
https://nexus.aimstek.cn/repository/raw-hosted/xuanwu-platform/user-service/latest/user-service-latest.jar
```

## 🔍 故障排查

### 常见问题

#### 1. Git检出失败
- **原因**: Git凭证配置错误或仓库地址无效
- **解决**: 检查`jenkins-gitlab`凭证配置和仓库地址

#### 2. Java环境问题
- **原因**: 指定的Java版本未安装
- **解决**: 在Jenkins节点上安装对应的Java版本

#### 3. Maven/Gradle构建失败
- **原因**: 依赖下载失败或构建脚本错误
- **解决**: 检查网络连接和构建配置

#### 4. JAR文件未找到
- **原因**: 构建未生成JAR文件或路径不正确
- **解决**: 检查构建日志和target/build目录

#### 5. Nexus上传失败
- **原因**: Nexus凭证错误或网络问题
- **解决**: 检查`nexus-admin`凭证和网络连接

### 调试技巧

1. **查看构建日志**: 在Jenkins构建页面查看详细日志
2. **验证环境变量**: 检查Java环境和路径设置
3. **测试凭证**: 手动测试Git和Nexus凭证
4. **检查网络**: 确保Jenkins节点可以访问Git和Nexus

## 📊 监控和维护

### 构建监控

- 监控构建成功率和构建时间
- 设置构建失败通知
- 定期清理旧的构建记录

### 存储管理

- 定期清理Nexus中的旧版本JAR包
- 监控存储空间使用情况
- 备份重要的JAR包版本

### 性能优化

- 使用Maven/Gradle本地缓存
- 并行构建多个模块
- 优化Docker镜像大小

## 🔐 安全考虑

### 凭证管理
- 定期轮换Git和Nexus密码
- 使用最小权限原则
- 避免在日志中暴露敏感信息

### 网络安全
- 使用HTTPS连接Git和Nexus
- 配置防火墙规则
- 启用访问日志审计

## 📝 总结

通过以上配置，Jenkins将能够：

1. ✅ 自动从Git仓库检出Java项目代码
2. ✅ 使用Maven或Gradle构建JAR包
3. ✅ 将JAR包上传到Nexus二进制仓库
4. ✅ 支持多Java版本和构建工具
5. ✅ 提供详细的构建日志和错误处理
6. ✅ 与平台API集成，支持构建状态回调

这个Jenkins Job与平台的Java JAR构建类型完美集成，为Java应用提供了完整的CI/CD支持。