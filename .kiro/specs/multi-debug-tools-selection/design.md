# Design Document

## Overview

本设计文档描述了多调试工具选择功能的技术实现方案。该功能将现有的单选调试工具机制升级为多选机制，允许用户同时启用多个调试工具集（BusyBox、Netshoot、Ubuntu、自定义镜像），每个工具集通过独立的 Init Container 注入到服务容器中。

核心改进包括：
- 数据模型从单个工具配置扩展为工具数组
- UI 从单选按钮改为复选框卡片
- Kubernetes 配置生成支持多个 Init Container
- 提供快速配置预设和向后兼容支持

## Architecture

### 系统架构层次

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 UI 层                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  DebugToolsSection Component                         │   │
│  │  - 多选工具卡片                                       │   │
│  │  - 快速配置预设                                       │   │
│  │  - 路径配置                                           │   │
│  │  - 使用说明                                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   数据验证层                                 │
│  - 镜像地址格式验证                                          │
│  - 路径格式验证                                              │
│  - 路径唯一性验证                                            │
│  - 自定义镜像必填验证                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   API 层                                     │
│  PUT /api/services/[id]                                     │
│  - 接收更新的 debug_config                                   │
│  - 保存到数据库                                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   数据持久化层                               │
│  Service.debug_config (JSON)                                │
│  - 存储多个工具配置                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Kubernetes 配置生成层                           │
│  - 为每个工具生成 Init Container                             │
│  - 生成 emptyDir 卷                                          │
│  - 配置卷挂载                                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Kubernetes 集群                                 │
│  - 执行 Init Containers                                     │
│  - 挂载调试工具到主容器                                      │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

1. **配置阶段**：用户在 UI 选择多个工具 → 前端验证 → API 保存到数据库
2. **部署阶段**：读取 debug_config → 生成多个 Init Container → 应用到 Kubernetes
3. **运行阶段**：Init Containers 依次执行 → 复制工具到各自路径 → 主容器启动

## Components and Interfaces

### 1. 前端组件

#### DebugToolsSection Component

**职责**：提供多调试工具选择和配置的用户界面

**Props**：
```typescript
interface DebugToolsSectionProps {
  isEditing: boolean
  debugConfig: MultiDebugConfig | null | undefined
  onUpdateDebugConfig: (config: MultiDebugConfig | null) => void
}
```

**主要功能**：
- 渲染工具选择卡片（支持多选）
- 显示快速配置预设
- 管理每个工具的挂载路径
- 显示使用说明
- 处理向后兼容（自动转换旧配置）

#### QuickPresetSelector Component

**职责**：提供快速配置预设选择

**Props**：
```typescript
interface QuickPresetSelectorProps {
  onSelectPreset: (preset: DebugToolPreset) => void
  disabled: boolean
}
```

**预设类型**：
- 基础调试：BusyBox
- 网络诊断：BusyBox + Netshoot
- 完整工具：BusyBox + Netshoot + Ubuntu

#### DebugToolCard Component

**职责**：渲染单个调试工具的选择卡片

**Props**：
```typescript
interface DebugToolCardProps {
  tool: DebugToolDefinition
  selected: boolean
  config: DebugToolConfig | undefined
  onToggle: (selected: boolean) => void
  onUpdateConfig: (config: Partial<DebugToolConfig>) => void
  disabled: boolean
}
```

### 2. 后端 API

#### PUT /api/services/[id]

**请求体**：
```typescript
{
  debug_config: MultiDebugConfig | null
}
```

**响应**：
```typescript
{
  id: string
  debug_config: MultiDebugConfig | null
  // ... other service fields
}
```

### 3. Kubernetes 配置生成器

#### generateDebugInitContainers()

**职责**：根据 debug_config 生成 Init Container 配置

**输入**：
```typescript
function generateDebugInitContainers(
  debugConfig: MultiDebugConfig
): K8sInitContainer[]
```

**输出**：Init Container 数组，每个包含：
- name: `debug-tools-{toolset}`
- image: 工具镜像
- command: 复制命令
- volumeMounts: 卷挂载配置

#### generateDebugVolumes()

**职责**：生成调试工具所需的 emptyDir 卷

