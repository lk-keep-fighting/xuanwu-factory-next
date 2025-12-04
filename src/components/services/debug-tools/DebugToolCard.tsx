'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import type { DebugToolDefinition, DebugToolConfig } from '@/types/project'

interface DebugToolCardProps {
  tool: DebugToolDefinition
  selected: boolean
  config: DebugToolConfig | undefined
  onToggle: (selected: boolean) => void
  onUpdateConfig: (config: Partial<DebugToolConfig>) => void
  disabled: boolean
}

export function DebugToolCard({
  tool,
  selected,
  config,
  onToggle,
  onUpdateConfig,
  disabled
}: DebugToolCardProps) {
  const mountPath = config?.mountPath ?? tool.defaultMountPath
  const customImage = config?.customImage ?? ''

  return (
    <Card
      className={`p-4 cursor-pointer transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 shadow-sm'
          : 'border-gray-200 hover:border-gray-300'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      onClick={() => {
        if (!disabled) {
          onToggle(!selected)
        }
      }}
    >
      <div className="flex items-start space-x-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            if (!disabled) {
              onToggle(e.target.checked)
            }
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={disabled}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />

        {/* Tool Info */}
        <div className="flex-1 space-y-2">
          <div>
            <Label className="font-medium text-base cursor-pointer">
              {tool.label}
            </Label>
            <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
          </div>

          {/* Image and Size */}
          <div className="flex items-center gap-3 text-xs">
            {tool.image && (
              <code className="text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {tool.image}
              </code>
            )}
            <span className="text-gray-500">大小: {tool.size}</span>
          </div>

          {/* Tools List */}
          <p className="text-xs text-gray-500">
            <span className="font-medium">包含工具：</span> {tool.tools}
          </p>

          {/* Configuration Fields (only when selected) */}
          {selected && (
            <div className="space-y-3 mt-3 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
              {/* Custom Image Input (only for custom toolset) */}
              {tool.toolset === 'custom' && (
                <div className="space-y-1.5">
                  <Label className="text-sm">自定义镜像地址</Label>
                  <Input
                    value={customImage}
                    onChange={(e) => {
                      onUpdateConfig({ customImage: e.target.value })
                    }}
                    placeholder="例如: myregistry.com/debug-tools:latest"
                    disabled={disabled}
                    className="text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    请确保镜像中包含 /copy-tools.sh 脚本
                  </p>
                </div>
              )}

              {/* Mount Path Input */}
              <div className="space-y-1.5">
                <Label className="text-sm">挂载路径</Label>
                <Input
                  value={mountPath}
                  onChange={(e) => {
                    onUpdateConfig({ mountPath: e.target.value })
                  }}
                  placeholder={tool.defaultMountPath}
                  disabled={disabled}
                  className="text-sm"
                />
                <p className="text-xs text-gray-500">
                  工具将被安装到此路径
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
