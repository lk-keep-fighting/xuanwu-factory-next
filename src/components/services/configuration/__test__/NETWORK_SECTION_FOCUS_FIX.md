# NetworkSection 输入框焦点丢失问题修复

## 问题描述

在服务详情页的网络配置标签页中，端口映射的编辑框存在一个问题：每次输入一个字符后就失去了焦点，无法连续输入。

## 问题原因

经过深入分析，发现问题的根本原因是在服务详情页面中，每次网络配置更新时都会为端口生成新的 ID，导致 React 认为这是新的元素，从而重新创建输入框并失去焦点。

### 主要问题（已修复）：
在 `src/app/projects/[id]/services/[serviceId]/page.tsx` 中的 `onUpdateNetwork` 函数：

```typescript
// 原始代码（有问题）
onUpdateNetwork={(config) => {
  setNetworkServiceType(config.serviceType)
  setNetworkPorts(config.ports.map(p => ({
    id: generatePortId(), // 每次都生成新的 ID！
    containerPort: String(p.containerPort),
    // ...
  })))
}}
```

### 次要问题（已修复）：
在 `src/components/services/configuration/NetworkSection.tsx` 中：

1. `updatePort` 函数使用 `index` 参数而不是稳定的 `id`
2. 输入框的 `id` 和 `htmlFor` 属性使用 `index` 而不是 `port.id`

### 问题分析：
1. **ID 重新生成**：每次网络配置更新时，`generatePortId()` 都会为端口生成新的 ID
2. **React 元素识别**：React 使用 `key` 属性来识别元素，当 ID 变化时，React 认为这是一个新元素
3. **输入框重新创建**：新元素意味着输入框被重新创建，导致失去焦点
4. **函数引用不稳定**：使用 `index` 而不是稳定的 `id` 也会导致函数引用变化

## 解决方案

### 1. 主要修复：保持端口 ID 稳定

在服务详情页面中，修改 `onUpdateNetwork` 函数以保持现有端口的 ID：

```typescript
// 修复后的代码
onUpdateNetwork={(config) => {
  setNetworkServiceType(config.serviceType)
  setNetworkPorts(config.ports.map((p, index) => ({
    id: networkPorts[index]?.id ?? generatePortId(), // 保持现有 ID
    containerPort: String(p.containerPort),
    servicePort: String(p.servicePort ?? p.containerPort),
    protocol: p.protocol ?? 'TCP',
    nodePort: p.nodePort ? String(p.nodePort) : '',
    enableDomain: p.domain?.enabled ?? false,
    domainPrefix: p.domain?.prefix ?? ''
  })))
  setHeadlessServiceEnabled(config.headlessServiceEnabled)
}}
```

### 2. 次要修复：使用稳定的 ID 引用

将 `updatePort` 函数改为使用端口的唯一 `id` 而不是 `index`：

```typescript
const updatePort = useCallback((id: string, updates: Partial<NetworkPortFormState>) => {
  const newPorts = ports.map(port => 
    port.id === id ? { ...port, ...updates } : port
  )
  onUpdatePorts(newPorts)
}, [ports, onUpdatePorts])
```

### 3. 输入框 ID 修复

将所有输入框的 `id` 和 `htmlFor` 属性从使用 `index` 改为使用 `port.id`：

```typescript
// 修复前
<Input id={`port-container-${index}`} />
<Label htmlFor={`port-container-${index}`} />

// 修复后
<Input id={`port-container-${port.id}`} />
<Label htmlFor={`port-container-${port.id}`} />
```

## 修复的文件

### 主要修复文件：
1. **`src/app/projects/[id]/services/[serviceId]/page.tsx`** - 服务详情页面
2. **`src/components/services/configuration/NetworkSection.tsx`** - 网络配置组件

### 服务详情页面修复内容：
1. **配置标签页的 onUpdateNetwork 函数**：保持现有端口的 ID
2. **网络标签页的 onUpdateNetwork 函数**：保持现有端口的 ID

