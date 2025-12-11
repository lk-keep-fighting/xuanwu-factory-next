# 镜像标签前缀添加

## 修改内容

在镜像标签显示中添加 "tag:" 前缀，让标签的含义更加明确。

## 修改前

```tsx
<Badge variant="secondary" className={`text-xs ${bgColor}`}>
  {tag}
</Badge>
```

显示效果：
```
registry.example.com/myproject/backend
[v1.2.3-20241210]
```

## 修改后

```tsx
<Badge variant="secondary" className={`text-xs ${bgColor}`}>
  tag: {tag}
</Badge>
```

显示效果：
```
registry.example.com/myproject/backend
[tag: v1.2.3-20241210]
```

## 改进效果

### 1. 更清晰的语义
- 明确标识这是镜像的标签信息
- 避免用户对标签含义的困惑
- 提供更好的上下文信息

### 2. 一致的标签格式
- 所有镜像标签都使用统一的 "tag:" 前缀
- 保持界面的一致性和专业性
- 符合常见的标签显示惯例

### 3. 更好的可读性
- 用户可以立即识别这是镜像标签
- 在有多个信息标签时，能够快速区分
- 提升整体的用户体验

## 示例效果

### 当前镜像
```
📦 registry.example.com/myapp/backend
   [tag: v1.2.3]
```

### 部署进行中
```
🕐 部署进行中
   registry.example.com/myapp/backend
   [tag: v1.3.0-beta]
```

### 默认标签
```
📦 nginx
   [tag: latest]
```

这样的修改让镜像标签的含义更加明确，提升了界面的专业性和可读性。