**输入**：
```typescript
function generateDebugVolumes(
  debugConfig: MultiDebugConfig
): K8sVolume[]
```

**输出**：Volume 数组，每个包含：
- name: `debug-tools-{toolset}`
- emptyDir: {}

## Data Models

### MultiDebugConfig

新的多工具配置数据结构：

```typescript
interface MultiDebugConfig {
  enabled: boolean
  tools: DebugToolConfig[]
}

interface DebugToolConfig {
  toolset: 'busybox' | 'netshoot' | 'ubuntu' | 'custom'
  mountPath: string
  customImage?: string  // 仅当 toolset === 'custom' 时需要
}
```

**示例**：
```json
{
  "enabled": true,
  "tools": [
    {
      "toolset": "busybox",
      "mountPath": "/debug-tools/busybox"
    },
    {
      "toolset": "netshoot",
      "mountPath": "/debug-tools/netshoot"
    },
    {
      "toolset": "custom",
      "mountPath": "/debug-tools/my-tools",
      "customImage": "myregistry.com/debug:latest"
    }
  ]
}
```

### LegacyDebugConfig (向后兼容)

旧的单工具配置结构：

```typescript
interface LegacyDebugConfig {
  enabled: boolean
  toolset: 'busybox' | 'netshoot' | 'ubuntu' | 'custom'
  customImage?: string
  mountPath: string
}
```

### DebugToolDefinition

工具定义（前端常量）：

```typescript
interface DebugToolDefinition {
  toolset: 'busybox' | 'netshoot' | 'ubuntu' | 'custom'
  label: string
  description: string
  image: string | null  // null for custom
  size: string
  tools: string
  defaultMountPath: string
}
```

### DebugToolPreset

快速配置预设：

```typescript
interface DebugToolPreset {
  id: string
  label: string
  description: string
  toolsets: Array<'busybox' | 'netshoot' | 'ubuntu'>
}
```

### Kubernetes Init Container 结构

