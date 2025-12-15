# 创建build-java-jar Jenkins Job指南

## 🚨 问题描述

当前系统报错：`触发 Jenkins 构建失败（404）`，这是因为Jenkins中不存在`build-java-jar` Job。

## 🔧 解决方案

### 方案1：在Jenkins中创建build-java-jar Job

1. **登录Jenkins管理界面**
2. **创建新Job**：
   - 进入`CICD-STD`文件夹（如果不存在则先创建文件夹）
   - 点击"新建任务"
   - 任务名称：`build-java-jar`
   - 选择"Pipeline"类型
   - 点击"确定"
   
   **注意**: Job的完整路径应该是`CICD-STD/build-java-jar`

3. **配置Job**：
   - 勾选"参数化构建过程"
   - Pipeline配置选择"Pipeline script"
   - 将`doc/jenkins/脚本/build-java-jar`文件内容复制到Script框中

4. **保存配置**

### 方案2：修改现有Job支持多种构建类型

如果不想创建新Job，可以修改现有的Job来支持Java JAR构建：

1. **修改现有的build Job**
2. **在Pipeline脚本中添加构建类型判断**：

```groovy
stage('Build') {
  steps {
    script {
      if (params.BUILD_TYPE == 'java_jar') {
        // Java JAR构建逻辑
        buildJavaJar()
      } else {
        // Docker镜像构建逻辑
        buildDockerImage()
      }
    }
  }
}
```

### 方案3：临时使用现有Job（快速修复）

如果需要快速修复，可以临时让Java JAR构建也使用现有的Job：

```typescript
// 在 src/app/api/services/[id]/build/route.ts 中修改
const jobName = 'build-dockerfile' // 临时使用现有Job
```

## 🎯 推荐方案

**推荐使用方案1**，因为：
1. 保持构建逻辑的清晰分离
2. 便于维护和调试
3. 符合原始设计意图

## 📋 创建Job的详细步骤

### 1. 准备工作
确保Jenkins已安装必要插件：
- Pipeline Plugin
- Git Plugin
- Credentials Plugin

### 2. 创建Job
1. 登录Jenkins：`https://your-jenkins-url`
2. 点击"新建任务"
3. 进入`CICD-STD`文件夹，输入任务名称：`build-java-jar`
4. 选择"Pipeline"
5. 点击"确定"

### 3. 配置参数
在"General"部分勾选"参数化构建过程"，添加以下参数：

| 参数名 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| SERVICE_ID | String | - | 服务ID |
| SERVICE_NAME | String | - | 服务名称 |
| PROJECT_IDENTIFIER | String | - | 项目标识 |
| GIT_REPOSITORY | String | - | Git仓库地址 |
| GIT_BRANCH | String | main | Git分支 |
| BUILD_TOOL | String | maven | 构建工具 |
| JAVA_VERSION | String | 17 | Java版本 |
| RUNTIME_IMAGE | String | openjdk:17-jre-slim | 运行时镜像 |
| SERVICE_IMAGE_ID | String | - | 镜像记录ID |

### 4. 配置Pipeline
在"Pipeline"部分：
- Definition: Pipeline script
- Script: 复制`doc/jenkins/脚本/build-java-jar`的完整内容

### 5. 配置凭证
确保Jenkins中已配置：
- `jenkins-gitlab`: GitLab访问凭证
- `nexus-admin`: Nexus仓库凭证

### 6. 测试Job
1. 保存配置
2. 点击"立即构建"
3. 填写测试参数
4. 查看构建日志确认正常

## 🔍 验证步骤

创建Job后，可以通过以下方式验证：

1. **手动触发测试**：
   - 在Jenkins中手动触发`build-java-jar` Job
   - 填写测试参数
   - 查看构建日志

2. **平台集成测试**：
   - 在平台中创建Java JAR类型的服务
   - 点击"触发构建"
   - 确认不再出现404错误

3. **检查Nexus**：
   - 构建成功后检查Nexus仓库
   - 确认JAR包已正确上传

## 📝 注意事项

1. **Job路径必须精确匹配**：`CICD-STD/build-java-jar`
2. **参数名称必须与代码中一致**
3. **凭证ID必须正确配置**
4. **Nexus仓库地址必须可访问**

完成以上步骤后，Java JAR构建功能应该可以正常工作。