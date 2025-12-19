# 导入服务时域名配置自动更新功能

## 功能概述

在导入服务配置时，如果原服务开启了域名访问，系统会自动将域名配置更新为新项目的子域名，确保导入后的服务能够正确访问。

## 问题背景

当从一个项目导入服务配置到另一个项目时，如果原服务配置了域名访问（如 `loong-web.demo.dev.aimstek.cn`），直接复制配置会导致域名仍然指向原项目，这会造成：

1. 域名冲突问题
2. 访问错误的服务实例
3. 需要手动修改域名配置

## 解决方案

### 自动域名更新逻辑

1. **检测域名配置**：扫描服务的 `network_config.ports` 中的域名设置
2. **保持前缀不变**：保留原始的域名前缀（如 `loong-web`）
3. **更新项目标识符**：将域名中的项目标识符替换为目标项目的标识符
4. **重新生成完整域名**：按照 `{prefix}.{新项目标识符}.dev.aimstek.cn` 格式生成新域名

### 示例转换

```
原项目标识符：demo
原服务域名：loong-web.demo.dev.aimstek.cn

新项目标识符：bggs-pre
更新后域名：loong-web.bggs-pre.dev.aimstek.cn
```

### 支持的配置格式

#### NetworkConfigV2 格式
```typescript
{
  service_type: 'NodePort',
  ports: [
    {
      container_port: 80,
      service_port: 80,
      protocol: 'TCP',
      domain: {
        enabled: true,
        prefix: 'loong-web',
        host: 'loong-web.demo.dev.aimstek.cn'  // 会被自动更新
      }
    }
  ]
}
```

## 实现细节

### 核心函数：updateNetworkDomains

```typescript
const updateNetworkDomains = (networkConfig: any, targetProjectIdentifier: string): any => {
  if (!networkConfig || !targetProjectIdentifier) return networkConfig

  // 处理新版本的网络配置 (NetworkConfigV2)
  if (networkConfig.ports && Array.isArray(networkConfig.ports)) {
    const updatedPorts = networkConfig.ports.map((port: NetworkPortConfig) => {
      if (port.domain && port.domain.enabled && port.domain.prefix) {
        // 更新域名配置
        const newHost = `${port.domain.prefix}.${targetProjectIdentifier}.${DEFAULT_DOMAIN_ROOT}`
        return {
          ...port,
          domain: {
            ...port.domain,
            host: newHost
          }
        }
      }
      return port
    })

    return {
      ...networkConfig,
      ports: updatedPorts
    }
  }

  return networkConfig
}
```

### 处理流程

1. **导入触发**：用户选择服务并点击导入
2. **配置复制**：复制原服务配置，移除ID等字段
3. **域名检查**：检查是否存在网络配置和目标项目标识符
4. **域名更新**：调用 `updateNetworkDomains` 函数更新域名
5. **服务创建**：使用更新后的配置创建新服务

## 处理场景

### 1. 无域名配置的服务
- **行为**：正常导入，不做任何域名处理
- **结果**：服务配置完全复制，无域名相关配置

### 2. 有域名配置但未启用的服务
- **行为**：保持原配置不变
- **结果**：域名配置保持 `enabled: false` 状态

### 3. 有启用域名配置的服务
- **行为**：自动更新域名为新项目子域名
- **结果**：域名前缀保持不变，项目标识符更新

### 4. 多端口域名配置的服务
- **行为**：更新所有端口的域名配置
- **结果**：每个端口的域名都正确更新

## 错误处理

### 缺少项目标识符
- **情况**：目标项目没有设置 `projectIdentifier`
- **处理**：跳过域名更新，保持原配置
- **影响**：用户需要手动修改域名配置

### 无效的网络配置
- **情况**：网络配置格式不正确或缺失
- **处理**：保持原配置不变
- **影响**：不会影响服务导入，但域名可能需要手动调整

## 验证方法

### 测试步骤
1. 在源项目中创建开启域名访问的服务
2. 记录原始域名配置
3. 将服务导入到目标项目
4. 检查导入后的服务网络配置
5. 验证域名是否正确更新

### 预期结果
- 域名前缀保持不变
- 项目标识符正确更新为目标项目
- 域名根域名保持为 `dev.aimstek.cn`
- 其他网络配置（端口、协议等）保持不变

## 注意事项

1. **项目标识符必需**：目标项目必须设置了 `identifier` 才能进行域名更新
2. **域名格式固定**：当前只支持 `dev.aimstek.cn` 根域名格式
3. **配置验证**：建议导入后验证域名配置是否正确
4. **DNS解析**：新域名需要确保DNS解析正确配置

## 未来扩展

1. **支持自定义根域名**：允许配置不同的根域名
2. **域名冲突检测**：检测目标项目中是否已存在相同的域名配置
3. **批量域名管理**：提供批量修改域名配置的功能
4. **域名历史记录**：记录域名变更历史

功能已实现并可以正常使用。