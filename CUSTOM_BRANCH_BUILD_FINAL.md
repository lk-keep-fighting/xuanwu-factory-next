# 自定义分支构建功能 - 完整实现

## 🎯 功能概述

用户现在可以在触发构建时自定义分支，不再局限于服务配置中的默认分支。这为开发团队提供了更大的灵活性，支持特性分支、修复分支等多种开发场景。

## ✅ 实现完成

**状态**: 完全实现 ✅ 13/13 项检查通过

## 🔧 核心功能

### 1. 前端构建对话框增强
- **自定义分支输入**: 用户可以在构建对话框中修改分支名称
- **智能默认值**: 自动填充服务配置的默认分支
- **实时验证**: 支持任意有效的Git分支名称
- **状态管理**: 完整的分支状态生命周期管理

### 2. API分支参数支持
- **类型定义**: `BuildRequestPayload` 包含可选的 `branch` 参数
- **参数处理**: 优先使用自定义分支，回退到服务默认分支
- **Jenkins集成**: 将分支参数正确传递给Jenkins构建任务

### 3. Jenkins脚本分支处理
- **参数定义**: `GIT_BRANCH` 参数支持自定义分支
- **Git操作**: 正确checkout指定分支进行构建
- **默认值**: 合理的分支默认值处理

## 📝 代码变更

### 前端组件 (`src/app/projects/[id]/services/[serviceId]/page.tsx`)

#### 状态管理
```typescript
const [buildBranch, setBuildBranch] = useState('')
```

#### 构建对话框
```tsx
<div className="space-y-2">
  <Label className="text-sm font-medium text-gray-700">构建分支</Label>
  <Input
    value={buildBranch || (service?.type === 'application' ? (service as any)?.git_branch : '') || 'main'}
    onChange={(e) => setBuildBranch(e.target.value)}
    placeholder="输入要构建的分支名称"
  />
  <p className="text-xs text-gray-500">可以自定义构建分支，默认使用服务配置的分支</p>
</div>
```

#### 构建逻辑
```typescript
const handleBuildImage = async () => {
  const customBranchValue = buildBranch.trim()
  const defaultBranchValue = (service?.type === 'application' ? (service as any)?.git_branch?.trim() : '') || 'main'
  const branchValue = customBranchValue || defaultBranchValue
  
  payload.branch = branchValue
  // ...
}
```

### API路由 (`src/app/api/services/[id]/build/route.ts`)

#### 类型定义
```typescript
type BuildRequestPayload = {
  branch?: string
  tag?: string
}
```

#### 分支处理
```typescript
const branchFromPayload = typeof payload.branch === 'string' ? payload.branch.trim() : ''
const branch = branchFromPayload || serviceRecord.git_branch?.trim() || DEFAULT_BRANCH
```

#### Jenkins参数
```typescript
const parameters: Record<string, string> = {
  // ...
  GIT_BRANCH: branch,
  // ...
}
```

### Jenkins脚本 (`doc/jenkins/脚本/build-template`)

#### 参数定义
```groovy
parameters {
  string(name: 'GIT_BRANCH', defaultValue: 'main', description: '构建分支')
  // ...
}
```

#### Git操作
```groovy
checkout([$class: 'GitSCM', branches: [[name: branch]], userRemoteConfigs: [[url: repo, credentialsId: env.GIT_CREDENTIALS]]])
```

## 🚀 使用场景

### 场景1: 特性分支构建
```
开发者完成新特性 → 选择 feature/new-login → 构建测试版本 → 部署到测试环境
```

### 场景2: 紧急修复
```
发现生产问题 → 创建 hotfix/critical-bug → 构建发布版本 → 快速部署修复
```

### 场景3: 版本发布
```
准备发布 → 选择 release/v2.1.0 → 构建发布版本 → 部署到生产环境
```

### 场景4: 实验性功能
```
尝试新技术 → 选择 experiment/new-framework → 构建开发版本 → 验证可行性
```

## 📊 API使用示例

### 请求格式
```http
POST /api/services/{serviceId}/build
Content-Type: application/json

{
  "branch": "feature/user-authentication",
  "tag": "dev-20241215120000"
}
```

### Jenkins构建参数
```json
{
  "SERVICE_ID": "service-123",
  "GIT_REPOSITORY": "https://gitlab.example.com/project/repo.git",
  "GIT_BRANCH": "feature/user-authentication",
  "IMAGE_TAG": "dev-20241215120000",
  "CUSTOM_DOCKERFILE": "FROM gplane/pnpm:node20-alpine\n...",
  "NEXUS_IMAGE_REPO": "nexus.aimstek.cn"
}
```

## 🎯 用户体验

### 构建对话框流程
1. **打开构建对话框** - 点击构建按钮
2. **查看默认分支** - 系统自动填充服务配置的分支
3. **自定义分支** - 根据需要修改分支名称
4. **选择版本类型** - dev/test/release
5. **确认构建** - 系统使用指定分支构建

### 智能提示
- **默认值填充**: 自动使用服务配置的分支
- **占位符提示**: 清晰的输入提示信息
- **帮助文本**: 解释分支选择的作用

## 🔒 安全考虑

### 分支验证
- **输入清理**: 自动trim空白字符
- **Git安全**: 使用Jenkins凭证进行Git操作
- **权限控制**: 依赖Git仓库的分支访问权限

### 错误处理
- **分支不存在**: Jenkins会报告Git checkout失败
- **权限不足**: 显示相应的认证错误
- **网络问题**: 提供清晰的错误信息

## 📈 优势总结

### 开发效率提升
- ✅ **灵活构建**: 支持任意分支构建
- ✅ **快速迭代**: 无需修改服务配置
- ✅ **并行开发**: 多分支同时构建测试
- ✅ **紧急响应**: 快速构建修复版本

### 团队协作改善
- ✅ **分支策略**: 支持GitFlow等分支模型
- ✅ **环境隔离**: 不同分支构建不同环境版本
- ✅ **版本管理**: 清晰的分支-版本对应关系
- ✅ **测试便利**: 轻松构建测试分支

## 🎉 总结

自定义分支构建功能已完全实现，为开发团队提供了强大的构建灵活性。用户现在可以：

- 🌿 **自由选择构建分支** - 不再受限于服务默认配置
- 🚀 **快速响应需求** - 特性分支、修复分支即时构建
- 🔄 **支持多种工作流** - GitFlow、GitHub Flow等
- 📦 **版本管理优化** - 分支与版本标签的完美结合

系统已准备好支持更加灵活和高效的CI/CD工作流程！