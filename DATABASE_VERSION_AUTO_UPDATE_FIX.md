# 数据库版本自动更新修复

## 问题描述

当用户在创建数据库服务时切换数据库类型（MySQL ↔ Redis），版本字段不会自动更新为对应的默认版本，仍然显示之前选择的数据库类型的版本。

## 问题原因

版本字段的 `placeholder` 和 `defaultValue` 虽然根据数据库类型动态设置，但是当用户切换数据库类型时，表单字段的实际值（`value`）没有自动更新。

## 解决方案

### 添加响应式版本更新

在 `ServiceCreateForm.tsx` 中添加了一个 `useEffect` 来监听数据库类型变化，并自动更新版本字段的值：

```typescript
// 当数据库类型改变时，更新版本字段的默认值
useEffect(() => {
  if (serviceType === ServiceType.DATABASE) {
    const defaultVersion = selectedDatabaseType === DatabaseType.MYSQL ? "8.0.21" : "6.0.8"
    setValue('version', defaultVersion, { shouldValidate: true, shouldDirty: false })
  }
}, [serviceType, selectedDatabaseType, setValue])
```

### 版本配置

- **MySQL默认版本**：`8.0.21`
- **Redis默认版本**：`6.0.8`

## 修复效果

### 修复前
1. 用户选择MySQL，版本显示 `8.0.21`
2. 用户切换到Redis，版本仍然显示 `8.0.21`（错误）
3. 需要手动清空并重新输入版本

### 修复后
1. 用户选择MySQL，版本自动显示 `8.0.21`
2. 用户切换到Redis，版本自动更新为 `6.0.8`
3. 用户切换回MySQL，版本自动更新为 `8.0.21`

## 技术实现

### 1. 监听依赖
```typescript
[serviceType, selectedDatabaseType, setValue]
```

### 2. 条件判断
只在数据库服务类型时执行更新：
```typescript
if (serviceType === ServiceType.DATABASE)
```

### 3. 表单更新选项
```typescript
setValue('version', defaultVersion, { 
  shouldValidate: true,  // 触发验证
  shouldDirty: false     // 不标记为已修改（因为是自动更新）
})
```

## 用户体验改进

1. **自动化**：无需手动修改版本号
2. **准确性**：确保版本与数据库类型匹配
3. **一致性**：每次切换都会使用正确的默认版本
4. **便捷性**：减少用户操作步骤

## 兼容性

- ✅ 不影响用户手动输入自定义版本
- ✅ 只在切换数据库类型时自动更新
- ✅ 保持表单验证逻辑
- ✅ 向后兼容现有功能

## 总结

通过添加响应式版本更新逻辑，成功解决了数据库类型切换时版本不更新的问题，提升了用户体验和操作便捷性。