# 默认域名前缀功能

## 功能描述

当用户在网络配置中启用域名访问时，系统会自动将当前服务名设置为默认的域名前缀，提升用户体验。

## 实现内容

### 1. NetworkSection 组件增强

#### 新增 Props
```typescript
interface NetworkSectionProps {
  // ... 其他 props
  serviceName?: string  // 新增：服务名称
}
```

#### 新增功能函数
```typescript
/**
 * Generate default domain prefix based on service name
 */
const generateDefaultDomainPrefix = (): string => {
  if (!serviceName) {
    return ''
  }
  // Convert service name to valid domain prefix
  return sanitizeDomainLabelInput(serviceName)
}
```

#### 增强域名启用逻辑
```typescript
onChange={(e) => {
  const enabled = e.target.checked
  const updates: Partial<NetworkPortFormState> = { enableDomain: enabled }
  
  // 如果启用域名访问且当前没有域名前缀，则设置默认前缀为服务名
  if (enabled && !port.domainPrefix) {
    const defaultPrefix = generateDefaultDomainPrefix()
    if (defaultPrefix) {
      updates.domainPrefix = defaultPrefix
    }
  }
  
  updatePort(port.id, updates)
}}
```

### 2. NetworkTab 组件更新

#### Props 接口更新
```typescript
export interface NetworkTabProps {
  // ... 其他 props
  serviceName?: string  // 新增：服务名称
}
```

#### 传递服务名称
```typescript
<NetworkSection
  // ... 其他 props
  serviceName={serviceName}
  // ... 其他 props
/>
```

### 3. 服务详情页面更新

#### 传递服务名称到 NetworkTab
```typescript
<LazyNetworkTab
  // ... 其他 props
  serviceName={service.name}
  // ... 其他 props
/>
```

## 功能特性

### 1. 智能默认值
- **条件触发**：仅在启用域名访问且当前域名前缀为空时设置默认值
- **保留用户输入**：如果用户已经输入了域名前缀，不会覆盖
- **自动清理**：使用 `sanitizeDomainLabelInput` 确保生成的前缀符合域名规范

### 2. 域名规范化
服务名称会通过 `sanitizeDomainLabelInput` 函数进行处理：
- 转换为小写
- 移除无效字符
- 确保以字母或数字开头和结尾
- 只保留字母、数字和连字符

### 3. 用户体验优化
- **减少输入**：用户不需要手动输入域名前缀
- **直观性**：域名前缀与服务名称保持一致
- **可修改**：用户仍可以修改自动生成的前缀

## 使用场景示例

### 场景 1：新建端口映射
1. 用户添加新的端口映射
2. 勾选"启用域名访问"
3. 系统自动填入服务名作为域名前缀
4. 显示完整的域名预览

### 场景 2：服务名称为 "web-api"
- **原始服务名**：`web-api`
- **生成的域名前缀**：`web-api`
- **完整域名**：`web-api.project-id.dev.aimstek.cn`

### 场景 3：服务名称包含特殊字符
- **原始服务名**：`My_Service@123`
- **生成的域名前缀**：`my-service-123`（经过规范化处理）
- **完整域名**：`my-service-123.project-id.dev.aimstek.cn`

## 技术实现细节

### 1. 条件判断逻辑
```typescript
if (enabled && !port.domainPrefix) {
  // 只有在启用域名且当前前缀为空时才设置默认值
}
```

### 2. 批量更新
使用单个 `updatePort` 调用同时更新 `enableDomain` 和 `domainPrefix`：
```typescript
const updates: Partial<NetworkPortFormState> = { enableDomain: enabled }
if (enabled && !port.domainPrefix) {
  updates.domainPrefix = defaultPrefix
}
updatePort(port.id, updates)
```

### 3. 安全性
- 使用可选参数 `serviceName?` 确保向后兼容
- 在生成默认前缀前检查服务名称是否存在
- 使用现有的域名验证逻辑确保生成的前缀有效

## 文件修改清单

### 修改的文件
1. **`src/components/services/configuration/NetworkSection.tsx`**
   - 新增 `serviceName` prop
   - 新增 `generateDefaultDomainPrefix` 函数
   - 增强域名启用的 onChange 处理逻辑

2. **`src/components/services/NetworkTab.tsx`**
   - 新增 `serviceName` prop
   - 传递 `serviceName` 到 NetworkSection

3. **`src/app/projects/[id]/services/[serviceId]/page.tsx`**
   - 传递 `service.name` 到 LazyNetworkTab

### 新增的文件
- `src/components/services/configuration/__test__/DEFAULT_DOMAIN_PREFIX_FEATURE.md`（本文档）

## 测试验证

### 手动测试步骤
1. **基本功能测试**
   - 打开服务详情页 → 网络标签页 → 编辑模式
   - 勾选"启用域名访问"
   - 验证域名前缀自动填入服务名

2. **边界条件测试**
   - 测试服务名包含特殊字符的情况
   - 测试服务名为空的情况
   - 测试已有域名前缀的情况

3. **用户交互测试**
   - 验证用户可以修改自动生成的前缀
   - 验证取消勾选后重新勾选的行为
   - 验证多个端口映射的独立性

### 预期结果
- ✅ 启用域名访问时自动填入服务名作为前缀
- ✅ 生成的前缀符合域名规范
- ✅ 不覆盖用户已输入的前缀
- ✅ 域名预览正确显示
- ✅ 保存功能正常工作

## 兼容性说明

### 向后兼容
- 新增的 `serviceName` prop 为可选参数
- 如果没有传递服务名称，功能降级为原有行为
- 不影响现有的域名配置逻辑

### 类型安全
- 使用 TypeScript 接口确保类型安全
- 所有新增的 props 都有明确的类型定义
- 保持与现有代码的类型一致性

## 未来扩展

### 可能的增强功能
1. **智能前缀建议**：基于端口号或服务类型提供更智能的前缀建议
2. **前缀冲突检测**：检测项目内域名前缀冲突并提供警告
3. **批量域名配置**：为多个端口快速配置域名
4. **域名模板**：支持自定义域名前缀模板

### 配置选项
未来可以考虑添加系统级配置选项：
- 是否启用自动域名前缀功能
- 自定义域名前缀生成规则
- 域名前缀验证规则

## 总结

这个功能通过自动设置默认域名前缀，显著提升了用户在配置网络域名时的体验。实现简洁、安全，并保持了良好的向后兼容性。用户可以享受自动化的便利，同时保留完全的控制权来修改生成的前缀。