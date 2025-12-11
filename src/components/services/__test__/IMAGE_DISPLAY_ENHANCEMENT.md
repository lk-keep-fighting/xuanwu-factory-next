# 镜像显示美化改进

## 修改内容

将部署信息卡片中的镜像显示方式进行美化，将镜像名称和标签分开展示，提升视觉效果和可读性。

## 修改前

```tsx
<span className="text-sm font-mono flex-1 break-all">
  {currentDeployment.display}
</span>
```

显示效果：
```
registry.example.com/myapp/backend:v1.2.3-20241210
```
- 镜像名称和标签混在一起
- 长镜像地址难以快速识别版本信息
- 视觉上不够清晰

## 修改后

```tsx
const ImageDisplay = ({ imageDisplay, textColor, bgColor }) => {
  const { imageName, tag } = parseImageDisplay(imageDisplay)
  
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-mono ${textColor} break-all`}>
          {imageName}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className={`text-xs ${bgColor}`}>
            {tag}
          </Badge>
        </div>
      </div>
    </div>
  )
}
```

显示效果：
```
registry.example.com/myapp/backend
[v1.2.3-20241210]
```
- 镜像名称和标签分行显示
- 标签使用 Badge 组件突出显示
- 视觉层次更清晰

## 功能特性

### 1. 智能解析镜像地址
```tsx
const parseImageDisplay = (imageDisplay: string) => {
  const lastColonIndex = imageDisplay.lastIndexOf(':')
  if (lastColonIndex === -1) {
    return { imageName: imageDisplay, tag: 'latest' }
  }
  
  const imageName = imageDisplay.substring(0, lastColonIndex)
  const tag = imageDisplay.substring(lastColonIndex + 1)
  
  // 如果标签包含 '/' 或者看起来像是镜像名称的一部分，则认为没有标签
  if (tag.includes('/') || tag.includes('.')) {
    return { imageName: imageDisplay, tag: 'latest' }
  }
  
  return { imageName, tag }
}
```

**解析逻辑**：
- 从最后一个 `:` 分割镜像名称和标签
- 如果没有 `:`，默认标签为 `latest`
- 如果标签包含 `/` 或 `.`，认为是镜像名称的一部分，标签设为 `latest`

### 2. 灵活的样式配置
- `textColor`: 镜像名称的文字颜色
- `bgColor`: 标签的背景颜色
- 支持不同状态下的颜色主题

### 3. 响应式布局
- 使用 `flex-1 min-w-0` 确保长镜像名称能正确换行
- 使用 `break-all` 处理超长的镜像名称
- 标签固定在镜像名称下方，不会被挤压

## 视觉效果对比

### 当前镜像
**修改前**：
```
📦 registry.example.com/myproject/backend:v1.2.3-20241210-abc123
```

**修改后**：
```
📦 registry.example.com/myproject/backend
   [v1.2.3-20241210-abc123]
```

### 部署进行中
**修改前**：
```
🕐 部署进行中
   registry.example.com/myproject/backend:v1.3.0-beta
```

**修改后**：
```
🕐 部署进行中
   registry.example.com/myproject/backend
   [v1.3.0-beta]
```

## 颜色主题

### 当前镜像
- 镜像名称：`text-gray-700`
- 标签背景：`bg-gray-100`

### 部署进行中
- 镜像名称：`text-blue-700`
- 标签背景：`bg-blue-100`

## 优势

1. **更好的可读性**：镜像名称和版本信息分离，一目了然
2. **视觉层次清晰**：使用 Badge 突出显示版本标签
3. **响应式友好**：长镜像名称能正确换行和显示
4. **主题一致性**：不同状态使用相应的颜色主题
5. **快速识别**：用户可以快速识别镜像版本信息

## 适用场景

- **版本管理**：快速识别当前部署的版本
- **部署跟踪**：清晰看到正在部署的新版本
- **问题排查**：快速确认镜像版本信息
- **发布管理**：对比不同版本的镜像

这样的改进让镜像信息的展示更加美观和实用，提升了用户体验。