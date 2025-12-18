# 数据库服务默认名称功能实现

## 功能说明

实现了创建Database类型服务时，服务名称默认为选择的数据库类型小写的功能。

## 实现内容

### 1. 修改的文件
- `src/app/projects/components/ServiceCreateForm.tsx`

### 2. 实现的功能

#### 2.1 自动设置默认名称
- 选择MySQL时，服务名默认为 `mysql`
- 选择Redis时，服务名默认为 `redis`

#### 2.2 智能更新逻辑
- 当用户切换数据库类型时：
  - 如果服务名为空，自动设置为新数据库类型的小写名称
  - 如果服务名等于之前选择的数据库类型名称，自动更新为新的数据库类型名称
  - 如果用户已自定义服务名称，不会覆盖用户的输入

#### 2.3 初始化逻辑
- 组件初始化时，如果是数据库服务且服务名为空，自动设置为默认的数据库类型小写名称

## 代码实现

### 1. 添加处理函数
```typescript
// 当数据库类型改变时，自动设置服务名称为数据库类型的小写形式
const handleDatabaseTypeChange = (dbType: SupportedDatabaseType) => {
  setSelectedDatabaseType(dbType)
  
  // 如果是数据库服务且当前服务名为空或为之前的数据库类型名称，则自动设置为新的数据库类型小写
  if (serviceType === ServiceType.DATABASE) {
    const currentName = serviceNameValue?.trim() || ''
    const previousDbTypeName = selectedDatabaseType.toLowerCase()
    
    // 如果服务名为空，或者服务名等于之前选择的数据库类型名称，则自动更新
    if (!currentName || currentName === previousDbTypeName) {
      setValue('name', dbType.toLowerCase(), { shouldValidate: true, shouldDirty: true })
    }
  }
}
```

### 2. 添加初始化逻辑
```typescript
// 初始化数据库服务的默认名称
useEffect(() => {
  if (serviceType === ServiceType.DATABASE) {
    const currentName = serviceNameValue?.trim() || ''
    
    // 如果服务名为空，则设置为默认的数据库类型小写
    if (!currentName) {
      setValue('name', selectedDatabaseType.toLowerCase(), { shouldValidate: true, shouldDirty: false })
    }
  }
}, [serviceType, selectedDatabaseType, serviceNameValue, setValue])
```

### 3. 更新数据库类型选择按钮
```typescript
{DATABASE_OPTIONS.map((db) => (
  <Button
    key={db.value}
    type="button"
    variant={selectedDatabaseType === db.value ? 'default' : 'outline'}
    className="h-auto py-3"
    onClick={() => handleDatabaseTypeChange(db.value)} // 使用新的处理函数
  >
    <DatabaseIcon className="w-4 h-4 mr-2" />
    {db.label}
  </Button>
))}
```

## 测试场景

### 手动测试步骤

1. **初始状态测试**
   - 打开项目页面
   - 点击"创建服务"按钮
   - 选择"Database"类型
   - 验证服务名称字段默认显示"mysql"

2. **数据库类型切换测试**
   - 点击"Redis"按钮
   - 验证服务名称自动更新为"redis"
   - 点击"MySQL"按钮
   - 验证服务名称自动更新为"mysql"

3. **用户自定义名称保护测试**
   - 手动修改服务名称为"my-custom-db"
   - 切换数据库类型（MySQL ↔ Redis）
   - 验证服务名称保持为"my-custom-db"，不被覆盖

4. **清空名称后的恢复测试**
   - 清空服务名称字段
   - 切换数据库类型
   - 验证服务名称重新设置为对应的数据库类型小写名称

## 预期效果

- ✅ 提升用户体验：用户不需要手动输入常见的数据库服务名称
- ✅ 保持一致性：数据库服务名称与数据库类型保持一致
- ✅ 智能化：只在合适的时机自动设置，不会覆盖用户的自定义输入
- ✅ 直观性：用户可以清楚地看到服务名称的变化

## 兼容性

- 该功能仅影响Database类型的服务创建
- 不影响Application和Image类型服务的创建流程
- 向后兼容，不会影响现有的服务

## 问题修复

### 运行时错误修复
在初始实现中遇到了 `Cannot access 'serviceNameValue' before initialization` 错误，这是因为 `useEffect` 中使用了 `serviceNameValue`，但它是通过 `watch('name')` 获取的，而 `useEffect` 在 `watch` 定义之前执行。

**解决方案**：将初始化数据库默认名称的 `useEffect` 移动到 `watch` 定义之后。

```typescript
// 修复前：useEffect 在 watch 定义之前
const handleDatabaseTypeChange = (dbType: SupportedDatabaseType) => {
  // ...
}

useEffect(() => {
  // 使用 serviceNameValue，但此时还未定义
}, [serviceNameValue])

const serviceNameValue = watch('name') // 在这里才定义

// 修复后：useEffect 在 watch 定义之后
const serviceNameValue = watch('name')

useEffect(() => {
  // 现在可以安全使用 serviceNameValue
}, [serviceNameValue])
```

## 后续优化

### MySQL默认数据库名修改
根据用户反馈，MySQL类型服务的默认数据库名从"与服务名相同"改为固定的"tmp"，避免潜在的命名冲突问题。

**修改内容**：
1. 代码逻辑修改：
```typescript
// 修改前
const databaseName = isMysql ? (data.database_name ?? '').trim() || serviceData.name : ''

// 修改后  
const databaseName = isMysql ? (data.database_name ?? '').trim() || 'tmp' : ''
```

2. 表单占位符修改：
```typescript
// 修改前
placeholder="与服务名相同"

// 修改后
placeholder="tmp"
```

## 总结

成功实现了数据库服务创建时的智能默认名称功能，并修复了运行时错误和MySQL默认数据库名问题。功能现在可以正常工作：
- ✅ 构建通过
- ✅ 运行时无错误
- ✅ 功能逻辑正确实现
- ✅ MySQL默认数据库名优化为"tmp"

该功能提升了用户体验，同时保持了灵活性，允许用户根据需要自定义服务名称。MySQL服务现在使用更安全的默认数据库名"tmp"。

## 环境变量配置优化

### 隐藏环境变量配置UI
根据用户反馈，在服务创建时隐藏了环境变量配置界面，简化创建流程。

**修改内容**：
1. 移除了所有服务类型创建表单中的环境变量配置UI
2. 保留了默认的环境变量值（`TZ: Asia/Shanghai`）
3. 用户可以在服务创建后在详情页面修改环境变量

**具体修改**：
- 删除了镜像服务的环境变量配置UI
- 删除了Application和Database服务的环境变量配置UI
- 保留了环境变量的处理逻辑和默认值

**用户体验改进**：
- ✅ 简化了服务创建流程
- ✅ 保留了默认的时区设置
- ✅ 用户仍可在服务详情页面完整配置环境变量