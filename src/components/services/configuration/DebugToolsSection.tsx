'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import type { MultiDebugConfig, DebugToolConfig, DebugToolPreset } from '@/types/project'
import { DebugToolCard } from '@/components/services/debug-tools/DebugToolCard'
import { QuickPresetSelector } from '@/components/services/debug-tools/QuickPresetSelector'
import { UsageInstructions } from '@/components/services/debug-tools/UsageInstructions'
import { TOOL_DEFINITIONS } from '@/components/services/debug-tools/constants'
import { 
  normalizeDebugConfig, 
  validateDebugConfig,
  type ValidationResult 
} from '@/lib/debug-tools-utils'

interface DebugToolsSectionProps {
  isEditing: boolean
  debugConfig: MultiDebugConfig | null | undefined
  onUpdateDebugConfig: (config: MultiDebugConfig | null) => void
}

export function DebugToolsSection({
  isEditing,
  debugConfig,
  onUpdateDebugConfig
}: DebugToolsSectionProps) {
  // Normalize config (handles backward compatibility)
  const normalizedConfig = useMemo(() => {
    const result = normalizeDebugConfig(debugConfig)
    console.log('[DebugToolsSection] debugConfig:', debugConfig, 'normalized:', result)
    return result
  }, [debugConfig])

  // Derive state from props (controlled component pattern)
  const selectedTools = useMemo(() => {
    if (normalizedConfig && normalizedConfig.enabled && normalizedConfig.tools) {
      return new Set(normalizedConfig.tools.map(t => t.toolset))
    }
    return new Set<string>()
  }, [normalizedConfig])
  
  const toolConfigs = useMemo(() => {
    if (normalizedConfig && normalizedConfig.enabled && normalizedConfig.tools) {
      return new Map(normalizedConfig.tools.map(t => [t.toolset, t]))
    }
    return new Map<string, DebugToolConfig>()
  }, [normalizedConfig])

  // Build current config from derived state
  const currentConfig: MultiDebugConfig | null = useMemo(() => {
    if (selectedTools.size === 0) {
      return null
    }

    const tools: DebugToolConfig[] = Array.from(selectedTools).map(toolset => {
      const config = toolConfigs.get(toolset)
      const definition = TOOL_DEFINITIONS.find(t => t.toolset === toolset)
      
      return {
        toolset: toolset as DebugToolConfig['toolset'],
        mountPath: config?.mountPath ?? definition?.defaultMountPath ?? '/debug-tools',
        customImage: config?.customImage
      }
    })

    return {
      enabled: true,
      tools
    }
  }, [selectedTools, toolConfigs])

  // Validate config
  const validationResult = useMemo(() => {
    return validateDebugConfig(currentConfig)
  }, [currentConfig])

  // Use local state to ensure immediate UI response
  const [localEnabled, setLocalEnabled] = useState(Boolean(normalizedConfig?.enabled))
  
  // Sync local state with props when they change
  useEffect(() => {
    const propEnabled = Boolean(normalizedConfig?.enabled)
    console.log('[DebugToolsSection] Syncing localEnabled:', propEnabled, 'from normalizedConfig:', normalizedConfig)
    setLocalEnabled(propEnabled)
  }, [normalizedConfig])
  
  console.log('[DebugToolsSection] localEnabled:', localEnabled, 'normalizedConfig:', normalizedConfig)

  // Handle enable/disable toggle
  const handleEnableToggle = useCallback((checked: boolean) => {
    console.log('[DebugToolsSection] handleEnableToggle:', checked)
    
    // Update local state immediately for responsive UI
    setLocalEnabled(checked)
    
    if (checked) {
      // Enable with no tools selected initially
      onUpdateDebugConfig({ enabled: true, tools: [] })
    } else {
      // Disable completely
      onUpdateDebugConfig(null)
    }
  }, [onUpdateDebugConfig])

  // Handle tool selection toggle
  const handleToolToggle = useCallback((toolset: string, selected: boolean) => {
    const newSelected = new Set(selectedTools)
    const newConfigs = new Map(toolConfigs)
    
    if (selected) {
      newSelected.add(toolset)
      
      // Initialize config with default values if not exists
      if (!newConfigs.has(toolset)) {
        const definition = TOOL_DEFINITIONS.find(t => t.toolset === toolset)
        newConfigs.set(toolset, {
          toolset: toolset as DebugToolConfig['toolset'],
          mountPath: definition?.defaultMountPath ?? '/debug-tools'
        })
      }
    } else {
      newSelected.delete(toolset)
      newConfigs.delete(toolset)
    }
    
    // Build and update config
    const tools: DebugToolConfig[] = Array.from(newSelected).map(ts => {
      const config = newConfigs.get(ts)
      const definition = TOOL_DEFINITIONS.find(t => t.toolset === ts)
      return {
        toolset: ts as DebugToolConfig['toolset'],
        mountPath: config?.mountPath ?? definition?.defaultMountPath ?? '/debug-tools',
        customImage: config?.customImage
      }
    })
    
    onUpdateDebugConfig(tools.length > 0 ? { enabled: true, tools } : null)
  }, [selectedTools, toolConfigs, onUpdateDebugConfig])

  // Handle tool config update
  const handleToolConfigUpdate = useCallback((toolset: string, updates: Partial<DebugToolConfig>) => {
    const newConfigs = new Map(toolConfigs)
    const currentToolConfig = newConfigs.get(toolset)
    
    if (currentToolConfig) {
      newConfigs.set(toolset, {
        ...currentToolConfig,
        ...updates
      })
      
      // Build and update config
      const tools: DebugToolConfig[] = Array.from(selectedTools).map(ts => {
        const config = newConfigs.get(ts)
        const definition = TOOL_DEFINITIONS.find(t => t.toolset === ts)
        return {
          toolset: ts as DebugToolConfig['toolset'],
          mountPath: config?.mountPath ?? definition?.defaultMountPath ?? '/debug-tools',
          customImage: config?.customImage
        }
      })
      
      onUpdateDebugConfig({ enabled: true, tools })
    }
  }, [toolConfigs, selectedTools, onUpdateDebugConfig])

  // Handle preset selection
  const handlePresetSelect = useCallback((preset: DebugToolPreset) => {
    const tools: DebugToolConfig[] = preset.toolsets.map(toolset => {
      const definition = TOOL_DEFINITIONS.find(t => t.toolset === toolset)
      return {
        toolset,
        mountPath: definition?.defaultMountPath ?? '/debug-tools'
      }
    })
    
    onUpdateDebugConfig({ enabled: true, tools })
  }, [onUpdateDebugConfig])

  return (
    <div className="space-y-4">
      {/* Enable Switch */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-base">启用调试工具</Label>
          <p className="text-sm text-gray-500">
            通过 Init Container 注入调试工具到容器中，不修改主镜像
          </p>
        </div>
        <Switch
          checked={localEnabled}
          onCheckedChange={handleEnableToggle}
          disabled={!isEditing}
        />
      </div>

      {/* Tool Selection and Configuration */}
      {localEnabled && (
        <>
          {/* Quick Preset Selector */}
          <QuickPresetSelector
            onSelectPreset={handlePresetSelect}
            disabled={!isEditing}
          />

          {/* Tool Cards */}
          <div className="space-y-3">
            <Label className="text-base">选择调试工具</Label>
            <p className="text-sm text-gray-500">
              可以同时选择多个工具，每个工具将安装到独立的路径
            </p>
            
            <div className="space-y-3">
              {TOOL_DEFINITIONS.map((tool) => (
                <DebugToolCard
                  key={tool.toolset}
                  tool={tool}
                  selected={selectedTools.has(tool.toolset)}
                  config={toolConfigs.get(tool.toolset)}
                  onToggle={(selected) => handleToolToggle(tool.toolset, selected)}
                  onUpdateConfig={(updates) => handleToolConfigUpdate(tool.toolset, updates)}
                  disabled={!isEditing}
                />
              ))}
            </div>
          </div>

          {/* Validation Errors */}
          {!validationResult.valid && validationResult.errors.length > 0 && (
            <Alert className="bg-red-50 border-red-200 text-red-900">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">配置错误：</p>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.errors.map((error, index) => (
                      <li key={index} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Usage Instructions */}
          <UsageInstructions config={currentConfig} />
        </>
      )}
    </div>
  )
}
