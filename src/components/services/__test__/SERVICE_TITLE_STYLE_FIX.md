# 服务详情页标题样式统一

## 修改内容

统一了服务详情页标题中项目标识和服务名称的样式。

## 修改前

```tsx
<h1 className="text-2xl font-bold text-gray-900">
  {project?.identifier && (
    <span className="text-blue-600 font-medium">{project.identifier}/</span>
  )}
  {service.name}
</h1>
```

显示效果：
- 项目标识：蓝色、中等粗细 (`text-blue-600 font-medium`)
- 服务名称：深灰色、粗体 (`text-2xl font-bold text-gray-900`)

## 修改后

```tsx
<h1 className="text-2xl font-bold text-gray-900">
  {project?.identifier && (
    <span>{project.identifier}/</span>
  )}
  {service.name}
</h1>
```

显示效果：
- 项目标识和服务名称：统一使用深灰色、粗体样式 (`text-2xl font-bold text-gray-900`)

## 改进效果

1. **视觉一致性**：项目标识和服务名称现在使用相同的颜色和字重
2. **更好的可读性**：统一的样式让标题看起来更加整洁
3. **简化的设计**：移除了不必要的颜色区分，保持简洁

## 示例

修改前：`myproject/my-service` (myproject 是蓝色中等粗细，my-service 是深灰色粗体)
修改后：`myproject/my-service` (整个标题都是深灰色粗体)

这样的修改让服务详情页的标题更加统一和专业。