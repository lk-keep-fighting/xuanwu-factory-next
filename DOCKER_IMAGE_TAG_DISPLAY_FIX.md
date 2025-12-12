# 部署服务镜像与TAG显示问题修复

## 问题描述

之前部署的服务在服务详情-概览-部署信息中，当前镜像与TAG的显示存在问题：
1. 镜像解析逻辑不够健壮，无法正确处理复杂的镜像地址格式
2. TAG显示不一致，有时显示不正确或缺失
3. 不同页面（概览、部署历史、构建历史）的镜像显示格式不统一

## 根本原因分析

### 1. 镜像解析逻辑问题
原有的 `parseImageReference` 函数在处理包含端口号的注册表地址时存在问题：
- 无法正确区分端口号中的冒号和TAG分隔符中的冒号
- 对于复杂的镜像地址（如 `nexus.aimstek.cn:5000/namespace/image:tag`）解析不准确

### 2. 显示逻辑不一致
不同组件使用了不同的镜像解析和显示逻辑：
- 概览页面使用自定义的 `parseImageDisplay` 函数
- 部署历史页面直接显示完整镜像地址
- 构建历史页面使用简单的字符串拼接

## 解决方案

### 1. 改进镜像解析逻辑
优化 `src/lib/service-image.ts` 中的 `parseImageReference` 函数：

```typescript
export const parseImageReference = (value?: string | null): ImageReference => {
  // 处理 digest 格式 (image@sha256:...)
  const digestIndex = trimmed.indexOf('@')
  const workable = digestIndex === -1 ? trimmed : trimmed.slice(0, digestIndex)
  
  // 查找最后一个 '/' 和 ':' 的位置
  const lastSlash = workable.lastIndexOf('/')
  const lastColon = workable.lastIndexOf(':')

  // 只有当冒号在最后一个斜杠之后时，才认为是 tag 分隔符
  // 这样可以正确处理包含端口号的镜像地址
  if (lastColon > lastSlash && lastColon !== -1) {
    const image = workable.slice(0, lastColon)
    const tag = workable.slice(lastColon + 1)
    
    // 验证 tag 是否有效（不包含路径分隔符）
    if (tag && !tag.includes('/') && !tag.includes('@')) {
      return { image, tag: tag || undefined }
    }
  }

  return { image: workable, tag: undefined }
}
```

### 2. 统一镜像显示格式
在所有相关组件中使用统一的镜像显示格式：

#### 概览页面 (`src/components/services/OverviewTab.tsx`)
- 使用统一的 `parseImageReference` 函数
- 分离显示镜像名称和TAG标签
- TAG以独立的标签形式显示

#### 部署历史页面 (`src/components/services/DeploymentsTab.tsx`)
- 部署历史记录中的镜像显示格式统一
- 构建历史记录中的镜像显示格式统一
- 都使用相同的TAG显示样式

### 3. 改进的显示效果
- **镜像名称**：完整的镜像路径，支持换行显示长地址
- **TAG标签**：独立的标签样式，清晰显示版本信息
- **一致性**：所有页面使用相同的显示格式和样式

## 测试验证

### 支持的镜像格式
- 基本格式：`nginx:latest`, `ubuntu:20.04`
- 带注册表：`registry.example.com/nginx:latest`
- 带端口号：`registry.example.com:5000/nginx:latest`
- 复杂路径：`nexus.aimstek.cn/aims-test/business/wms/aimstek-wms-starter:1.0.0.0.0.241212.123-abc123`
- Digest格式：`image@sha256:abc123`

### 测试结果
所有格式都能正确解析并显示：
- 镜像名称正确分离
- TAG标签准确提取
- 显示格式统一美观

## 影响范围

### 修改的文件
1. `src/lib/service-image.ts` - 改进镜像解析逻辑
2. `src/components/services/OverviewTab.tsx` - 统一概览页面镜像显示
3. `src/components/services/DeploymentsTab.tsx` - 统一部署和构建历史镜像显示

### 受益功能
- 服务详情 > 概览 > 部署信息
- 服务详情 > 部署 > 当前部署状态
- 服务详情 > 部署 > 部署历史
- 服务详情 > 部署 > 构建历史

## 向后兼容性

- 所有修改都向后兼容
- 不影响现有的API接口
- 不改变数据库结构
- 仅改进前端显示逻辑

## 总结

通过改进镜像解析逻辑和统一显示格式，解决了部署服务中镜像与TAG显示的问题。现在用户可以清晰地看到：
1. 完整的镜像名称（支持复杂的注册表地址）
2. 独立显示的TAG标签
3. 所有页面统一的显示格式

这个修复提升了用户体验，让镜像信息更加清晰易读。