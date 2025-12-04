/**
 * Tests for the services API route
 * Validates debug_config handling in PUT and GET endpoints
 */

import { describe, it, expect } from 'vitest'
import { normalizeDebugConfig, validateDebugConfig } from '@/lib/debug-tools-utils'
import type { MultiDebugConfig, LegacyDebugConfig } from '@/types/project'

describe('Services API - debug_config handling', () => {
  describe('Legacy config normalization', () => {
    it('should normalize legacy config to multi-tool format', () => {
      const legacyConfig: LegacyDebugConfig = {
        enabled: true,
        toolset: 'busybox',
        mountPath: '/debug-tools/busybox'
      }

      const normalized = normalizeDebugConfig(legacyConfig)

      expect(normalized).toEqual({
        enabled: true,
        tools: [
          {
            toolset: 'busybox',
            mountPath: '/debug-tools/busybox'
          }
        ]
      })
    })

    it('should handle legacy config with custom image', () => {
      const legacyConfig: LegacyDebugConfig = {
        enabled: true,
        toolset: 'custom',
        mountPath: '/debug-tools/custom',
        customImage: 'myregistry.com/debug:latest'
      }

      const normalized = normalizeDebugConfig(legacyConfig)

      expect(normalized).toEqual({
        enabled: true,
        tools: [
          {
            toolset: 'custom',
            mountPath: '/debug-tools/custom',
            customImage: 'myregistry.com/debug:latest'
          }
        ]
      })
    })

    it('should handle disabled legacy config', () => {
      const legacyConfig: LegacyDebugConfig = {
        enabled: false,
        toolset: 'busybox',
        mountPath: '/debug-tools/busybox'
      }

      const normalized = normalizeDebugConfig(legacyConfig)

      expect(normalized).toEqual({
        enabled: false,
        tools: []
      })
    })
  })

  describe('Multi-tool config validation', () => {
    it('should accept valid multi-tool config', () => {
      const config: MultiDebugConfig = {
        enabled: true,
        tools: [
          {
            toolset: 'busybox',
            mountPath: '/debug-tools/busybox'
          },
          {
            toolset: 'netshoot',
            mountPath: '/debug-tools/netshoot'
          }
        ]
      }

      const validation = validateDebugConfig(config)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should reject config with duplicate mount paths', () => {
      const config: MultiDebugConfig = {
        enabled: true,
        tools: [
          {
            toolset: 'busybox',
            mountPath: '/debug-tools/shared'
          },
          {
            toolset: 'netshoot',
            mountPath: '/debug-tools/shared'
          }
        ]
      }

      const validation = validateDebugConfig(config)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('挂载路径不能重复')
    })

    it('should reject custom tool without image', () => {
      const config: MultiDebugConfig = {
        enabled: true,
        tools: [
          {
            toolset: 'custom',
            mountPath: '/debug-tools/custom'
          }
        ]
      }

      const validation = validateDebugConfig(config)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('自定义镜像必须指定镜像地址')
    })

    it('should reject invalid mount path', () => {
      const config: MultiDebugConfig = {
        enabled: true,
        tools: [
          {
            toolset: 'busybox',
            mountPath: 'invalid-path'
          }
        ]
      }

      const validation = validateDebugConfig(config)

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })

    it('should accept null config', () => {
      const validation = validateDebugConfig(null)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should accept disabled config', () => {
      const config: MultiDebugConfig = {
        enabled: false,
        tools: []
      }

      const validation = validateDebugConfig(config)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })
  })

  describe('Config normalization edge cases', () => {
    it('should return null for null input', () => {
      const normalized = normalizeDebugConfig(null)
      expect(normalized).toBeNull()
    })

    it('should return null for undefined input', () => {
      const normalized = normalizeDebugConfig(undefined)
      expect(normalized).toBeNull()
    })

    it('should return null for invalid format', () => {
      const invalidConfig = { foo: 'bar' }
      const normalized = normalizeDebugConfig(invalidConfig)
      expect(normalized).toBeNull()
    })

    it('should pass through valid multi-tool config', () => {
      const config: MultiDebugConfig = {
        enabled: true,
        tools: [
          {
            toolset: 'busybox',
            mountPath: '/debug-tools/busybox'
          }
        ]
      }

      const normalized = normalizeDebugConfig(config)
      expect(normalized).toEqual(config)
    })
  })
})
