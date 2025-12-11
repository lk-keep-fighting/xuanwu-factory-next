# 服务详情页标题增强

## 修改说明

在服务详情页的标题中添加了项目标识前缀，方便用户快速识别项目标识（同时也是 k8s 命名空间）。

## 修改内容

### 原始标题显示
```tsx
<h1 className="text-2xl font-bold text-gray-900">{service.name}</h1>
```

### 修改后的标题显示
```tsx
<h1 className="text-2xl font-bold text-gray-900">
  {project?.identifier && (
    <span className="text-blue-600 font-medium">{project.identifier}/</span>
  )}
  {service.name}
</h1>
```

## 显示效果

### 修改前
```
服务名称
```

### 修改后
```
project-id/服务名称
```

其中：
- `project-id` 是项目标识，以蓝色字体显示
- `/` 是分隔符
- `服务名称` 保持原有的黑色字体

## 功能特点

1. **条件显示**：只有当项目标识存在时才显示前缀
2. **视觉区分**：项目标识使用蓝色字体（`text-blue-600`），与服务名称形成视觉对比
3. **字体权重**：项目标识使用中等字体权重（`font-medium`），服务名称保持粗体（`font-bold`）
4. **兼容性**：如果项目信息不存在，仍然正常显示服务名称

## 使用场景

1. **快速识别命名空间**：项目标识即为 Kubernetes 命名空间，便于运维人员快速识别
2. **多项目管理**：在管理多个项目时，可以快速区分不同项目的服务
3. **调试和运维**：在进行 kubectl 操作时，可以直接从页面标题获取命名空间信息

## 技术实现

- 使用条件渲染确保只在项目标识存在时显示前缀
- 使用 Tailwind CSS 类进行样式控制
- 保持原有的响应式设计和可访问性

## 文件位置

- 修改文件：`src/app/projects/[id]/services/[serviceId]/page.tsx`
- 修改位置：第 2357-2365 行（页面标题部分）

## 示例

假设项目标识为 `my-app`，服务名称为 `web-server`，则页面标题显示为：

**my-app**/web-server

其中 "my-app" 为蓝色，"web-server" 为黑色。