# 域名访问链接可点击功能

## 功能描述

在开启域名访问后，显示的域名现在可以直接点击打开新页面，提升用户体验。

## 修改内容

### 1. 添加外部链接图标

```tsx
import { Plus, X, Globe, AlertCircle, ExternalLink } from 'lucide-react'
```

### 2. 新增辅助函数

#### 生成完整 URL
```tsx
const generateDomainUrl = (prefix: string): string => {
  const domainName = generateDomainName(prefix)
  return domainName ? `https://${domainName}` : ''
}
```

#### 处理域名点击
```tsx
const handleDomainClick = useCallback((prefix: string) => {
  const url = generateDomainUrl(prefix)
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}, [project, domainRoot])
```

### 3. 可点击域名链接组件

```tsx
const DomainLink = useCallback(({ 
  prefix, 
  className = "text-sm font-mono text-blue-600 break-all",
  showIcon = true 
}: { 
  prefix: string
  className?: string
  showIcon?: boolean 
}) => {
  const domainName = generateDomainName(prefix)
  if (!domainName) return null

  return (
    <button
      onClick={() => handleDomainClick(prefix)}
      className={`${className} hover:text-blue-800 hover:underline cursor-pointer inline-flex items-center gap-1 transition-colors`}
      title={`点击访问 ${domainName}`}
    >
      <span>{domainName}</span>
      {showIcon && <ExternalLink className="w-3 h-3 flex-shrink-0" />}
    </button>
  )
}, [generateDomainName, handleDomainClick])
```

## 修改前后对比

### 修改前
```tsx
{/* 只读模式 */}
<span className="text-sm font-mono text-blue-600 break-all">
  {generateDomainName(port.domainPrefix)}
</span>

{/* 编辑模式预览 */}
<span className="text-xs font-mono text-blue-700 break-all">
  {generateDomainName(port.domainPrefix)}
</span>
```

显示效果：
```
🌐 域名访问
   api.myproject.example.com
```
- 纯文本显示
- 无法点击
- 需要手动复制粘贴到浏览器

### 修改后
```tsx
{/* 只读模式 */}
<DomainLink prefix={port.domainPrefix} />

{/* 编辑模式预览 */}
<DomainLink 
  prefix={port.domainPrefix} 
  className="text-xs font-mono text-blue-700 break-all"
/>
```

显示效果：
```
🌐 域名访问
   api.myproject.example.com 🔗
```
- 可点击的链接样式
- 鼠标悬停时显示下划线
- 包含外部链接图标
- 点击直接在新标签页打开

## 功能特性

### 1. 用户体验优化
- **一键访问**：点击域名直接打开新页面
- **视觉提示**：外部链接图标表明可点击
- **悬停效果**：鼠标悬停时显示下划线和颜色变化
- **工具提示**：显示"点击访问 xxx"的提示信息

### 2. 安全性考虑
- **新标签页打开**：使用 `window.open(url, '_blank')`
- **安全属性**：添加 `noopener,noreferrer` 防止安全问题
- **HTTPS 协议**：自动使用 HTTPS 协议访问

### 3. 响应式设计
- **灵活样式**：支持自定义 className
- **图标控制**：可选择是否显示外部链接图标
- **文本换行**：长域名自动换行显示

### 4. 兼容性保持
- **向后兼容**：不影响现有的域名生成逻辑
- **样式一致**：保持原有的视觉风格
- **功能完整**：所有原有功能正常工作

## 使用场景

### 1. 网络配置页面
- **只读模式**：查看已配置的域名，点击直接访问
- **编辑模式**：预览域名效果，测试访问是否正常

### 2. 服务调试
- **快速访问**：无需复制粘贴，直接点击测试服务
- **多端口测试**：不同端口的域名可以分别测试
- **实时验证**：配置完成后立即验证域名是否可访问

### 3. 开发流程
- **前端开发**：快速访问开发环境的前端应用
- **API 测试**：直接访问 API 端点进行测试
- **服务监控**：快速检查服务是否正常运行

## 技术实现

### 1. URL 生成
```tsx
const generateDomainUrl = (prefix: string): string => {
  const domainName = generateDomainName(prefix)
  return domainName ? `https://${domainName}` : ''
}
```
- 复用现有的 `generateDomainName` 函数
- 自动添加 HTTPS 协议前缀
- 处理空值情况

### 2. 点击处理
```tsx
const handleDomainClick = useCallback((prefix: string) => {
  const url = generateDomainUrl(prefix)
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}, [project, domainRoot])
```
- 使用 useCallback 优化性能
- 新标签页打开，不影响当前页面
- 添加安全属性防止潜在风险

### 3. 组件设计
```tsx
const DomainLink = useCallback(({ prefix, className, showIcon }) => {
  // 组件实现
}, [generateDomainName, handleDomainClick])
```
- 可复用的组件设计
- 支持自定义样式和图标显示
- 内置悬停效果和过渡动画

## 改进效果

- ✅ **提升效率**：无需手动复制粘贴域名
- ✅ **改善体验**：一键访问，操作更直观
- ✅ **增强可用性**：视觉提示明确，功能易发现
- ✅ **保持一致性**：与现有 UI 风格保持一致
- ✅ **安全可靠**：遵循 Web 安全最佳实践

这个改进让域名访问功能更加实用和用户友好，特别是在开发和测试场景中能显著提升工作效率。