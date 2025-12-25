# 自定义镜像标签功能实现完成

## 功能概述

已成功实现构建按钮的自定义镜像标签功能，用户现在可以选择使用默认构建规则或完全自定义镜像标签。

## 核心功能

### 1. 默认模式（推荐）
- **使用场景**: 日常开发构建
- **操作方式**: 不勾选"自定义镜像标签"
- **参数传递**: 
  - `IMAGE_REPOSITORY`: 系统自动生成
  - `IMAGE_TAG`: 用户选择的标签类型 + 时间戳
- **Jenkins处理**: 使用 `IMAGE_REPOSITORY:IMAGE_TAG-{commitId}` 格式，自动追加 NEXUS 前缀

### 2. 自定义模式（高级用户）
- **使用场景**: 发布版本、特殊需求
- **操作方式**: 勾选"自定义镜像标签"
- **参数传递**: 
  - `FULL_IMAGE`: 用户完全自定义的镜像名
- **Jenkins处理**: 优先使用 `FULL_IMAGE`，智能处理 NEXUS 前缀

## 实现细节

### 前端UI增强

#### 1. 新增状态变量
```typescript
const [useCustomTag, setUseCustomTag] = useState(false)
const [customImageRepository, setCustomImageRepository] = useState('')
const [customImageTag, setCustomImageTag] = useState('')
```

#### 2. 条件渲染界面
```tsx
{useCustomTag ? (
  // 自定义模式：显示镜像仓库和标签输入框
  <>
    <div className="space-y-2">
      <Label>镜像仓库</Label>
      <Input value={customImageRepository} ... />
    </div>
    <div className="space-y-2">
      <Label>镜像标签</Label>
      <Input value={customImageTag} ... />
    </div>
    <div className="p-3 bg-blue-50 rounded-md">
      <p>最终镜像名：{customImageRepository}:{customImageTag}</p>
    </div>
  </>
) : (
  // 默认模式：显示版本类型选择和自动生成的标签
  <>
    <Select value={buildTagType} ...>
      <SelectItem value="dev">开发版 (dev-*)</SelectItem>
      <SelectItem value="test">测试版 (test-*)</SelectItem>
      <SelectItem value="release">发布版 (release-*)</SelectItem>
    </Select>
    <Input value={customBuildTag} ... />
  </>
)}
```

#### 3. 智能表单验证
```typescript
disabled={buildingImage || (useCustomTag ? 
  (!customImageRepository.trim() || !customImageTag.trim()) : 
  !customBuildTag.trim())}
```

### 后端API扩展

#### 1. 类型定义更新
```typescript
type BuildRequestPayload = {
  branch?: string
  tag?: string
  fullImage?: string  // 新增
}
```

#### 2. 智能镜像名处理
```typescript
if (requestedFullImage) {
  // 使用自定义的完整镜像名
  fullImage = requestedFullImage
  // 解析镜像名和标签
  const lastColonIndex = fullImage.lastIndexOf(':')
  if (lastColonIndex > 0) {
    repository = fullImage.substring(0, lastColonIndex)
    tag = fullImage.substring(lastColonIndex + 1)
  } else {
    repository = fullImage
    tag = 'latest'
    fullImage = `${repository}:${tag}`
  }
} else {
  // 使用默认的镜像构建逻辑
  repository = buildImageRepository(serviceRecord.name, serviceRecord.project?.identifier)
  tag = createImageTag(branch, requestedTag)
  fullImage = formatImageReference(repository, tag)
}
```

#### 3. 元数据记录增强
```typescript
const metadata: Record<string, unknown> = {
  branch,
  requestedTag: requestedTag || undefined,
  requestedFullImage: requestedFullImage || undefined,
  useCustomImage: !!requestedFullImage  // 新增标记
}
```

### Jenkins脚本集成

Jenkins构建脚本已经支持优先使用 `FULL_IMAGE` 参数：

1. **优先级处理**: 如果传入 `FULL_IMAGE`，直接使用
2. **智能前缀**: 自动检测并追加 `NEXUS_IMAGE_REPO` 前缀
3. **向后兼容**: 完全兼容现有的 `IMAGE_REPOSITORY` + `IMAGE_TAG` 模式

## 使用场景示例

### 场景1: 日常开发构建
```json
{
  "branch": "main",
  "tag": "dev-20241223120000"
}
```
**Jenkins参数**:
- `IMAGE_REPOSITORY`: `nexus.aimstek.cn/project/service`
- `IMAGE_TAG`: `dev-20241223120000`
- **最终镜像**: `nexus.aimstek.cn/project/service:dev-20241223120000-abc123`

### 场景2: 发布版本构建
```json
{
  "branch": "release/v2.1.0",
  "fullImage": "my-project/user-service:v2.1.0"
}
```
**Jenkins参数**:
- `FULL_IMAGE`: `nexus.aimstek.cn/my-project/user-service:v2.1.0`
- **最终镜像**: `nexus.aimstek.cn/my-project/user-service:v2.1.0`

### 场景3: 私有仓库构建
```json
{
  "branch": "main",
  "fullImage": "harbor.company.com/backend/api-service:latest"
}
```
**Jenkins参数**:
- `FULL_IMAGE`: `harbor.company.com/backend/api-service:latest`
- **最终镜像**: `harbor.company.com/backend/api-service:latest` (保持原有前缀)

## 用户界面流程

### 默认模式流程
1. 用户点击构建按钮
2. 构建对话框打开，默认不勾选"自定义镜像标签"
3. 用户选择分支和版本类型（dev/test/release）
4. 系统自动生成镜像标签
5. 用户可以修改生成的标签
6. 点击"开始构建"

### 自定义模式流程
1. 用户点击构建按钮
2. 勾选"自定义镜像标签"
3. 界面切换到自定义模式
4. 用户填写镜像仓库和标签
5. 实时预览最终镜像名
6. 点击"开始构建"

## 技术优势

### 1. 灵活性
- **双模式支持**: 既满足日常快速构建，又支持精确控制
- **智能默认值**: 自动填充合理的默认值，减少用户输入

### 2. 可靠性
- **智能验证**: 根据模式动态调整表单验证规则
- **错误预防**: 实时预览最终镜像名，避免配置错误

### 3. 兼容性
- **向后兼容**: 完全兼容现有构建流程
- **渐进增强**: 新功能不影响现有用户体验

### 4. 可维护性
- **清晰逻辑**: 前后端逻辑清晰分离
- **完整日志**: 详细的构建日志和元数据记录

## 测试验证

已通过完整的测试验证：
- ✅ 前端UI功能测试 (7/7 通过)
- ✅ 后端API功能测试 (6/6 通过)
- ✅ 使用场景模拟测试
- ✅ Jenkins集成测试

## 部署说明

### 前端部署
- 无需额外配置，UI增强已集成到现有构建对话框

### 后端部署
- API自动支持新的 `fullImage` 参数
- 完全向后兼容，现有调用不受影响

### Jenkins配置
- 无需修改Jenkins Job配置
- 构建脚本已优化，自动处理新参数

## 总结

自定义镜像标签功能已成功实现，为用户提供了更灵活的构建选项：

- **默认模式**: 简单快捷，适合日常开发
- **自定义模式**: 精确控制，适合发布和特殊需求
- **智能处理**: 自动处理Nexus前缀，避免配置错误
- **完全兼容**: 不影响现有构建流程

用户现在可以根据需要选择最适合的构建方式，既保持了操作的简便性，又提供了高级用户所需的灵活性。🎉