# 项目-服务-Pod 层次结构调试工具

## 🎯 更新说明

根据用户反馈，调试工具现在遵循现有的项目管理层次结构：**项目 → 服务 → Pod**，而不是直接选择任意Pod。

## 🔄 架构变更

### 原有方式 (已废弃)
```
直接选择Pod → 启动调试
```

### 新的层次结构
```
选择项目 → 选择服务 → 选择Pod → 启动调试
```

## 🏗️ 实现细节

### 1. 新增组件

#### ProjectServicePodSelector.tsx
- **功能**: 三级联动选择器
- **层次**: 项目 → 服务 → Pod
- **数据源**: 
  - 项目: `/api/projects`
  - 服务: `/api/services?project_id={projectId}`
  - Pod: `/api/k8s/pods?namespace={projectIdentifier}&labelSelector=app={serviceName}`

#### 关键特性
- **级联选择**: 选择项目后自动加载服务，选择服务后自动加载Pod
- **状态管理**: 实时显示选择状态和加载状态
- **错误处理**: 优雅处理API调用失败
- **UI反馈**: 加载指示器和状态徽章

### 2. 更新组件

#### PodDebugPanel.tsx
- **移除**: 直接Pod选择功能
- **新增**: 集成ProjectServicePodSelector
- **改进**: 使用项目标识符作为namespace

## 📊 数据流

### 1. 项目选择
```typescript
GET /api/projects
→ 返回项目列表
→ 用户选择项目
→ 触发服务加载
```

### 2. 服务选择
```typescript
GET /api/services?project_id={projectId}
→ 返回该项目的服务列表
→ 用户选择服务
→ 触发Pod加载
```

### 3. Pod选择
```typescript
GET /api/k8s/pods?namespace={project.identifier}&labelSelector=app={service.name}
→ 返回该服务的Pod列表
→ 用户选择Pod
→ 可以启动调试会话
```

### 4. 调试会话
```typescript
POST /api/debug/session
{
  podName: pod.name,
  namespace: project.identifier,  // 使用项目标识符
  container: selectedContainer
}
```

## 🎨 用户界面

### 选择器界面
```
┌─────────────────────────────────────┐
│ 📁 项目: [选择项目 ▼]     [🔄]      │
│                                     │
│ 🖥️ 服务: [选择服务 ▼]     [⏳]      │
│                                     │
│ 📦 Pod:  [选择Pod ▼]      [⏳]      │
└─────────────────────────────────────┘
```

### 选择摘要
```
┌─────────────────────────────────────┐
│ 选择摘要                            │
│ 📁 项目: 编排自测环境 [logic-test]   │
│ 🖥️ 服务: opencode [application]     │
│ 📦 Pod:  opencode-xxx [Running] 重启:0│
└─────────────────────────────────────┘
```

## 🔧 技术实现

### 状态管理
```typescript
const [selectedProject, setSelectedProject] = useState<Project | null>(null)
const [selectedService, setSelectedService] = useState<Service | null>(null)
const [selectedPod, setSelectedPod] = useState<Pod | null>(null)
```

### 级联加载
```typescript
// 项目选择 → 加载服务
const handleProjectSelect = (projectId: string) => {
  setSelectedProject(project)
  setSelectedService(null)  // 重置下级选择
  setSelectedPod(null)
  fetchServices(projectId)
}

// 服务选择 → 加载Pod
const handleServiceSelect = (serviceId: string) => {
  setSelectedService(service)
  setSelectedPod(null)      // 重置下级选择
  fetchPods(service, selectedProject)
}
```

### 命名空间映射
```typescript
// 使用项目标识符作为Kubernetes命名空间
const namespace = project.identifier
const labelSelector = `app=${service.name}`
```

## 🧪 测试验证

### 测试脚本
```bash
node test-project-service-pod.js
```

### 测试结果
```
✅ 找到 5 个项目
✅ 找到 7 个服务  
✅ 找到 1 个Pod
✅ 调试会话创建成功
```

### 实际数据示例
```
项目: 编排自测环境 (logic-test)
├── 服务: opencode (application)
│   └── Pod: opencode-85d47677d9-l9s58 (Running)
├── 服务: spring-boot-2-tests (application)
│   └── Pod: spring-boot-2-tests-xxx (Running)
└── ...
```

## 🎯 用户体验改进

### 1. 符合直觉
- 遵循现有项目管理流程
- 用户熟悉的操作方式
- 清晰的层次关系

### 2. 数据一致性
- 使用项目标识符作为namespace
- 服务名称作为Pod标签选择器
- 保持与K8s部署的一致性

### 3. 错误预防
- 级联重置避免无效选择
- 加载状态防止重复操作
- 清晰的错误提示

## 📋 使用流程

### 1. 访问调试工具
```
http://localhost:3000/debug
```

### 2. 选择调试目标
1. **选择项目**: 从项目下拉列表中选择
2. **选择服务**: 从该项目的服务列表中选择
3. **选择Pod**: 从该服务的Pod列表中选择

### 3. 启动调试
1. 点击"启动调试"按钮
2. 选择容器（如果有多个）
3. 开始使用调试工具

### 4. 使用调试功能
- **Claude终端**: AI助手执行命令
- **日志查看**: 实时日志流
- **文件浏览**: 容器文件系统
- **性能监控**: 资源使用情况

## 🔮 未来扩展

### 1. 多环境支持
- 开发环境
- 测试环境  
- 生产环境

### 2. 权限控制
- 基于项目的访问控制
- 服务级别权限
- 操作审计日志

### 3. 批量操作
- 多Pod并行调试
- 服务级别操作
- 项目级别监控

## 🎉 总结

新的项目-服务-Pod层次结构调试工具：

1. ✅ **符合现有架构**: 遵循项目管理流程
2. ✅ **用户体验优化**: 直观的选择流程
3. ✅ **数据一致性**: 正确的namespace映射
4. ✅ **功能完整**: 保留所有调试功能
5. ✅ **向后兼容**: 不影响现有功能

用户现在可以按照熟悉的项目管理方式来选择调试目标，使调试工具更好地集成到现有工作流程中！🚀