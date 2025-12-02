'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import type { DebugConfig } from '@/types/project'

interface DebugToolsSectionProps {
  isEditing: boolean
  debugConfig: DebugConfig | null | undefined
  onUpdateDebugConfig: (config: DebugConfig | null) => void
}

const TOOLSETS = [
  {
    value: 'busybox' as const,
    label: 'BusyBox',
    description: '轻量级工具集（~5MB），包含基础 Unix 命令',
    image: 'busybox:latest',
    tools: 'ls, ps, netstat, wget, nc, vi, top 等'
  },
  {
    value: 'netshoot' as const,
    label: 'Netshoot',
    description: '网络调试专用（~300MB），包含完整网络工具',
    image: 'nicolaka/netshoot:latest',
    tools: 'tcpdump, nmap, curl, dig, iperf3, mtr, traceroute 等'
  },
  {
    value: 'ubuntu' as const,
    label: 'Ubuntu',
    description: '完整 Linux 环境（~80MB），可使用 apt-get 安装任何工具',
    image: 'ubuntu:22.04',
    tools: 'bash, curl, wget, ps, apt-get 等'
  },
  {
    value: 'custom' as const,
    label: '自定义镜像',
    description: '使用自定义的调试工具镜像',
    image: null,
    tools: '取决于您的镜像'
  }
]

export function DebugToolsSection({
  isEditing,
  debugConfig,
  onUpdateDebugConfig
}: DebugToolsSectionProps) {
  const enabled = debugConfig?.enabled ?? false
  const toolset = debugConfig?.toolset ?? 'busybox'
  const mountPath = debugConfig?.mountPath ?? '/debug-tools'
  const customImage = debugConfig?.customImage ?? ''

  return (
    <div className="space-y-4">
      {/* 启用开关 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-base">启用调试工具</Label>
          <p className="text-sm text-gray-500">
            通过 Init Container 注入调试工具到容器中，不修改主镜像
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked: boolean) => {
            if (checked) {
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
      {enabled && (
        <>
          <div className="space-y-3">
            <Label className="text-base">工具集类型</Label>
            <RadioGroup
              value={toolset}
              onValueChange={(value: string) => {
                onUpdateDebugConfig({
                  ...debugConfig,
                  enabled: true,
                  toolset: value as DebugConfig['toolset'],
                  mountPath
                })
              }}
              disabled={!isEditing}
              className="space-y-3"
            >
              {TOOLSETS.map((ts) => (
                <div
                  key={ts.value}
                  className={`flex items-start space-x-3 p-4 border rounded-lg transition-colors ${
                    toolset === ts.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${!isEditing ? 'opacity-60' : ''}`}
                >
                  <RadioGroupItem
                    value={ts.value}
                    id={ts.value}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={ts.value}
                      className="font-medium cursor-pointer"
                    >
                      {ts.label}
                    </Label>
                    <p className="text-sm text-gray-600">{ts.description}</p>
                    {ts.image && (
                      <code className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {ts.image}
                      </code>
                    )}
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">包含工具：</span> {ts.tools}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* 自定义镜像输入 */}
          {toolset === 'custom' && (
            <div className="space-y-2">
              <Label>自定义镜像</Label>
              <Input
                value={customImage}
                onChange={(e) => {
                  onUpdateDebugConfig({
                    ...debugConfig,
                    enabled: true,
                    toolset: 'custom',
                    customImage: e.target.value,
                    mountPath
                  })
                }}
                placeholder="例如: myregistry.com/debug-tools:latest"
                disabled={!isEditing}
              />
              <p className="text-xs text-gray-500">
                请确保镜像中包含需要的调试工具，并在 Init Container 中将工具复制到挂载路径
              </p>
            </div>
          )}

          {/* 挂载路径 */}
          <div className="space-y-2">
            <Label>工具挂载路径</Label>
            <Input
              value={mountPath}
              onChange={(e) => {
                onUpdateDebugConfig({
                  ...debugConfig,
                  enabled: true,
                  toolset,
                  mountPath: e.target.value,
                  ...(toolset === 'custom' && customImage ? { customImage } : {})
                })
              }}
              placeholder="/debug-tools"
              disabled={!isEditing}
            />
            <p className="text-xs text-gray-500">
              工具将被复制到此路径，建议使用默认值 <code>/debug-tools</code>
            </p>
          </div>

          {/* 使用说明 */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>使用方法</AlertTitle>
            <AlertDescription>
              <div className="space-y-2 text-sm mt-2">
                <p>部署后，可通过以下方式使用调试工具：</p>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`# 1. 进入容器
kubectl exec -it <pod-name> -n <namespace> -- sh

# 2. 使用调试工具（方式一：完整路径）
${mountPath}/ls -la
${mountPath}/netstat -tulpn
${mountPath}/curl http://example.com

# 3. 使用调试工具（方式二：添加到 PATH，推荐）
export PATH=${mountPath}:$PATH
ls -la
netstat -tulpn
curl http://example.com`}
                </pre>
                <div className="flex items-start gap-2 mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-800">
                    <strong>提示：</strong>调试工具仅在容器内部可用，不会修改原始镜像。
                    建议在开发/测试环境使用，生产环境按需启用。
                  </p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  )
}
