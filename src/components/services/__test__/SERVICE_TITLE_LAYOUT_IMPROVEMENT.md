# 服务详情页标题布局优化

## 问题描述

原来的标题布局将项目标识和服务名称放在一起，导致标题显得拥挤。

## 解决方案

将标题重新布局，将项目标识分开放在最左侧，各个元素之间有更好的间距。

## 布局变化

### 修改前
```
[返回] [项目标识/服务名称] [重命名] [类型] [状态]
```
- 项目标识和服务名称挤在一起
- 使用 `flex-wrap` 可能导致换行
- 整体显得拥挤

### 修改后
```
[返回] [项目标识] [服务名称] [重命名] [类型] [状态]
```
- 项目标识独立显示在最左侧
- 服务名称单独显示，更突出
- 各元素之间有清晰的分隔
- 使用固定的 `gap-6` 间距

## 代码变化

### 修改前
```tsx
<div className="flex flex-wrap items-start gap-3">
  <div className="flex items-center gap-2">
    <h1 className="text-2xl font-bold text-gray-900">
      {project?.identifier && (
        <span>{project.identifier}/</span>
      )}
      {service.name}
    </h1>
    {/* 重命名按钮 */}
  </div>
  {/* 其他元素 */}
</div>
```

### 修改后
```tsx
<div className="flex items-center gap-6">
  {/* 项目标识 */}
  {project?.identifier && (
    <div className="text-sm text-gray-500 font-medium">
      {project.identifier}
    </div>
  )}
  
  {/* 服务名称和操作 */}
  <div className="flex items-center gap-2">
    <h1 className="text-2xl font-bold text-gray-900">
      {service.name}
    </h1>
    {/* 重命名按钮 */}
  </div>
  
  {/* 服务类型 */}
  <Badge variant="outline">...</Badge>
  
  {/* 服务状态 */}
  <div className="flex items-center gap-2">...</div>
</div>
```

## 样式改进

1. **项目标识样式**：
   - 使用 `text-sm text-gray-500 font-medium`
   - 较小的字体，灰色显示，不抢夺主要内容的注意力

2. **布局改进**：
   - 移除 `flex-wrap`，避免不必要的换行
   - 使用 `gap-6` 提供更宽松的间距
   - 每个元素都有明确的区域

3. **视觉层次**：
   - 项目标识：次要信息，小字灰色
   - 服务名称：主要信息，大字粗体
   - 其他元素：辅助信息，适中大小

## 效果

- **更清晰的层次**：项目标识作为上下文信息，服务名称作为主要标题
- **更好的可读性**：各元素分离，不会混在一起
- **更专业的外观**：布局更加整洁和有序
- **响应式友好**：固定布局，不会因为内容长度变化而换行

这样的布局让用户能够快速识别当前所在的项目和服务，同时保持界面的整洁性。