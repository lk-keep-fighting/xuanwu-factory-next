# 容器调试工具注入功能设计方案

## 需求概述

在服务详情页面的部署配置中，增加"调试工具"选项，允许用户在部署服务时选择性地注入调试工具，增强容器的调试能力。

---

## 方案设计

### 方案选择

采用 **Init Container + Shared Volume** 方案，原因：

1. **不修改主镜像**：保持生产镜像精简和安全
2. **按需注入**：用户可选择是否启用，避免资源浪费
3. **灵活配置**：可以选择不同的工具集
4. **易于实现**：与现有部署流程集成简单

### 架构设计

```
用户界面 (ConfigurationTab)
    ↓
调试工具配置 (DebugToolsSection)
    ↓
数据模型 (Service.debug_config)
    ↓
K8s 部署 (k8sService.deployService)
    ↓
Init Container 注入
```

---

## 技术实现

### 1. 数据库 Schema 扩展

在 `Service` 表中添加 `debug_config` 字段：

```prisma
model Service {
  // ... 现有字段 ...
  
  debug_config Json? @map("debug_config")  // 调试工具配置
}
```

`debug_config` 结构：

```typescript
{
  enabled: boolean                    // 是否启用调试工具
  toolset: 'busybox' | 'netshoot' | 'ubuntu' | 'custom'  // 工具集类型
  customImage?: string                // 自定义镜像（当 toolset 为 custom 时）
  mountPath: string                   // 工具挂载路径，默认 /debug-tools
}
```

### 2. 前端 UI 组件

在 `ConfigurationTab` 中添加新的 Section：

```tsx
// src/components/services/configuration/DebugToolsSection.tsx

export function DebugToolsSection({
  isEditing,
  debugConfig,
  onUpdateDebugConfig
}: {
  isEditing: boolean
  debugConfig: DebugConfig | null
  onUpdateDebugConfig: (config: DebugConfig | null) => void
}) {
  // 工具集选项
  const toolsets = [
    {
      value: 'busybox',
      label: 'BusyBox',
      description: '轻量级工具集（~5MB），包含基础 Unix 命令',
      image: 'busybox:latest'
    },
    {
      value: 'netshoot',
      label: 'Netshoot',
      description: '网络调试专用（~300MB），包含完整网络工具',
      image: 'nicolaka/netshoot:latest'
    },
    {
      value: 'ubuntu',
      label: 'Ubuntu',
      description: '完整 Linux 环境（~80MB），可安装任何工具',
      image: 'ubuntu:22.04'
    },
    {
      value: 'custom',
      label: '自定义镜像',
      description: '使用自定义的调试工具镜像'
    }
  ]
  
  return (
    <div className="space-y-4">
      {/* 启用开关 */}
      <div className="flex items-center justify-between">
        <div>
          <Label>启用调试工具</Label>
          <p className="text-sm text-gray-500">
            通过 Init Container 注入调试工具到容器中
          </p>
        </div>
        <Switch
          checked={debugConfig?.enabled ?? false}
          onCheckedChange={(enabled) => {
            if (enabled) {
              onUpdateDebugConfig({
                enabled: true,
                toolset: 'busybox',
                mountPath: '/debug-tools'
              })
            } else {
              onUpdateDebugConfig(null)
            }
          }}
          disabled={!isEditing}
        />
      </div>

      {/* 工具集选择 */}
      {debugConfig?.enabled && (
        <>
          <div className="space-y-2">
            <Label>工具集类型</Label>
            <RadioGroup
              value={debugConfig.toolset}
              onValueChange={(value) => {
                onUpdateDebugConfig({
                  ...debugConfig,
                  toolset: value as DebugConfig['toolset']
                })
              }}
              disabled={!isEditing}
            >
              {toolsets.map((toolset) => (
                <div key={toolset.value} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value={toolset.value} id={toolset.value} />
                  <div className="flex-1">
                    <Label htmlFor={toolset.value} className="font-medium">
                      {toolset.label}
                    </Label>
                    <p className="text-sm text-gray-500">{toolset.description}</p>
                    {toolset.image && (
                      <code className="text-xs text-gray-400">{toolset.image}</code>
                    )}
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* 自定义镜像输入 */}
          {debugConfig.toolset === 'custom' && (
            <div className="space-y-2">
              <Label>自定义镜像</Label>
              <Input
                value={debugConfig.customImage ?? ''}
                onChange={(e) => {
                  onUpdateDebugConfig({
                    ...debugConfig,
                    customImage: e.target.value
                  })
                }}
                placeholder="例如: myregistry.com/debug-tools:latest"
                disabled={!isEditing}
              />
            </div>
          )}

          {/* 挂载路径 */}
          <div className="space-y-2">
            <Label>工具挂载路径</Label>
            <Input
              value={debugConfig.mountPath}
              onChange={(e) => {
                onUpdateDebugConfig({
                  ...debugConfig,
                  mountPath: e.target.value
                })
              }}
              placeholder="/debug-tools"
              disabled={!isEditing}
            />
            <p className="text-xs text-gray-500">
              工具将被复制到此路径，可通过 <code>{debugConfig.mountPath}/busybox</code> 等命令使用
            </p>
          </div>

          {/* 使用说明 */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>使用方法</AlertTitle>
            <AlertDescription>
              <div className="space-y-2 text-sm">
                <p>部署后，可通过以下方式使用调试工具：</p>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
{`# 进入容器
kubectl exec -it <pod-name> -n <namespace> -- sh

