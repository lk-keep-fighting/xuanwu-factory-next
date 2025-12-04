import { describe, it, expect } from 'vitest'
import type {
  MultiDebugConfig,
  DebugToolConfig,
  LegacyDebugConfig,
  DebugConfig,
  DebugToolDefinition,
  DebugToolPreset
} from '../project'

describe('Debug Tool Type Definitions', () => {
  it('should define MultiDebugConfig correctly', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        {
          toolset: 'busybox',
          mountPath: '/debug-tools/busybox'
        }
      ]
    }
    
    expect(config.enabled).toBe(true)
    expect(config.tools).toHaveLength(1)
    expect(config.tools[0].toolset).toBe('busybox')
  })

  it('should define DebugToolConfig correctly', () => {
    const toolConfig: DebugToolConfig = {
      toolset: 'netshoot',
      mountPath: '/debug-tools/netshoot'
    }
    
    expect(toolConfig.toolset).toBe('netshoot')
    expect(toolConfig.mountPath).toBe('/debug-tools/netshoot')
  })

  it('should support custom image in DebugToolConfig', () => {
    const customConfig: DebugToolConfig = {
      toolset: 'custom',
      mountPath: '/debug-tools/custom',
      customImage: 'myregistry.com/debug:latest'
    }
    
    expect(customConfig.customImage).toBe('myregistry.com/debug:latest')
  })

  it('should define LegacyDebugConfig correctly', () => {
    const legacyConfig: LegacyDebugConfig = {
      enabled: true,
      toolset: 'ubuntu',
      mountPath: '/debug-tools'
    }
    
    expect(legacyConfig.enabled).toBe(true)
    expect(legacyConfig.toolset).toBe('ubuntu')
  })

  it('should maintain DebugConfig as alias to LegacyDebugConfig', () => {
    const config: DebugConfig = {
      enabled: true,
      toolset: 'busybox',
      mountPath: '/debug-tools'
    }
    
    // This should compile without errors, proving DebugConfig = LegacyDebugConfig
    const legacyConfig: LegacyDebugConfig = config
    expect(legacyConfig).toEqual(config)
  })

  it('should define DebugToolDefinition correctly', () => {
    const toolDef: DebugToolDefinition = {
      toolset: 'busybox',
      label: 'BusyBox',
      description: 'Lightweight toolset',
      image: 'busybox:latest',
      size: '5MB',
      tools: 'ls, ps, netstat',
      defaultMountPath: '/debug-tools/busybox'
    }
    
    expect(toolDef.label).toBe('BusyBox')
    expect(toolDef.image).toBe('busybox:latest')
  })

  it('should support null image for custom tool definition', () => {
    const customDef: DebugToolDefinition = {
      toolset: 'custom',
      label: 'Custom',
      description: 'Custom image',
      image: null,
      size: 'Unknown',
      tools: 'Depends on image',
      defaultMountPath: '/debug-tools/custom'
    }
    
    expect(customDef.image).toBeNull()
  })

  it('should define DebugToolPreset correctly', () => {
    const preset: DebugToolPreset = {
      id: 'basic',
      label: 'Basic Debugging',
      description: 'BusyBox only',
      toolsets: ['busybox']
    }
    
    expect(preset.id).toBe('basic')
    expect(preset.toolsets).toContain('busybox')
  })

  it('should support multiple toolsets in preset', () => {
    const preset: DebugToolPreset = {
      id: 'full',
      label: 'Full Tools',
      description: 'All tools',
      toolsets: ['busybox', 'netshoot', 'ubuntu']
    }
    
    expect(preset.toolsets).toHaveLength(3)
  })

  it('should allow all valid toolset values', () => {
    const toolsets: Array<DebugToolConfig['toolset']> = [
      'busybox',
      'netshoot',
      'ubuntu',
      'custom'
    ]
    
    toolsets.forEach(toolset => {
      const config: DebugToolConfig = {
        toolset,
        mountPath: `/debug-tools/${toolset}`
      }
      expect(config.toolset).toBe(toolset)
    })
  })
})
