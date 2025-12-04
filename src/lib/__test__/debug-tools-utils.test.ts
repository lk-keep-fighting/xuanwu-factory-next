import { describe, it, expect } from 'vitest'
import {
  validateDockerImage,
  validateMountPath,
  validateUniquePaths,
  validateDebugConfig,
  isLegacyConfig,
  isMultiConfig,
  convertLegacyToMultiConfig,
  normalizeDebugConfig,
  generateDebugInitContainers,
  generateDebugVolumes,
  generateUsageInstructions,
} from '../debug-tools-utils'
import type { MultiDebugConfig, LegacyDebugConfig, DebugToolConfig } from '@/types/project'

describe('validateDockerImage', () => {
  it('should accept valid simple image names', () => {
    expect(validateDockerImage('busybox')).toBe(true)
    expect(validateDockerImage('nginx')).toBe(true)
    expect(validateDockerImage('ubuntu')).toBe(true)
  })

  it('should accept valid image names with tags', () => {
    expect(validateDockerImage('busybox:latest')).toBe(true)
    expect(validateDockerImage('nginx:1.21')).toBe(true)
    expect(validateDockerImage('ubuntu:20.04')).toBe(true)
  })

  it('should accept valid image names with registry', () => {
    expect(validateDockerImage('docker.io/library/nginx')).toBe(true)
    expect(validateDockerImage('gcr.io/project/image')).toBe(true)
    expect(validateDockerImage('registry.example.com/namespace/image:tag')).toBe(true)
  })

  it('should accept valid image names with registry and port', () => {
    expect(validateDockerImage('localhost:5000/myimage')).toBe(true)
    expect(validateDockerImage('registry.example.com:8080/image:tag')).toBe(true)
  })

  it('should accept valid image names with digest', () => {
    expect(validateDockerImage('nginx@sha256:' + 'a'.repeat(64))).toBe(true)
  })

  it('should reject invalid image names', () => {
    expect(validateDockerImage('')).toBe(false)
    expect(validateDockerImage('UPPERCASE')).toBe(false)
    expect(validateDockerImage('image with spaces')).toBe(false)
    expect(validateDockerImage('image::')).toBe(false)
  })

  it('should reject non-string inputs', () => {
    expect(validateDockerImage(null as any)).toBe(false)
    expect(validateDockerImage(undefined as any)).toBe(false)
    expect(validateDockerImage(123 as any)).toBe(false)
  })
})

describe('validateMountPath', () => {
  it('should accept valid absolute paths', () => {
    expect(validateMountPath('/debug-tools')).toBe(true)
    expect(validateMountPath('/debug-tools/busybox')).toBe(true)
    expect(validateMountPath('/usr/local/bin')).toBe(true)
    expect(validateMountPath('/opt/tools-v1.0')).toBe(true)
  })

  it('should reject invalid paths', () => {
    expect(validateMountPath('/')).toBe(false)
    expect(validateMountPath('relative/path')).toBe(false)
    expect(validateMountPath('/path with spaces')).toBe(false)
    expect(validateMountPath('')).toBe(false)
  })

  it('should reject non-string inputs', () => {
    expect(validateMountPath(null as any)).toBe(false)
    expect(validateMountPath(undefined as any)).toBe(false)
    expect(validateMountPath(123 as any)).toBe(false)
  })
})

