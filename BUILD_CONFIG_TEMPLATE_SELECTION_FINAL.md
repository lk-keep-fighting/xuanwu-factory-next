# 构建配置模板选择功能增强完成

## 需求描述
用户希望在服务详情页面的"构建与部署"标签中，构建配置功能应该可以重新选择构建模板并覆盖自定义Dockerfile。

## 功能增强

### 1. 模板选择下拉框
**新增功能**:
- 按分类显示所有可用的构建模板
- 每个模板显示名称和描述信息
- 分类标题显示模板数量

**实现细节**:
```tsx
<Select value={templateId} onValueChange={handleTemplateSelect}>
  <SelectTrigger>
    <SelectValue placeholder="选择模板" />
  </SelectTrigger>
  <SelectContent>
    {categories.map((category) => (
      <div key={category.value}>
        <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100">
          {category.label} ({category.count})
        </div>
        {/* 模板选项 */}
      </div>
    ))}
  </SelectContent>
</Select>
```

### 2. 自动填充Dockerfile
**新增功能**:
- 选择模板后自动填充对应的Dockerfile内容
- 覆盖现有的自定义Dockerfile内容

**实现细节**:
```tsx
const handleTemplateSelect = (newTemplateId: string) => {
  const template = getTemplateById(newTemplateId)
  if (template) {
    updateBuildArg('template_id', template.id)
    updateBuildArg('custom_dockerfile', template.dockerfile)
  }
}
```

### 3. 重置为模板功能
**新增功能**:
- 提供"重置为模板"按钮
- 一键恢复选中模板的原始Dockerfile内容
- 方便用户在自定义后回到模板状态

**实现细节**:
```tsx
const handleResetToTemplate = () => {
  if (selectedTemplate) {
    updateBuildArg('custom_dockerfile', selectedTemplate.dockerfile)
  }
}
```

### 4. 模板信息面板
**新增功能**:
- 显示选中模板的详细信息
- 包含基础镜像、工作目录、暴露端口、启动命令
- 帮助用户了解模板特性

**显示信息**:
- 基础镜像 (baseImage)
- 工作目录 (workdir)
- 暴露端口 (exposePorts)
- 启动命令 (runCommand)

### 5. 用户体验优化
**改进内容**:
- 增加Dockerfile编辑区域高度 (h-32 → h-40)
- 添加RefreshCw图标表示重置功能
- 提供清晰的提示和说明文字
- 在非编辑模式下显示模板分类标签

## 技术实现

### 导入依赖
```tsx
import { getAllTemplates, getTemplateById, getTemplateCategories } from '@/lib/dockerfile-templates'
import { RefreshCw } from 'lucide-react'
```

### 核心逻辑
1. **模板数据获取**: 使用 `getAllTemplates()` 和 `getTemplateCategories()` 获取模板数据
2. **模板选择处理**: `handleTemplateSelect` 函数处理模板选择并自动填充
3. **重置功能**: `handleResetToTemplate` 函数恢复模板原始内容
4. **状态管理**: 通过 `editingBuildArgs` 状态管理模板ID和自定义Dockerfile

## 验证结果
✅ **所有测试通过** (14/14)

### 功能验证
- ✅ 模板选择下拉框正常工作
- ✅ 自动填充Dockerfile功能正常
- ✅ 重置为模板功能正常
- ✅ 模板信息面板显示正确
- ✅ 分类显示功能正常
- ✅ 用户界面友好且直观

### TypeScript验证
- ✅ 无TypeScript错误
- ✅ 类型定义正确
- ✅ 组件接口兼容

## 用户使用流程

### 重新选择构建模板
1. 进入服务详情页面
2. 点击"构建与部署"标签
3. 在构建配置卡片中点击"编辑"按钮
4. 确保构建方式选择为"模板构建"
5. 从"选择构建模板"下拉框中选择新模板
6. Dockerfile内容自动更新为选中模板的内容
7. 可以进一步自定义Dockerfile内容
8. 点击"保存"应用更改

### 重置自定义内容
1. 在编辑模式下，如果已选择模板
2. 点击"重置为模板"按钮
3. Dockerfile内容恢复为模板原始内容
4. 点击"保存"应用更改

## 支持的模板类型
- **前端模板**: PNPM前端构建、Nginx静态文件
- **Java模板**: Maven Java21构建
- **Node.js模板**: Node.js 18标准应用
- **Python模板**: Python Flask应用
- **自定义模板**: 自定义空白模板

## 影响范围
- **文件**: `src/components/services/BuildConfigurationCard.tsx`
- **功能**: 构建配置编辑界面
- **用户体验**: 简化模板选择和Dockerfile自定义流程
- **兼容性**: 向后兼容现有构建配置

## 状态
✅ **已完成** - 构建配置现在支持重新选择模板并自动覆盖自定义Dockerfile，提供了完整的模板管理功能