# 部署标签页改进

## 概述

优化部署标签页的构建历史展示，添加 Jenkins 构建任务链接，并为构建成功的镜像提供快速部署按钮。

## 改进内容

### 1. Jenkins 构建任务链接

在构建历史中，每个构建记录现在都会显示 Jenkins 链接按钮（如果有构建 URL）：

- **位置**: 构建记录卡片右上角
- **图标**: 外部链接图标 + "Jenkins" 文字
- **功能**: 点击后在新标签页打开 Jenkins 构建任务详情页
- **用途**: 
  - 查看完整的构建日志
  - 检查构建参数和环境变量
  - 追踪构建问题
  - 查看构建历史和趋势

### 2. 快速部署按钮

对于构建成功的镜像，在构建历史中直接提供部署按钮：

- **位置**: 构建记录卡片右上角（Jenkins 链接旁边）
- **图标**: 火箭图标 + "部署" 文字
- **显示条件**: 
  - 构建状态为 `success`
  - 镜像 ID 存在
- **功能**: 点击后直接部署该镜像版本
- **优势**:
  - 无需切换到"镜像版本管理"区域
  - 减少操作步骤
  - 提高部署效率

### 3. 移除镜像版本管理卡片

- **原因**: 功能与构建历史重复，快速部署按钮已提供相同功能
- **优势**: 简化界面，减少冗余信息，提高页面加载速度

### 4. 视觉优化

- 按钮使用小尺寸（`size="sm"`）以节省空间
- Jenkins 链接使用 `ghost` 样式，部署按钮使用 `default` 样式以突出重要性
- 添加 hover 提示文字
- 响应式布局，按钮在小屏幕上自动换行

## 技术实现

### 数据来源

Jenkins 构建 URL 存储在 `ServiceImageRecord.metadata.buildUrl` 字段中，由构建 API 在触发 Jenkins 构建后自动保存。

### 代码变更

**文件**: `src/components/services/DeploymentsTab.tsx`

1. 添加 `ExternalLink` 图标导入
2. 在 `BuildHistory` 组件中添加 `onDeploy` 参数
3. 添加 `getJenkinsBuildUrl` 辅助函数提取构建 URL
4. 在构建记录卡片中添加 Jenkins 链接和部署按钮
5. 更新 `DeploymentsTab` 组件传递 `onDeploy` 到 `BuildHistory`
6. 移除 `ImageVersionManagement` 组件及其使用

### 示例代码

```tsx
// 提取 Jenkins 构建 URL
const getJenkinsBuildUrl = (image: ServiceImageRecord): string | null => {
  if (!image.metadata || typeof image.metadata !== 'object') {
    return null
  }
  const buildUrl = (image.metadata as Record<string, unknown>).buildUrl
  return typeof buildUrl === 'string' ? buildUrl : null
}

// 渲染按钮
{jenkinsBuildUrl && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => window.open(jenkinsBuildUrl, '_blank')}
    title="查看 Jenkins 构建任务"
  >
    <ExternalLink className="h-3 w-3" />
    Jenkins
  </Button>
)}

{canDeploy && (
  <Button
    variant="default"
    size="sm"
    onClick={() => onDeploy(image.id)}
    title="部署此镜像"
  >
    <Rocket className="h-3 w-3" />
    部署
  </Button>
)}
```

## 用户体验改进

### 使用场景

#### 场景 1: 追踪构建问题
1. 用户在构建历史中看到构建失败
2. 点击 "Jenkins" 链接查看详细日志
3. 在 Jenkins 中分析失败原因
4. 修复问题后重新构建

#### 场景 2: 快速部署
1. 用户在构建历史中看到新的成功构建
2. 直接点击 "部署" 按钮
3. 无需滚动到镜像版本管理区域
4. 一键完成部署操作

#### 场景 3: 版本回滚
1. 用户发现当前版本有问题
2. 在构建历史中找到之前的稳定版本
3. 点击该版本的 "部署" 按钮
4. 快速回滚到稳定版本

### 优势总结

1. **提高效率**: 减少点击次数和页面滚动
2. **增强可追溯性**: 直接访问 Jenkins 构建详情
3. **简化操作**: 构建和部署在同一区域完成
4. **改善体验**: 更直观的操作流程

## 兼容性

- 向后兼容：如果 `metadata.buildUrl` 不存在，不显示 Jenkins 链接
- 优雅降级：如果镜像 ID 不存在或构建未成功，不显示部署按钮
- 界面简化：移除了镜像版本管理卡片，所有功能集中在构建历史中

## 测试建议

1. **构建成功场景**
   - 触发新的镜像构建
   - 等待构建成功
   - 验证 Jenkins 链接和部署按钮都显示
   - 点击 Jenkins 链接，确认打开正确的构建页面
   - 点击部署按钮，确认部署成功

2. **构建失败场景**
   - 触发一个会失败的构建
   - 验证 Jenkins 链接显示
   - 验证部署按钮不显示
   - 点击 Jenkins 链接查看失败日志

3. **构建中场景**
   - 触发新构建
   - 在构建进行中查看构建历史
   - 验证状态显示正确
   - 验证按钮状态正确

4. **旧数据兼容性**
   - 查看没有 buildUrl 的旧构建记录
   - 验证不显示 Jenkins 链接
   - 验证其他功能正常