describe('validateUniquePaths', () => {
  it('should return true for unique paths', () => {
    const tools: DebugToolConfig[] = [
      { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
      { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' },
    ]
    expect(validateUniquePaths(tools)).toBe(true)
  })

  it('should return false for duplicate paths', () => {
    const tools: DebugToolConfig[] = [
      { toolset: 'busybox', mountPath: '/debug-tools/common' },
      { toolset: 'netshoot', mountPath: '/debug-tools/common' },
    ]
    expect(validateUniquePaths(tools)).toBe(false)
  })

  it('should return true for empty array', () => {
    expect(validateUniquePaths([])).toBe(true)
  })

  it('should return false for non-array input', () => {
    expect(validateUniquePaths(null as any)).toBe(false)
    expect(validateUniquePaths(undefined as any)).toBe(false)
  })
})

describe('validateDebugConfig', () => {
  it('should accept valid configuration', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
        { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' },
      ]
    }
    const result = validateDebugConfig(config)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should accept disabled configuration', () => {
    const config: MultiDebugConfig = {
      enabled: false,
      tools: []
    }
    const result = validateDebugConfig(config)
    expect(result.valid).toBe(true)
  })

  it('should accept null configuration', () => {
    const result = validateDebugConfig(null)
    expect(result.valid).toBe(true)
  })

  it('should reject configuration with invalid mount path', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { toolset: 'busybox', mountPath: 'invalid/path' },
      ]
    }
    const result = validateDebugConfig(config)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should reject configuration with duplicate paths', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { toolset: 'busybox', mountPath: '/debug-tools/common' },
        { toolset: 'netshoot', mountPath: '/debug-tools/common' },
      ]
    }
    const result = validateDebugConfig(config)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('挂载路径不能重复')
  })

  it('should reject custom tool without image', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { toolset: 'custom', mountPath: '/debug-tools/custom' },
      ]
    }
    const result = validateDebugConfig(config)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('自定义镜像必须指定镜像地址')
  })

  it('should reject custom tool with invalid image', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { toolset: 'custom', mountPath: '/debug-tools/custom', customImage: 'INVALID IMAGE' },
      ]
    }
    const result = validateDebugConfig(config)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should accept custom tool with valid image', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { toolset: 'custom', mountPath: '/debug-tools/custom', customImage: 'myregistry.com/tools:latest' },
      ]
    }
    const result = validateDebugConfig(config)
    expect(result.valid).toBe(true)
  })

  it('should reject enabled configuration with no tools', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: []
    }
    const result = validateDebugConfig(config)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('至少需要选择一个调试工具')
  })
})

describe('isLegacyConfig', () => {
  it('should detect legacy configuration', () => {
    const legacy: LegacyDebugConfig = {
      enabled: true,
      toolset: 'busybox',
      mountPath: '/debug-tools/busybox'
    }
    expect(isLegacyConfig(legacy)).toBe(true)
  })

  it('should not detect multi-tool configuration as legacy', () => {
    const multi: MultiDebugConfig = {
      enabled: true,
      tools: [{ toolset: 'busybox', mountPath: '/debug-tools/busybox' }]
    }
    expect(isLegacyConfig(multi)).toBe(false)
  })

  it('should return false for null/undefined', () => {
    expect(isLegacyConfig(null)).toBe(false)
    expect(isLegacyConfig(undefined)).toBe(false)
  })
})

describe('isMultiConfig', () => {
  it('should detect multi-tool configuration', () => {
    const multi: MultiDebugConfig = {
      enabled: true,
      tools: [{ toolset: 'busybox', mountPath: '/debug-tools/busybox' }]
    }
    expect(isMultiConfig(multi)).toBe(true)
  })

  it('should not detect legacy configuration as multi-tool', () => {
    const legacy: LegacyDebugConfig = {
      enabled: true,
      toolset: 'busybox',
      mountPath: '/debug-tools/busybox'
    }
    expect(isMultiConfig(legacy)).toBe(false)
  })

  it('should return false for null/undefined', () => {
    expect(isMultiConfig(null)).toBe(false)
    expect(isMultiConfig(undefined)).toBe(false)
  })
})

describe('convertLegacyToMultiConfig', () => {
  it('should convert enabled legacy config', () => {
    const legacy: LegacyDebugConfig = {
      enabled: true,
      toolset: 'busybox',
      mountPath: '/debug-tools/busybox'
    }
    const result = convertLegacyToMultiConfig(legacy)
    expect(result.enabled).toBe(true)
    expect(result.tools).toHaveLength(1)
    expect(result.tools[0].toolset).toBe('busybox')
    expect(result.tools[0].mountPath).toBe('/debug-tools/busybox')
  })

  it('should convert disabled legacy config', () => {
    const legacy: LegacyDebugConfig = {
      enabled: false,
      toolset: 'busybox',
      mountPath: '/debug-tools/busybox'
    }
    const result = convertLegacyToMultiConfig(legacy)
    expect(result.enabled).toBe(false)
    expect(result.tools).toHaveLength(0)
  })

  it('should preserve custom image', () => {
    const legacy: LegacyDebugConfig = {
      enabled: true,
      toolset: 'custom',
      mountPath: '/debug-tools/custom',
      customImage: 'myregistry.com/tools:latest'
    }
    const result = convertLegacyToMultiConfig(legacy)
    expect(result.tools[0].customImage).toBe('myregistry.com/tools:latest')
  })
})

