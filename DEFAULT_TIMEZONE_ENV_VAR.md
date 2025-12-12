# 默认时区环境变量配置

## 功能描述

为了确保所有创建的服务都使用正确的时区，系统现在会自动为所有新创建的服务添加默认的时区环境变量 `TZ=Asia/Shanghai`。

## 实现方案

### 1. 前端创建表单默认值

在服务创建表单中，环境变量输入框现在默认包含时区配置：

**文件**: `src/app/projects/components/ServiceCreateForm.tsx`

```typescript
// 环境变量管理
const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([
  { key: 'TZ', value: 'Asia/Shanghai' },  // 默认时区环境变量
  { key: '', value: '' }                   // 空行供用户添加其他环境变量
])
```

### 2. 后端Kubernetes部署默认值

在Kubernetes部署时，系统会自动为所有服务类型添加默认时区环境变量：

**文件**: `src/lib/k8s.ts`

```typescript
private buildDefaultEnvVars(service: Service): Record<string, string> {
  // 为所有服务类型添加默认时区环境变量
  const env: Record<string, string> = {
    TZ: 'Asia/Shanghai'
  }

  if (service.type !== 'database') {
    return env
  }

  // 数据库服务的特定环境变量会添加到基础环境变量中
  const dbService = service as DatabaseService
  // ... 数据库特定的环境变量配置
}
```

## 影响范围

### 受影响的服务类型
- **Application服务** - 基于源码构建的应用
- **Database服务** - 内置数据库镜像（MySQL、Redis等）
- **Image服务** - 基于现有镜像部署的服务

### 用户体验改进
1. **创建服务时**: 用户在创建任何类型的服务时，环境变量表单会预填充 `TZ=Asia/Shanghai`
2. **部署时**: 即使用户没有手动设置时区，系统也会自动添加正确的时区配置
3. **可覆盖**: 用户可以修改或删除默认的时区设置，系统不会强制使用

## 技术细节

### 环境变量优先级
1. 用户在创建表单中设置的环境变量
2. 系统默认的时区环境变量（如果用户没有设置TZ）
3. 数据库服务的特定环境变量（如MYSQL_ROOT_PASSWORD等）

### 合并逻辑
```typescript
private buildEnvVars(service: Service): k8s.V1EnvVar[] {
  const envVars: Record<string, string> = {
    ...this.buildDefaultEnvVars(service)  // 包含 TZ=Asia/Shanghai
  }

  if (service.env_vars) {
    for (const [name, value] of Object.entries(service.env_vars)) {
      if (value !== undefined && value !== null) {
        envVars[name] = String(value)  // 用户设置的环境变量会覆盖默认值
      }
    }
  }

  // 转换为Kubernetes格式
  return Object.entries(envVars).map(([name, value]) => ({ name, value }))
}
```

## 使用场景

### 1. 新建服务
- 用户创建任何类型的服务时，时区环境变量会自动预填充
- 用户可以保持默认值或修改为其他时区

### 2. 现有服务
- 现有服务不受影响，保持原有的环境变量配置
- 用户可以手动添加时区环境变量到现有服务

### 3. 容器运行时
- 所有新部署的容器都会有正确的时区设置
- 应用程序的日志和时间戳将显示正确的本地时间
- 定时任务和时间相关功能将使用正确的时区

## 验证方法

### 1. 前端验证
1. 打开服务创建页面
2. 查看环境变量部分
3. 确认第一行预填充了 `TZ=Asia/Shanghai`

### 2. 部署验证
1. 创建一个新服务
2. 部署成功后，进入容器
3. 运行 `echo $TZ` 或 `date` 命令
4. 确认时区设置正确

### 3. 日志验证
1. 查看应用程序日志
2. 确认时间戳显示为中国时区（+08:00）

## 向后兼容性

- **完全向后兼容**: 现有服务不会受到影响
- **用户可控**: 用户可以删除或修改默认的时区设置
- **不破坏现有配置**: 如果用户已经设置了TZ环境变量，不会被覆盖

## 总结

通过在前端创建表单和后端Kubernetes部署逻辑中添加默认的时区环境变量，确保了：

1. **一致性**: 所有新创建的服务都有正确的时区配置
2. **便利性**: 用户无需手动设置时区，减少了配置错误
3. **灵活性**: 用户仍可以根据需要修改时区设置
4. **兼容性**: 不影响现有服务的运行

这个改进提升了用户体验，减少了因时区配置错误导致的问题。