```typescript
interface K8sInitContainer {
  name: string
  image: string
  command: string[]
  volumeMounts: Array<{
    name: string
    mountPath: string
  }>
}

interface K8sVolume {
  name: string
  emptyDir: {}
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Tool combination acceptance

*For any* valid combination of debug tools (BusyBox, Netshoot, Ubuntu, custom), the system should accept and store the configuration without errors.

**Validates: Requirements 1.2**

### Property 2: Configuration persistence round trip

*For any* valid debug tool configuration, saving to the database and then reading back should produce an equivalent configuration.

**Validates: Requirements 1.3**

### Property 3: Path validation correctness

*For any* path string, the validation function should accept it if and only if it starts with `/` and contains only valid path characters (alphanumeric, `-`, `_`, `/`, `.`).

**Validates: Requirements 2.5, 6.2**

### Property 4: Init Container count matches tool count

*For any* debug tool configuration with N tools, the generated Kubernetes configuration should contain exactly N Init Containers.

**Validates: Requirements 3.1**

### Property 5: Volume count matches tool count

*For any* debug tool configuration with N tools, the generated Kubernetes configuration should contain exactly N emptyDir volumes.

**Validates: Requirements 3.2**

### Property 6: Mount path consistency

*For any* debug tool configuration, each Init Container's volume mount path should match the corresponding tool's configured mountPath.

**Validates: Requirements 3.3**

### Property 7: Init Container order stability

*For any* debug tool configuration, generating the Init Container list multiple times should produce the same order.

**Validates: Requirements 3.4**

### Property 8: Custom image mapping

*For any* debug tool configuration containing a custom image tool, the generated Init Container for that tool should use the exact custom image address specified in the configuration.

**Validates: Requirements 3.5**

### Property 9: Usage instructions completeness

*For any* non-empty debug tool configuration, the generated usage instructions should contain the mount path for every tool in the configuration.

**Validates: Requirements 4.3**

### Property 10: Legacy config conversion preserves semantics

*For any* legacy (single-tool) debug configuration, converting it to the new multi-tool format should produce a configuration with one tool that has the same toolset and mountPath.

**Validates: Requirements 5.1, 5.2**

### Property 11: Docker image address validation

*For any* string, the image validation function should accept it if and only if it matches Docker image naming conventions (optional registry, required name, optional tag/digest).

**Validates: Requirements 6.1**

### Property 12: Path uniqueness validation

*For any* debug tool configuration where two or more tools have the same mountPath, the validation should fail with a uniqueness error.

**Validates: Requirements 6.3**

### Property 13: Valid configuration saves successfully

*For any* debug tool configuration that passes all validation rules, the save operation should complete successfully and update the service.

**Validates: Requirements 6.5**

### Property 14: Preset application correctness

*For any* preset (basic, network, full), applying the preset should result in a tool selection that exactly matches the preset's defined toolset list.

**Validates: Requirements 7.3**

## Error Handling

### 前端验证错误

1. **空自定义镜像地址**
   - 触发条件：选择 custom 工具但 customImage 为空
   - 处理：显示错误提示 "请填写自定义镜像地址"，禁用保存按钮

2. **无效镜像地址格式**
   - 触发条件：customImage 不符合 Docker 镜像命名规范
   - 处理：显示错误提示 "镜像地址格式无效"，禁用保存按钮

3. **无效挂载路径**
   - 触发条件：mountPath 不以 `/` 开头或包含非法字符
   - 处理：显示错误提示 "路径必须以 / 开头且只能包含字母、数字、-、_、/、."，禁用保存按钮

4. **重复挂载路径**
   - 触发条件：多个工具使用相同的 mountPath
   - 处理：显示错误提示 "挂载路径不能重复"，高亮冲突的路径，禁用保存按钮

### 后端 API 错误

1. **数据库保存失败**
   - 触发条件：Prisma 更新操作失败
   - 处理：返回 500 错误，包含错误消息
   - 前端处理：显示 toast 错误提示

2. **服务不存在**
   - 触发条件：更新不存在的服务 ID
   - 处理：返回 404 错误
   - 前端处理：显示 toast 错误提示

### Kubernetes 部署错误

1. **Init Container 镜像拉取失败**
   - 触发条件：自定义镜像地址无效或无权限
   - 处理：Pod 状态显示 ImagePullBackOff
   - 用户处理：检查镜像地址和凭据

2. **Init Container 执行失败**
   - 触发条件：Init Container 命令执行错误
   - 处理：Pod 状态显示 Init:Error
   - 用户处理：查看 Pod 事件和日志

### 向后兼容错误

1. **旧配置格式无法识别**
   - 触发条件：debug_config 既不是旧格式也不是新格式
   - 处理：视为 null，显示空配置
   - 日志：记录警告信息

## Testing Strategy

### 单元测试

使用 **Vitest** 作为测试框架，测试以下单元：

1. **验证函数测试**
   - `validateDockerImage()` - 测试各种有效和无效的镜像地址
   - `validateMountPath()` - 测试各种有效和无效的路径
   - `validateUniquePathsvalidateUniquePaths()` - 测试路径唯一性检查
   - `validateDebugConfig()` - 测试完整配置验证

2. **转换函数测试**
   - `convertLegacyToMultiConfig()` - 测试旧配置转换
   - `isLegacyConfig()` - 测试配置格式检测

3. **生成函数测试**
   - `generateDebugInitContainers()` - 测试 Init Container 生成
   - `generateDebugVolumes()` - 测试卷生成
   - `generateUsageInstructions()` - 测试使用说明生成

4. **预设功能测试**
   - `applyPreset()` - 测试预设应用
   - `detectCurrentPreset()` - 测试预设检测

5. **边界情况测试**
   - 空配置（null/undefined）
   - 空工具数组
   - 单个工具
   - 最大工具数量（4个）

### 属性测试

使用 **fast-check** 库进行属性测试，每个测试运行至少 100 次迭代：

1. **Property 1: Tool combination acceptance**
   - 生成器：随机工具组合（1-4个工具，不重复）
   - 断言：配置验证通过

2. **Property 2: Configuration persistence round trip**
   - 生成器：随机有效配置
   - 断言：JSON.stringify(save(load(config))) === JSON.stringify(config)

3. **Property 3: Path validation correctness**
   - 生成器：随机路径字符串
   - 断言：验证结果与规则匹配

4. **Property 4-8: Kubernetes generation properties**
   - 生成器：随机有效配置
   - 断言：生成的 K8s 对象符合规范

5. **Property 9: Usage instructions completeness**
   - 生成器：随机非空配置
   - 断言：使用说明包含所有路径

6. **Property 10: Legacy config conversion**
   - 生成器：随机旧格式配置
   - 断言：转换后保留关键信息

7. **Property 11-13: Validation properties**
   - 生成器：随机配置（有效和无效）
   - 断言：验证逻辑正确

8. **Property 14: Preset application**
   - 生成器：随机预设选择
   - 断言：应用后的工具匹配预设

### 集成测试

1. **UI 组件集成测试**
   - 使用 React Testing Library
   - 测试用户交互流程：选择工具 → 配置路径 → 保存
   - 测试快速预设功能
   - 测试错误提示显示

2. **API 集成测试**
   - 测试完整的保存和读取流程
   - 测试向后兼容场景
   - 测试错误处理

3. **端到端测试**
   - 使用 Playwright（如果项目已配置）
   - 测试从 UI 配置到 Kubernetes 部署的完整流程

## Implementation Notes

### 数据库迁移

不需要数据库 schema 迁移，因为 `debug_config` 已经是 JSON 类型，可以存储新的数据结构。

### 向后兼容策略

```typescript
function normalizeDebugConfig(
  config: unknown
): MultiDebugConfig | null {
  if (!config) return null
  
  // 检测是否为旧格式
  if (isLegacyConfig(config)) {
    return convertLegacyToMultiConfig(config)
  }
  
  // 验证新格式
  if (isMultiConfig(config)) {
    return config
  }
  
  // 无法识别的格式
  console.warn('Unknown debug_config format:', config)
  return null
}
```

### 默认挂载路径策略

```typescript
const DEFAULT_MOUNT_PATHS = {
  busybox: '/debug-tools/busybox',
  netshoot: '/debug-tools/netshoot',
  ubuntu: '/debug-tools/ubuntu',
  custom: '/debug-tools/custom'
} as const
```

### Init Container 命令

每个工具的 Init Container 使用不同的复制命令：

```bash
# BusyBox
cp -r /bin/* /debug-tools/busybox/

# Netshoot
cp -r /usr/bin/* /debug-tools/netshoot/ && \
cp -r /usr/sbin/* /debug-tools/netshoot/

# Ubuntu
cp -r /bin/* /debug-tools/ubuntu/ && \
cp -r /usr/bin/* /debug-tools/ubuntu/

# Custom (用户需要在镜像中实现复制逻辑)
/copy-tools.sh /debug-tools/custom
```

### PATH 环境变量配置

使用说明中提供的 PATH 配置示例：

```bash
# 添加所有调试工具到 PATH
export PATH=/debug-tools/busybox:/debug-tools/netshoot:/debug-tools/ubuntu:$PATH

# 或者单独添加
export PATH=/debug-tools/busybox:$PATH
```

### UI 状态管理

使用 React 本地状态管理工具选择和配置：

```typescript
const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set())
const [toolConfigs, setToolConfigs] = useState<Map<string, DebugToolConfig>>(new Map())
```

### 性能考虑

1. **Init Container 并行执行**：Kubernetes 默认串行执行 Init Container，但可以通过 sidecar 模式优化（未来改进）
2. **镜像预拉取**：建议在集群中预拉取常用调试工具镜像
3. **卷大小**：emptyDir 默认使用节点磁盘，调试工具通常小于 500MB

### 安全考虑

1. **自定义镜像验证**：前端验证格式，但无法验证镜像内容安全性
2. **路径注入防护**：验证路径格式，防止路径遍历攻击
3. **权限控制**：调试工具不应该以 root 权限运行（通过 securityContext 配置）

## Future Enhancements

1. **工具版本选择**：允许用户选择工具的特定版本（如 busybox:1.35）
2. **自定义复制命令**：允许用户为自定义镜像指定复制命令
3. **工具分组**：支持将多个工具安装到同一路径
4. **动态工具注入**：支持在运行时注入工具，无需重启 Pod
5. **工具使用统计**：收集工具使用数据，优化预设配置
6. **镜像安全扫描**：集成镜像扫描工具，检查自定义镜像安全性