# 使用调试工具
${debugConfig.mountPath}/ls -la
${debugConfig.mountPath}/netstat -tulpn
${debugConfig.mountPath}/curl http://example.com

# 或添加到 PATH
export PATH=${debugConfig.mountPath}:$PATH
ls -la`}
                </pre>
              </div>
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  )
}
```

### 3. 类型定义

```typescript
// src/types/project.ts

export interface DebugConfig {
  enabled: boolean
  toolset: 'busybox' | 'netshoot' | 'ubuntu' | 'custom'
  customImage?: string
  mountPath: string
}

export interface BaseService {
  // ... 现有字段 ...
  debug_config?: DebugConfig | null
}
```

### 4. K8s 部署逻辑修改

```typescript
// src/lib/k8s.ts

private buildDebugInitContainer(
  debugConfig: DebugConfig,
  mountPath: string
): k8s.V1Container {
  const toolsetImages = {
    busybox: 'busybox:latest',
    netshoot: 'nicolaka/netshoot:latest',
    ubuntu: 'ubuntu:22.04'
  }

  const image = debugConfig.toolset === 'custom' && debugConfig.customImage
    ? debugConfig.customImage
    : toolsetImages[debugConfig.toolset] || toolsetImages.busybox

  // 根据不同工具集生成不同的安装脚本
  const installScript = this.generateDebugToolsInstallScript(debugConfig.toolset, mountPath)

  return {
    name: 'install-debug-tools',
    image,
    command: ['sh', '-c'],
    args: [installScript],
    volumeMounts: [
      {
        name: 'debug-tools',
        mountPath
      }
    ]
  }
}

private generateDebugToolsInstallScript(
  toolset: DebugConfig['toolset'],
  mountPath: string
): string {
  switch (toolset) {
    case 'busybox':
      return `
echo "Installing BusyBox debug tools..."
cp /bin/busybox ${mountPath}/
${mountPath}/busybox --install -s ${mountPath}/
echo "BusyBox tools installed successfully at ${mountPath}"
ls -la ${mountPath}/
      `.trim()

    case 'netshoot':
      return `
echo "Installing Netshoot debug tools..."
mkdir -p ${mountPath}/bin
# 复制常用网络工具
for tool in curl wget netcat nc nslookup dig tcpdump netstat ss iperf3 mtr traceroute; do
  if command -v $tool >/dev/null 2>&1; then
    cp $(command -v $tool) ${mountPath}/bin/ 2>/dev/null || true
  fi
done
echo "Netshoot tools installed successfully at ${mountPath}/bin"
ls -la ${mountPath}/bin/
      `.trim()

    case 'ubuntu':
      return `
