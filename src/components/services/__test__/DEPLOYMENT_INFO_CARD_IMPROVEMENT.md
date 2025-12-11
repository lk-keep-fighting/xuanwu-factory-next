# 部署信息卡片改进

## 修改内容

对概览页面的部署信息卡片进行了两个主要改进：
1. 将"当前部署"改为"当前镜像"，更准确地描述显示的内容
2. 添加复制按钮，方便用户复制镜像地址

## 修改前

```tsx
{currentDeployment && (
  <div>
    <div className="text-xs text-gray-600 mb-1">当前部署</div>
    <div className="flex items-center gap-2">
      <Box className="h-4 w-4 text-gray-600" />
      <span className="text-sm font-mono">{currentDeployment.display}</span>
    </div>
    {/* 分支信息 */}
  </div>
)}
```

显示效果：
- 标签显示"当前部署"
- 只能查看镜像地址，无法复制

## 修改后

```tsx
{currentDeployment && (
  <div>
    <div className="text-xs text-gray-600 mb-1">当前镜像</div>
    <div className="flex items-center gap-2">
      <Box className="h-4 w-4 text-gray-600 flex-shrink-0" />
      <span className="text-sm font-mono flex-1 break-all">{currentDeployment.display}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleCopyImage(currentDeployment.display)}
        className="h-6 w-6 p-0 text-gray-600 hover:text-gray-800 flex-shrink-0"
        title="复制镜像地址"
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
    {/* 分支信息 */}
  </div>
)}
```

显示效果：
- 标签显示"当前镜像"，更准确
- 添加了复制按钮，点击可复制镜像地址
- 镜像地址使用 `flex-1 break-all` 确保长地址能正确换行

## 功能特性

### 1. 复制功能
- 使用 `navigator.clipboard.writeText()` API
- 复制成功显示成功提示
- 复制失败显示错误提示
- 支持现代浏览器的剪贴板 API

### 2. 用户体验优化
- 复制按钮使用 ghost 样式，不抢夺视觉焦点
- 鼠标悬停时颜色变深，提供视觉反馈
- 添加 `title` 属性显示工具提示
- 按钮大小适中（6x6），不占用过多空间

### 3. 布局优化
- 使用 `flex-1` 让镜像地址占据剩余空间
- 使用 `flex-shrink-0` 防止图标和按钮被压缩
- 使用 `break-all` 确保长镜像地址能正确换行

### 4. 一致性改进
- 部署进行中的镜像也添加了复制按钮
- 两种状态下的复制功能保持一致
- 按钮样式根据上下文调整颜色

## 代码实现

### 复制函数
```tsx
const handleCopyImage = useCallback(async (imageText: string) => {
  try {
    await navigator.clipboard.writeText(imageText)
    toast.success('镜像地址已复制到剪贴板')
  } catch (error) {
    toast.error('复制失败')
  }
}, [])
```

### 复制按钮
```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => handleCopyImage(currentDeployment.display)}
  className="h-6 w-6 p-0 text-gray-600 hover:text-gray-800 flex-shrink-0"
  title="复制镜像地址"
>
  <Copy className="h-3 w-3" />
</Button>
```

## 使用场景

1. **开发调试**：快速复制镜像地址用于本地测试
2. **部署配置**：复制镜像地址到其他环境的配置文件
3. **问题排查**：复制镜像信息用于问题报告
4. **文档记录**：复制镜像版本信息到文档中

## 改进效果

- ✅ **更准确的标签**：从"当前部署"改为"当前镜像"
- ✅ **便捷的复制功能**：一键复制镜像地址
- ✅ **良好的用户反馈**：复制成功/失败提示
- ✅ **优化的布局**：支持长镜像地址的显示
- ✅ **一致的体验**：部署中和当前镜像都支持复制

这些改进让用户能够更方便地获取和使用镜像信息，提升了工作效率。