describe('normalizeDebugConfig', () => {
  it('should return null for null/undefined', () => {
    expect(normalizeDebugConfig(null)).toBe(null)
    expect(normalizeDebugConfig(undefined)).toBe(null)
  })

  it('should convert legacy config', () => {
    const legacy: LegacyDebugConfig = {
      enabled: true,
      toolset: 'busybox',
      mountPath: '/debug-tools/busybox'
    }
    const result = normalizeDebugConfig(legacy)
    expect(result).not.toBe(null)
    expect(result?.enabled).toBe(true)
    expect(result?.tools).toHaveLength(1)
  })

  it('should return multi-tool config as-is', () => {
    const multi: MultiDebugConfig = {
      enabled: true,
      tools: [{ toolset: 'busybox', mountPath: '/debug-tools/busybox' }]
    }
    const result = normalizeDebugConfig(multi)
    expect(result).toEqual(multi)
  })

  it('should return null for unknown format', () => {
    const unknown = { foo: 'bar' }
    const result = normalizeDebugConfig(unknown)
    expect(result).toBe(null)
  })
})

describe('generateDebugInitContainers', () => {
  it('should return empty array for null config', () => {
    const result = generateDebugInitContainers(null)
    expect(result).toEqual([])
  })

  it('should return empty array for disabled config', () => {
    const config: MultiDebugConfig = {
      enabled: false,
      tools: [{ toolset: 'busybox', mountPath: '/debug-tools/busybox' }]
    }
    const result = generateDebugInitContainers(config)
    expect(result).toEqual([])
  })

  it('should return empty array for config with no tools', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: []
    }
    const result = generateDebugInitContainers(config)
    expect(result).toEqual([])
  })

  it('should generate init container for single tool', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [{ toolset: 'busybox', mountPath: '/debug-tools/busybox' }]
    }
    const result = generateDebugInitContainers(config)
    
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('debug-tools-busybox')
    expect(result[0].image).toBe('busybox:latest')
    expect(result[0].command).toEqual(['sh', '-c'])
    expect(result[0].args).toHaveLength(1)
    expect(result[0].volumeMounts).toHaveLength(1)
    expect(result[0].volumeMounts[0].name).toBe('debug-tools-busybox')
    expect(result[0].volumeMounts[0].mountPath).toBe('/debug-tools/busybox')
  })

  it('should generate init containers for multiple tools', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
        { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' },
        { toolset: 'ubuntu', mountPath: '/debug-tools/ubuntu' }
      ]
    }
    const result = generateDebugInitContainers(config)
    
    expect(result).toHaveLength(3)
    expect(result[0].name).toBe('debug-tools-busybox')
    expect(result[1].name).toBe('debug-tools-netshoot')
    expect(result[2].name).toBe('debug-tools-ubuntu')
  })

  it('should use custom image for custom toolset', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { 
          toolset: 'custom', 
          mountPath: '/debug-tools/custom',
          customImage: 'myregistry.com/tools:v1.0'
        }
      ]
    }
    const result = generateDebugInitContainers(config)
    
    expect(result).toHaveLength(1)
    expect(result[0].image).toBe('myregistry.com/tools:v1.0')
  })

  it('should sort init containers alphabetically by toolset', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { toolset: 'ubuntu', mountPath: '/debug-tools/ubuntu' },
        { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
        { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' }
      ]
    }
    const result = generateDebugInitContainers(config)
    
    expect(result).toHaveLength(3)
    // Should be sorted: busybox, netshoot, ubuntu
    expect(result[0].name).toBe('debug-tools-busybox')
    expect(result[1].name).toBe('debug-tools-netshoot')
    expect(result[2].name).toBe('debug-tools-ubuntu')
  })

  it('should include imagePullPolicy', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [{ toolset: 'busybox', mountPath: '/debug-tools/busybox' }]
    }
    const result = generateDebugInitContainers(config)
    
    expect(result[0].imagePullPolicy).toBe('IfNotPresent')
  })
})

