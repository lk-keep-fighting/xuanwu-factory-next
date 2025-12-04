'use client'

import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import type { DebugToolPreset } from '@/types/project'

interface QuickPresetSelectorProps {
  onSelectPreset: (preset: DebugToolPreset) => void
  disabled: boolean
}

// 快速配置预设常量
export const QUICK_PRESETS: DebugToolPreset[] = [
  {
    id: 'basic',
    label: '基础调试',
    description: '仅 BusyBox，轻量级',
    toolsets: ['busybox']
  },
  {
    id: 'network',
    label: '网络诊断',
    description: 'BusyBox + Netshoot',
    toolsets: ['busybox', 'netshoot']
  },
  {
    id: 'full',
    label: '完整工具',
    description: 'BusyBox + Netshoot + Ubuntu',
    toolsets: ['busybox', 'netshoot', 'ubuntu']
  }
]

export function QuickPresetSelector({
  onSelectPreset,
  disabled
}: QuickPresetSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-yellow-500" />
        <Label className="text-sm font-medium">快速配置</Label>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {QUICK_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            onClick={() => onSelectPreset(preset)}
            disabled={disabled}
            className="text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            {preset.label}
            <span className="ml-1 text-gray-500">({preset.toolsets.length}个工具)</span>
          </Button>
        ))}
      </div>
      
      <p className="text-xs text-gray-500">
        点击快速应用常用工具组合，之后可继续手动调整
      </p>
    </div>
  )
}

// Helper function to import Label
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>
}
