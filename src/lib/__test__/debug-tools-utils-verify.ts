/**
 * Manual verification script for debug-tools-utils
 * This can be run with: npx tsx src/lib/__test__/debug-tools-utils-verify.ts
 */

import {
  validateDockerImage,
  validateMountPath,
  validateUniquePaths,
  validateDebugConfig,
  isLegacyConfig,
  isMultiConfig,
  convertLegacyToMultiConfig,
  normalizeDebugConfig,
} from '../debug-tools-utils'
import type { MultiDebugConfig, LegacyDebugConfig } from '@/types/project'

console.log('=== Testing validateDockerImage ===')
console.log('busybox:', validateDockerImage('busybox')) // should be true
console.log('nginx:latest:', validateDockerImage('nginx:latest')) // should be true
console.log('registry.com/image:tag:', validateDockerImage('registry.com/image:tag')) // should be true
console.log('INVALID:', validateDockerImage('INVALID IMAGE')) // should be false
console.log('')

console.log('=== Testing validateMountPath ===')
console.log('/debug-tools:', validateMountPath('/debug-tools')) // should be true
console.log('/debug-tools/busybox:', validateMountPath('/debug-tools/busybox')) // should be true
console.log('relative/path:', validateMountPath('relative/path')) // should be false
console.log('/:', validateMountPath('/')) // should be false
console.log('')

console.log('=== Testing validateUniquePaths ===')
const uniqueTools = [
  { toolset: 'busybox' as const, mountPath: '/debug-tools/busybox' },
  { toolset: 'netshoot' as const, mountPath: '/debug-tools/netshoot' },
]
const duplicateTools = [
  { toolset: 'busybox' as const, mountPath: '/debug-tools/common' },
  { toolset: 'netshoot' as const, mountPath: '/debug-tools/common' },
]
console.log('Unique paths:', validateUniquePaths(uniqueTools)) // should be true
console.log('Duplicate paths:', validateUniquePaths(duplicateTools)) // should be false
console.log('')

console.log('=== Testing validateDebugConfig ===')
const validConfig: MultiDebugConfig = {
  enabled: true,
  tools: [
    { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
    { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' },
  ]
}
const invalidConfig: MultiDebugConfig = {
  enabled: true,
  tools: [
    { toolset: 'custom', mountPath: '/debug-tools/custom' }, // missing customImage
  ]
}
console.log('Valid config:', validateDebugConfig(validConfig))
console.log('Invalid config:', validateDebugConfig(invalidConfig))
console.log('')

console.log('=== Testing isLegacyConfig ===')
const legacy: LegacyDebugConfig = {
  enabled: true,
  toolset: 'busybox',
  mountPath: '/debug-tools/busybox'
}
const multi: MultiDebugConfig = {
  enabled: true,
  tools: [{ toolset: 'busybox', mountPath: '/debug-tools/busybox' }]
}
console.log('Legacy config:', isLegacyConfig(legacy)) // should be true
console.log('Multi config:', isLegacyConfig(multi)) // should be false
console.log('')

console.log('=== Testing convertLegacyToMultiConfig ===')
const converted = convertLegacyToMultiConfig(legacy)
console.log('Converted:', JSON.stringify(converted, null, 2))
console.log('')

console.log('=== Testing normalizeDebugConfig ===')
console.log('Normalize legacy:', JSON.stringify(normalizeDebugConfig(legacy), null, 2))
console.log('Normalize multi:', JSON.stringify(normalizeDebugConfig(multi), null, 2))
console.log('Normalize null:', normalizeDebugConfig(null))
console.log('Normalize unknown:', normalizeDebugConfig({ foo: 'bar' }))
console.log('')

console.log('✅ All manual verifications complete!')