describe('generateDebugVolumes', () => {
  it('should return empty array for null config', () => {
    const result = generateDebugVolumes(null)
    expect(result).toEqual([])
  })

  it('should return empty array for disabled config', () => {
    const config: MultiDebugConfig = {
      enabled: false,
      tools: [{ toolset: 'busybox', mountPath: '/debug-tools/busybox' }]
    }
    const result = generateDebugVolumes(config)
    expect(result).toEqual([])
  })

  it('should return empty array for config with no tools', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: []
    }
    const result = generateDebugVolumes(config)
    expect(result).toEqual([])
  })

  it('should generate volume for single tool', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [{ toolset: 'busybox', mountPath: '/debug-tools/busybox' }]
    }
    const result = generateDebugVolumes(config)
    
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('debug-tools-busybox')
    expect(result[0].emptyDir).toEqual({})
  })

  it('should generate volumes for multiple tools', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
        { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' },
        { toolset: 'ubuntu', mountPath: '/debug-tools/ubuntu' }
      ]
    }
    const result = generateDebugVolumes(config)
    
    expect(result).toHaveLength(3)
    expect(result[0].name).toBe('debug-tools-busybox')
    expect(result[1].name).toBe('debug-tools-netshoot')
    expect(result[2].name).toBe('debug-tools-ubuntu')
  })

  it('should sort volumes alphabetically by toolset', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { toolset: 'ubuntu', mountPath: '/debug-tools/ubuntu' },
        { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
        { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' }
      ]
    }
    const result = generateDebugVolumes(config)
    
    expect(result).toHaveLength(3)
    // Should be sorted: busybox, netshoot, ubuntu
    expect(result[0].name).toBe('debug-tools-busybox')
    expect(result[1].name).toBe('debug-tools-netshoot')
    expect(result[2].name).toBe('debug-tools-ubuntu')
  })

  it('should generate volume for custom toolset', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { 
          toolset: 'custom', 
          mountPath: '/debug-tools/custom',
          customImage: 'myregistry.com/tools:v1.0'
        }
      ]
    }
    const result = generateDebugVolumes(config)
    
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('debug-tools-custom')
  })
})

describe('generateUsageInstructions', () => {
  it('should return empty string for null config', () => {
    const result = generateUsageInstructions(null)
    expect(result).toBe('')
  })

  it('should return empty string for disabled config', () => {
    const config: MultiDebugConfig = {
      enabled: false,
      tools: [{ toolset: 'busybox', mountPath: '/debug-tools/busybox' }]
    }
    const result = generateUsageInstructions(config)
    expect(result).toBe('')
  })

  it('should return empty string for config with no tools', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: []
    }
    const result = generateUsageInstructions(config)
    expect(result).toBe('')
  })

  it('should generate instructions for single tool', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [{ toolset: 'busybox', mountPath: '/debug-tools/busybox' }]
    }
    const result = generateUsageInstructions(config)
    
    expect(result).toContain('调试工具使用说明')
    expect(result).toContain('BUSYBOX')
    expect(result).toContain('/debug-tools/busybox')
    expect(result).toContain('export PATH=/debug-tools/busybox:$PATH')
  })

  it('should generate instructions for multiple tools', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
        { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' }
      ]
    }
    const result = generateUsageInstructions(config)
    
    expect(result).toContain('调试工具使用说明')
    expect(result).toContain('BUSYBOX')
    expect(result).toContain('NETSHOOT')
    expect(result).toContain('/debug-tools/busybox')
    expect(result).toContain('/debug-tools/netshoot')
    expect(result).toContain('export PATH=/debug-tools/busybox:/debug-tools/netshoot:$PATH')
  })

  it('should include all mount paths in instructions', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
        { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' },
        { toolset: 'ubuntu', mountPath: '/debug-tools/ubuntu' }
      ]
    }
    const result = generateUsageInstructions(config)
    
    // All mount paths should be present
    expect(result).toContain('/debug-tools/busybox')
    expect(result).toContain('/debug-tools/netshoot')
    expect(result).toContain('/debug-tools/ubuntu')
  })

  it('should handle custom toolset', () => {
    const config: MultiDebugConfig = {
      enabled: true,
      tools: [
        { 
          toolset: 'custom', 
          mountPath: '/debug-tools/custom',
          customImage: 'myregistry.com/tools:v1.0'
        }
      ]
    }
    const result = generateUsageInstructions(config)
    
    expect(result).toContain('自定义工具')
    expect(result).toContain('myregistry.com/tools:v1.0')
    expect(result).toContain('/debug-tools/custom')
  })
})
