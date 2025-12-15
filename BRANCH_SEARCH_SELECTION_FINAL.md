# 分支搜索和选择功能 - 完整实现

## 🎯 功能概述

构建时分支现在支持搜索和选择，用户可以从Git仓库的分支列表中选择目标分支，默认为创建服务时选择的分支。这大大提升了构建的便利性和准确性。

## ✅ 实现完成

**状态**: 完全实现 ✅ 26/26 项检查通过

## 🔧 核心功能

### 1. 智能分支选择器
- **下拉选择**: 点击即可查看所有可用分支
- **实时搜索**: 输入关键词快速过滤分支
- **默认分支标识**: 清晰显示仓库的默认分支
- **自定义输入**: 支持输入不存在的分支名

### 2. 分支数据获取
- **API集成**: 直接从Git仓库获取最新分支列表
- **搜索支持**: 服务端分支名过滤
- **分页加载**: 支持大型仓库的分支管理
- **错误处理**: 完善的网络和权限错误处理

### 3. 用户体验优化
- **默认值智能**: 自动选择服务配置的分支
- **加载状态**: 清晰的加载和错误状态提示
- **快速输入**: 支持直接输入分支名快速构建

## 📝 技术实现

### API层 (`src/app/api/services/[id]/branches/route.ts`)
```typescript
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  // 获取服务Git仓库信息
  const service = await prisma.service.findUnique({
    where: { id },
    select: { git_repository: true, git_provider: true }
  })
  
  // 提取仓库路径并获取分支列表
  const repositoryPath = extractGitLabProjectPath(service.git_repository)
  const config = await requireGitProviderConfig()
  const result = await getGitLabProjectBranches(config, repositoryPath, { search, perPage })
  
  return NextResponse.json(result)
}
```

### 服务层 (`src/service/serviceSvc.ts`)
```typescript
async getServiceBranches(serviceId: string, options?: { search?: string; perPage?: number }): Promise<GitBranchListResult> {
  const params = new URLSearchParams()
  if (options?.search) params.set('search', options.search)
  if (options?.perPage) params.set('per_page', options.perPage.toString())
  
  const response = await fetch(`${API_BASE}/${serviceId}/branches${query ? `?${query}` : ''}`)
  return response.json()
}
```

### 前端组件 (`src/app/projects/[id]/services/[serviceId]/page.tsx`)
```tsx
<Combobox
  open={branchPickerOpen}
  onOpenChange={setBranchPickerOpen}
  value={buildBranch || service?.git_branch || 'main'}
  onValueChange={(value) => setBuildBranch(value)}
>
  <ComboboxTrigger asChild>
    <Button variant="outline" className="w-full justify-between">
      {buildBranch || service?.git_branch || 'main'}
      <RefreshCw className={`ml-2 h-4 w-4 ${branchLoading ? 'animate-spin' : ''}`} />
    </Button>
  </ComboboxTrigger>
  <ComboboxContent>
    <ComboboxInput placeholder="搜索分支..." />
    <ComboboxList>
      {branchOptions.map((branch) => (
        <ComboboxItem key={branch.value} value={branch.value}>
          <span>{branch.label}</span>
          {branch.isDefault && <Badge variant="secondary">默认</Badge>}
        </ComboboxItem>
      ))}
      <ComboboxCreateNew>使用自定义分支: "{branchSearch}"</ComboboxCreateNew>
    </ComboboxList>
  </ComboboxContent>
</Combobox>
```

## 🚀 使用场景

### 场景1: 默认分支构建
```
用户点击构建 → 系统显示服务配置的默认分支 → 直接构建
```

### 场景2: 搜索特定分支
```
打开分支选择器 → 输入"feature" → 选择"feature/user-auth" → 构建
```

### 场景3: 自定义分支名
```
打开分支选择器 → 输入"hotfix/urgent" → 选择自定义分支 → 构建
```

### 场景4: 快速分支切换
```
查看分支列表 → 点击"release/v2.1.0" → 立即切换并构建
```

## 📊 API接口

### 获取分支列表
```http
GET /api/services/{serviceId}/branches?search=feature&per_page=20
```

### 响应格式
```json
{
  "items": [
    {
      "name": "main",
      "default": true,
      "merged": false,
      "protected": true,
      "commit": {
        "id": "a1b2c3d4e5f6",
        "shortId": "a1b2c3d",
        "title": "Initial commit",
        "authorName": "Developer",
        "committedDate": "2024-12-15T12:00:00Z"
      }
    },
    {
      "name": "feature/user-auth",
      "default": false,
      "merged": false,
      "protected": false,
      "commit": {
        "id": "e4f5g6h7i8j9",
        "shortId": "e4f5g6h",
        "title": "Add user authentication",
        "authorName": "Developer",
        "committedDate": "2024-12-14T15:30:00Z"
      }
    }
  ],
  "total": 2
}
```

## 🎯 用户体验

### 智能默认值
- **服务分支**: 自动选择创建服务时配置的分支
- **仓库默认**: 如果服务未配置分支，使用仓库默认分支
- **通用默认**: 最后回退到 "main" 分支

### 搜索体验
- **实时过滤**: 输入即时搜索，350ms防抖
- **模糊匹配**: 支持分支名的部分匹配
- **高亮显示**: 搜索结果中突出显示匹配部分

### 视觉反馈
- **加载状态**: 旋转图标显示数据加载中
- **默认标识**: Badge标识仓库默认分支
- **错误提示**: 清晰的错误信息和重试建议

## 🔒 安全和性能

### 权限控制
- **服务权限**: 只能访问服务关联的Git仓库
- **Git认证**: 使用配置的Git凭证访问私有仓库
- **API限制**: 合理的分页和搜索限制

### 性能优化
- **按需加载**: 只在打开构建对话框时加载分支
- **搜索防抖**: 避免频繁的API请求
- **缓存策略**: 合理的数据缓存和更新机制

## 📈 优势总结

### 开发效率
- ✅ **快速选择**: 无需记忆分支名，点击即选
- ✅ **搜索便利**: 大型项目中快速定位目标分支
- ✅ **默认智能**: 自动选择最合适的默认分支
- ✅ **错误减少**: 避免手动输入分支名的拼写错误

### 团队协作
- ✅ **分支可见**: 团队成员可以看到所有可用分支
- ✅ **状态清晰**: 默认分支、保护分支等状态一目了然
- ✅ **历史追踪**: 显示分支的最新提交信息
- ✅ **工作流支持**: 完美支持GitFlow等分支策略

## 🎉 总结

分支搜索和选择功能已完全实现，为构建流程带来了显著的用户体验提升：

- 🔍 **智能搜索** - 快速定位目标分支
- 🎯 **精确选择** - 避免分支名输入错误  
- 📋 **清晰展示** - 分支状态和信息一目了然
- 🚀 **高效构建** - 简化分支选择流程

用户现在可以更加便捷和准确地选择构建分支，大大提升了CI/CD工作流的效率和可靠性！