### NetworkSection 组件修复内容：
1. **updatePort 函数签名**：从 `(index: number, ...)` 改为 `(id: string, ...)`
2. **updatePort 实现**：使用 `ports.map()` 和 `port.id` 匹配，而不是数组索引
3. **所有 onChange 调用**：将 `index` 参数替换为 `port.id`
4. **输入框 ID 属性**：从 `index` 改为 `port.id`

### 具体修改的调用点：
- 容器端口输入框：`updatePort(port.id, { containerPort: e.target.value })`
- 服务端口输入框：`updatePort(port.id, { servicePort: e.target.value })`
- 协议选择器：`updatePort(port.id, { protocol: value as 'TCP' | 'UDP' })`
- NodePort 输入框：`updatePort(port.id, { nodePort: e.target.value })`
- 域名启用复选框：`updatePort(port.id, { enableDomain: e.target.checked })`
- 域名前缀输入框：`updatePort(port.id, { domainPrefix: sanitized })`

### 修改的 ID 属性：
- 容器端口：`port-container-${port.id}`
- 服务端口：`port-service-${port.id}`
- 协议选择：`port-protocol-${port.id}`
- NodePort：`port-nodeport-${port.id}`
- 域名启用：`port-domain-enable-${port.id}`
- 域名前缀：`port-domain-prefix-${port.id}`

## 为什么这个修复有效

1. **稳定的函数引用**：使用 `id` 而不是 `index` 使得函数逻辑更加稳定
2. **唯一标识符**：每个端口都有唯一的 `id`，不会因为数组顺序变化而改变
3. **减少重新创建**：虽然 `updatePort` 函数仍然会因为 `ports` 依赖而重新创建，但使用 `id` 的方式更加可靠
4. **React 优化**：React 能够更好地识别和优化基于唯一 ID 的更新

## 验证修复

### 测试步骤：
1. 打开任意服务的详情页
2. 切换到"网络"标签页
3. 点击"编辑"按钮进入编辑模式
4. 在端口映射的任意输入框中连续输入多个字符
5. 验证输入框保持焦点，可以连续输入

### 预期结果：
- ✅ 输入框保持焦点
- ✅ 可以连续输入字符
- ✅ 输入内容正确更新到状态中
- ✅ 其他端口映射功能正常工作

## 相关代码结构

### NetworkPortFormState 类型：
```typescript
export type NetworkPortFormState = {
  id: string              // 唯一标识符
  containerPort: string   // 容器端口
  servicePort: string     // 服务端口
  protocol: 'TCP' | 'UDP' // 协议
  nodePort: string        // NodePort（可选）
  enableDomain: boolean   // 是否启用域名
  domainPrefix: string    // 域名前缀
}
```

### 端口生成函数：
```typescript
const generatePortId = (): string => 
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

const createEmptyPort = (): NetworkPortFormState => ({
  id: generatePortId(),
  containerPort: '',
  servicePort: '',
  protocol: 'TCP',
  nodePort: '',
  enableDomain: false,
  domainPrefix: ''
})
```

## 最佳实践

这个修复体现了 React 开发中的几个最佳实践：

1. **使用唯一标识符**：在处理动态列表时，始终使用唯一且稳定的 ID
2. **避免使用数组索引**：数组索引在元素顺序变化时不稳定
3. **函数引用稳定性**：确保事件处理函数的引用尽可能稳定
4. **状态更新模式**：使用 `map()` 等不可变更新模式

## 总结

通过将 `updatePort` 函数从基于索引的更新改为基于 ID 的更新，成功解决了端口映射编辑框失去焦点的问题。这个修复不仅解决了用户体验问题，还提高了代码的健壮性和可维护性。

修复后，用户可以正常在端口映射的各个输入框中连续输入，不再出现每输入一个字符就失去焦点的问题。