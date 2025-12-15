# 构建类型清理完成

## 任务描述
根据用户要求，只保留 Dockerfile 和模板构建两个选项，删除其他构建方式及相关代码。

## 清理内容

### 1. BuildType 枚举清理
**文件**: `src/types/project.ts`

**删除的构建类型**:
- `JAVA_JAR = 'java_jar'` - Java JAR包构建
- `FRONTEND = 'frontend'` - 前端构建（Node.js/静态文件）
- `NIXPACKS = 'nixpacks'` - Nixpacks构建
- `BUILDPACKS = 'buildpacks'` - Buildpacks构建

**保留的构建类型**:
- `DOCKERFILE = 'dockerfile'` - Dockerfile构建
- `TEMPLATE = 'template'` - 模板构建

### 2. BuildConfigurationCard 组件清理
**文件**: `src/components/services/BuildConfigurationCard.tsx`

**删除的功能**:
- `renderJavaJarConfig()` 函数及其完整实现
- `renderFrontendConfig()` 函数及其完整实现
- Java JAR 和前端构建的选择选项
- 相关的配置界面和参数设置

**保留的功能**:
- Dockerfile 构建配置
- 模板构建配置
- `getBuildTypeLabel()` 函数（简化版）

### 3. ServiceCreateForm 组件清理
**文件**: `src/app/projects/components/ServiceCreateForm.tsx`

**删除的功能**:
- Java JAR 构建配置表单（构建工具、Java版本、运行时镜像、JVM参数）
- 前端构建配置表单（前端框架、Node.js版本、构建命令、输出目录、Nginx镜像、安装命令）
- 相关的表单验证和参数处理逻辑

**保留的功能**:
- Dockerfile 构建表单
- 模板构建表单
- 基础的构建参数处理

### 4. 构建API路由清理
**文件**: `src/app/api/services/[id]/build/route.ts`

**删除的功能**:
- Java JAR 构建特定参数处理
- 前端构建特定参数处理
- `build-java-jar` Jenkins Job 调用
- `build-frontend` Jenkins Job 调用

**保留的功能**:
- 默认 Dockerfile 构建逻辑
- `build-template` Jenkins Job 调用
- 模板构建参数处理

## 验证结果
✅ **所有测试通过** (24/24)

### 枚举定义验证
- ✅ 包含 DOCKERFILE 类型
- ✅ 包含 TEMPLATE 类型
- ✅ 不包含 JAVA_JAR 类型
- ✅ 不包含 FRONTEND 类型
- ✅ 不包含 NIXPACKS 类型
- ✅ 不包含 BUILDPACKS 类型

### 组件清理验证
- ✅ BuildConfigurationCard 不包含已删除的构建类型
- ✅ ServiceCreateForm 不包含已删除的配置界面
- ✅ 构建API不包含已删除的构建逻辑

### TypeScript 验证
- ✅ 所有文件无 TypeScript 错误
- ✅ 类型定义一致性检查通过

## 影响范围

### 用户界面
- 服务创建表单只显示 Dockerfile 和模板构建选项
- 服务配置页面只显示相应的构建配置
- 简化了用户选择，减少了复杂性

### 后端逻辑
- 构建API只处理 Dockerfile 和模板构建
- Jenkins Job 调用简化为两种类型
- 减少了参数处理的复杂性

### 代码维护
- 删除了大量冗余代码（约500行）
- 简化了构建类型判断逻辑
- 提高了代码可维护性

## 状态
✅ **已完成** - 构建类型清理成功，系统现在只支持 Dockerfile 和模板构建两种方式

## 后续建议
1. 更新相关文档，说明支持的构建类型
2. 检查是否有其他地方引用了已删除的构建类型
3. 考虑为现有使用已删除构建类型的服务提供迁移方案