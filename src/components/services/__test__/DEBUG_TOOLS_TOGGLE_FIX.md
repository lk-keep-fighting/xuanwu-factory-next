# 调试工具开关无法关闭问题修复

## 问题描述

在服务详情-调试工具页面中，启用调试工具后无法通过开关关闭该功能。

## 问题分析

### 可能的原因

1. **状态更新延迟**：当调用 `onUpdateDebugConfig(null)` 时，状态可能没有立即更新到组件
2. **状态计算错误**：`enabled` 变量的计算可能存在问题
3. **组件重渲染问题**：Switch 组件的 `checked` 属性可能没有正确响应状态变化

### 代码流程分析

```tsx
// 1. 用户点击开关
<Switch
  checked={enabled}
  onCheckedChange={handleEnableToggle}
  disabled={!isEditing}
/>

// 2. 触发处理函数
const handleEnableToggle = useCallback((checked: boolean) => {
  if (checked) {
    onUpdateDebugConfig({ enabled: true, tools: [] })
  } else {
    onUpdateDebugConfig(null) // 关闭时设置为 null
  }
}, [onUpdateDebugConfig])

// 3. 状态计算
const normalizedConfig = useMemo(() => {
  return normalizeDebugConfig(debugConfig) // null -> null
}, [debugConfig])

const enabled = Boolean(normalizedConfig?.enabled) // null?.enabled -> false
```

## 调试方法

### 1. 添加调试日志

在关键位置添加 console.log 来跟踪状态变化：

```tsx
// 在 normalizedConfig 计算中
const normalizedConfig = useMemo(() => {
  const result = normalizeDebugConfig(debugConfig)
  console.log('[DebugToolsSection] debugConfig:', debugConfig, 'normalized:', result)
  return result
}, [debugConfig])

// 在 enabled 计算中
const enabled = Boolean(normalizedConfig?.enabled)
console.log('[DebugToolsSection] enabled:', enabled, 'normalizedConfig:', normalizedConfig)

// 在开关处理函数中
const handleEnableToggle = useCallback((checked: boolean) => {
  console.log('[DebugToolsSection] handleEnableToggle:', checked)
  if (checked) {
    onUpdateDebugConfig({ enabled: true, tools: [] })
  } else {
    onUpdateDebugConfig(null)
  }
}, [onUpdateDebugConfig])
```

### 2. 检查状态传递链

```
DebugToolsTab -> DebugToolsSection -> Switch
     ↓              ↓                  ↓
debugConfig -> normalizedConfig -> enabled
```

确保每一层的状态传递都正确。

## 可能的修复方案

### 方案 1: 强制重新渲染

```tsx
const [forceUpdate, setForceUpdate] = useState(0)

const handleEnableToggle = useCallback((checked: boolean) => {
  if (checked) {
    onUpdateDebugConfig({ enabled: true, tools: [] })
  } else {
    onUpdateDebugConfig(null)
    // 强制重新渲染
    setForceUpdate(prev => prev + 1)
  }
}, [onUpdateDebugConfig])
```

### 方案 2: 使用本地状态

```tsx
const [localEnabled, setLocalEnabled] = useState(Boolean(normalizedConfig?.enabled))

useEffect(() => {
  setLocalEnabled(Boolean(normalizedConfig?.enabled))
}, [normalizedConfig])

const handleEnableToggle = useCallback((checked: boolean) => {
  setLocalEnabled(checked) // 立即更新本地状态
  if (checked) {
    onUpdateDebugConfig({ enabled: true, tools: [] })
  } else {
    onUpdateDebugConfig(null)
  }
}, [onUpdateDebugConfig])

// 使用本地状态
<Switch
  checked={localEnabled}
  onCheckedChange={handleEnableToggle}
  disabled={!isEditing}
/>
```

### 方案 3: 修改状态结构

不使用 `null` 来表示禁用，而是使用 `{ enabled: false, tools: [] }`：

```tsx
const handleEnableToggle = useCallback((checked: boolean) => {
  if (checked) {
    onUpdateDebugConfig({ enabled: true, tools: [] })
  } else {
    onUpdateDebugConfig({ enabled: false, tools: [] }) // 使用 enabled: false
  }
}, [onUpdateDebugConfig])
```

## 测试步骤

1. **启用调试工具**：
   - 点击开关启用
   - 检查控制台日志
   - 确认开关状态为开启

2. **关闭调试工具**：
   - 点击开关关闭
   - 检查控制台日志
   - 确认开关状态为关闭

3. **重复测试**：
   - 多次开启/关闭
   - 确认状态切换正常

## 预期的控制台输出

正常情况下应该看到：

```
[DebugToolsSection] debugConfig: null normalized: null
[DebugToolsSection] enabled: false normalizedConfig: null
[DebugToolsSection] handleEnableToggle: true
[DebugToolsSection] debugConfig: {enabled: true, tools: []} normalized: {enabled: true, tools: []}
[DebugToolsSection] enabled: true normalizedConfig: {enabled: true, tools: []}
[DebugToolsSection] handleEnableToggle: false
[DebugToolsSection] debugConfig: null normalized: null
[DebugToolsSection] enabled: false normalizedConfig: null
```

如果开关无法关闭，可能会看到状态没有正确更新的情况。

## 注意事项

1. **移除调试日志**：问题修复后记得移除 console.log
2. **测试所有场景**：包括页面刷新、编辑模式切换等
3. **检查其他影响**：确保修复不会影响其他功能

这些调试信息将帮助我们定位问题的具体原因，并选择合适的修复方案。