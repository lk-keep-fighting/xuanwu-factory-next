# 项目标识标签样式优化

## 修改内容

将项目标识改为使用 Badge 标签样式，与服务类型保持一致的视觉风格。

## 修改前

```tsx
{/* 项目标识 */}
{project?.identifier && (
  <div className="text-sm text-gray-500 font-medium">
    {project.identifier}
  </div>
)}
```

显示效果：
- 普通文本样式
- 小字体、灰色
- 与其他标签样式不统一

## 修改后

```tsx
{/* 项目标识 */}
{project?.identifier && (
  <Badge variant="secondary">
    {project.identifier}
  </Badge>
)}
```

显示效果：
- 标签样式，与服务类型标签一致
- 使用 `secondary` 变体，灰色背景
- 视觉上更加统一和专业

## 布局效果

现在的标题布局：
```
[返回] [项目标识Badge] [服务名称] [重命名] [服务类型Badge] [状态]
```

### 视觉一致性
- 项目标识：`Badge variant="secondary"` (灰色背景)
- 服务类型：`Badge variant="outline"` (边框样式)
- 两个标签样式协调，但有所区分

### 信息层次
1. **项目标识**：上下文信息，使用 secondary 样式
2. **服务名称**：主要信息，大字体粗体
3. **服务类型**：分类信息，使用 outline 样式
4. **服务状态**：状态信息，带颜色指示器

## 优势

1. **视觉统一**：所有标签都使用 Badge 组件，保持一致性
2. **更好的可读性**：标签样式让信息更容易识别
3. **专业外观**：整体布局更加整洁和现代
4. **清晰的分类**：不同类型的信息使用不同的标签变体

## 示例

修改前：`myproject` `my-service` `Application` `运行中`
修改后：`[myproject]` `my-service` `[Application]` `● 运行中`

其中 `[myproject]` 和 `[Application]` 都是标签样式，但颜色略有不同以示区分。

这样的设计让整个标题区域看起来更加统一和专业。