echo "Installing Ubuntu debug tools..."
mkdir -p ${mountPath}/bin
# 复制基础工具
for tool in bash sh ls cat grep ps top curl wget netcat; do
  if command -v $tool >/dev/null 2>&1; then
    cp $(command -v $tool) ${mountPath}/bin/ 2>/dev/null || true
  fi
done
echo "Ubuntu tools installed successfully at ${mountPath}/bin"
echo "Note: You can install more tools using apt-get in the main container"
ls -la ${mountPath}/bin/
      `.trim()

    default:
      return `
echo "Installing custom debug tools..."
# 用户需要在自定义镜像中实现工具复制逻辑
# 默认复制 /bin 和 /usr/bin 中的常用工具
mkdir -p ${mountPath}/bin
cp /bin/* ${mountPath}/bin/ 2>/dev/null || true
echo "Custom tools installed at ${mountPath}/bin"
      `.trim()
  }
}

async deployService(service: Service, namespace: string) {
  // ... 现有代码 ...

  const debugConfig = service.debug_config as DebugConfig | null | undefined

  const deployment: k8s.V1Deployment = {
    metadata: {
      name: service.name,
      labels: { app: service.name },
      namespace: targetNamespace
    },
    spec: {
      replicas,
      selector: {
        matchLabels: { app: service.name }
      },
      template: {
        metadata: {
          labels: { app: service.name }
        },
        spec: {
          // 添加 Init Container（如果启用了调试工具）
          ...(debugConfig?.enabled && {
            initContainers: [
              this.buildDebugInitContainer(
                debugConfig,
                debugConfig.mountPath || '/debug-tools'
              )
            ]
          }),
          containers: [{
            name: service.name,
            image: this.getImage(service),
            // ... 现有配置 ...
            volumeMounts: [
              ...this.buildVolumeMounts(service.volumes, service.name),
              // 添加调试工具卷挂载
              ...(debugConfig?.enabled ? [{
                name: 'debug-tools',
                mountPath: debugConfig.mountPath || '/debug-tools'
              }] : [])
            ]
          }],
          volumes: [
            ...this.buildVolumes(service.volumes),
            // 添加调试工具共享卷
            ...(debugConfig?.enabled ? [{
              name: 'debug-tools',
              emptyDir: {}
            }] : [])
          ]
        }
      }
    }
  }

  // ... 部署逻辑 ...
}
```

### 5. API 路由更新

确保 `debug_config` 字段在服务创建和更新时被正确处理：

```typescript
// src/app/api/services/helpers.ts

const ALLOWED_SERVICE_FIELDS = [
  // ... 现有字段 ...
  'debug_config'
]

export function sanitizeServiceData(data: Record<string, unknown>): Record<string, unknown> {
  // ... 现有逻辑 ...
  
  // 验证 debug_config 格式
  if (data.debug_config !== undefined && data.debug_config !== null) {
    const config = data.debug_config as Record<string, unknown>
    if (typeof config === 'object') {
      // 确保必需字段存在
      if (config.enabled === true) {
        if (!config.toolset || !['busybox', 'netshoot', 'ubuntu', 'custom'].includes(config.toolset as string)) {
          throw new Error('Invalid debug_config.toolset')
        }
        if (!config.mountPath || typeof config.mountPath !== 'string') {
          config.mountPath = '/debug-tools'
        }
      }
    }
  }
  
  return sanitized
}
```

---

## 工具集对比

| 工具集 | 镜像大小 | 包含工具 | 适用场景 | 推荐度 |
|--------|---------|---------|---------|--------|
| **BusyBox** | ~5MB | 基础 Unix 命令（ls, ps, netstat, wget, nc 等） | 轻量级调试，快速排查 | ⭐⭐⭐⭐⭐ |
| **Netshoot** | ~300MB | 完整网络工具（tcpdump, nmap, curl, dig, iperf3 等） | 网络问题深度调试 | ⭐⭐⭐⭐ |
| **Ubuntu** | ~80MB | 基础系统 + apt-get（可按需安装） | 需要特定工具或完整环境 | ⭐⭐⭐ |
| **自定义** | 取决于镜像 | 用户自定义 | 特殊需求 | ⭐⭐ |

---

## 使用流程

### 1. 配置阶段

1. 用户进入服务详情页 → 配置标签页
2. 点击"编辑配置"
3. 在"调试工具"部分启用开关
4. 选择工具集类型（推荐 BusyBox）
5. 可选：修改挂载路径
6. 保存配置

### 2. 部署阶段

1. 点击"部署"按钮
2. 系统自动在 Deployment 中注入 Init Container
3. Init Container 将工具复制到共享卷
4. 主容器启动后可使用调试工具

### 3. 调试阶段

```bash
# 进入容器
kubectl exec -it <pod-name> -n <namespace> -- sh

# 方式 1: 直接使用完整路径
/debug-tools/ls -la
/debug-tools/netstat -tulpn
/debug-tools/curl http://example.com

# 方式 2: 添加到 PATH（推荐）
export PATH=/debug-tools:$PATH
ls -la
netstat -tulpn
curl http://example.com

# 方式 3: 创建别名
alias ll='/debug-tools/ls -la'
```

---

## 优势

1. **不修改主镜像**：保持生产镜像精简和安全
2. **按需启用**：默认不启用，避免资源浪费
3. **灵活选择**：提供多种工具集，满足不同调试需求
4. **易于使用**：UI 界面简单直观，一键启用
5. **性能影响小**：Init Container 只在启动时运行一次
6. **安全可控**：工具仅在容器内部可用，不影响镜像安全性

---

## 注意事项

1. **镜像拉取**：确保集群可以访问工具镜像（busybox, netshoot 等）
2. **存储空间**：emptyDir 卷会占用节点存储，但通常很小（5-300MB）
3. **权限问题**：某些工具（如 tcpdump）可能需要特权模式
4. **生产环境**：建议仅在开发/测试环境启用，生产环境按需启用
5. **工具更新**：定期更新工具镜像版本以获取安全补丁

---

## 扩展方案

### 方案 A: Ephemeral Container 集成

在服务详情页添加"临时调试"按钮，直接注入 Ephemeral Container：

```typescript
// 前端按钮
<Button onClick={() => injectDebugContainer('netshoot')}>
  注入网络调试容器
</Button>

// API 实现
async injectEphemeralContainer(
  podName: string,
  namespace: string,
  image: string
) {
  // 使用 K8s API 注入 Ephemeral Container
  // 需要 K8s 1.23+
}
```

### 方案 B: 调试工具市场

提供更多预配置的工具集：

- **性能分析**: perf, strace, ltrace
- **数据库调试**: mysql-client, redis-cli, psql
- **开发工具**: vim, git, python
- **监控工具**: htop, iotop, iftop

### 方案 C: 一键调试模式

在服务详情页添加"进入调试模式"按钮：

1. 自动注入调试工具
2. 打开 Web Terminal
3. 自动连接到容器
4. 提供常用调试命令快捷方式

---

## 实施计划

### Phase 1: 基础功能（1-2 天）
- [ ] 数据库 Schema 添加 `debug_config` 字段
- [ ] 前端 UI 组件实现（DebugToolsSection）
- [ ] K8s 部署逻辑修改（Init Container 注入）
- [ ] 基础测试

### Phase 2: 工具集完善（1 天）
- [ ] 实现 BusyBox 工具集
- [ ] 实现 Netshoot 工具集
- [ ] 实现 Ubuntu 工具集
- [ ] 自定义镜像支持

### Phase 3: 用户体验优化（1 天）
- [ ] 添加使用说明和示例
- [ ] 工具集对比和推荐
- [ ] 错误处理和提示
- [ ] 文档完善

### Phase 4: 高级功能（可选）
- [ ] Ephemeral Container 集成
- [ ] Web Terminal 集成
- [ ] 调试工具市场
- [ ] 一键调试模式

---

## 总结

该方案通过 Init Container + Shared Volume 的方式，在不修改主镜像的前提下，为容器提供灵活的调试工具注入能力。用户可以通过简单的 UI 配置，选择合适的工具集，大大提升容器调试效率。
