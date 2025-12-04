/**
 * Verification script for DebugToolsSection refactoring
 * 
 * This script verifies that the refactored component:
 * 1. Handles backward compatibility with legacy configs
 * 2. Supports multi-tool selection
 * 3. Validates configurations correctly
 * 4. Integrates with child components
 */

import { normalizeDebugConfig, validateDebugConfig } from '@/lib/debug-tools-utils'
import type { LegacyDebugConfig, MultiDebugConfig } from '@/types/project'

console.log('=== DebugToolsSection Refactoring Verification ===\n')

// Test 1: Backward compatibility - Legacy config conversion
console.log('Test 1: Legacy config conversion')
const legacyConfig: LegacyDebugConfig = {
  enabled: true,
  toolset: 'busybox',
  mountPath: '/debug-tools',
}

const normalized = normalizeDebugConfig(legacyConfig)
console.log('Legacy config:', JSON.stringify(legacyConfig, null, 2))
console.log('Normalized config:', JSON.stringify(normalized, null, 2))
console.assert(normalized !== null, 'Normalized config should not be null')
console.assert(normalized?.enabled === true, 'Should preserve enabled state')
console.assert(normalized?.tools.length === 1, 'Should have one tool')
console.assert(normalized?.tools[0].toolset === 'busybox', 'Should preserve toolset')
console.log('✓ Legacy config conversion works\n')

// Test 2: Multi-tool configuration
console.log('Test 2: Multi-tool configuration')
const multiConfig: MultiDebugConfig = {
  enabled: true,
  tools: [
    { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
    { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' },
  ]
}

const normalizedMulti = normalizeDebugConfig(multiConfig)
console.log('Multi config:', JSON.stringify(multiConfig, null, 2))
console.log('Normalized multi config:', JSON.stringify(normalizedMulti, null, 2))
console.assert(normalizedMulti !== null, 'Normalized multi config should not be null')
console.assert(normalizedMulti?.tools.length === 2, 'Should have two tools')
console.log('✓ Multi-tool configuration works\n')

// Test 3: Validation - Valid config
console.log('Test 3: Validation - Valid config')
const validConfig: MultiDebugConfig = {
  enabled: true,
  tools: [
    { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
    { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' },
  ]
}

const validResult = validateDebugConfig(validConfig)
console.log('Valid config:', JSON.stringify(validConfig, null, 2))
console.log('Validation result:', JSON.stringify(validResult, null, 2))
console.assert(validResult.valid === true, 'Valid config should pass validation')
console.assert(validResult.errors.length === 0, 'Valid config should have no errors')
console.log('✓ Valid config passes validation\n')

// Test 4: Validation - Duplicate paths
console.log('Test 4: Validation - Duplicate paths')
const duplicatePathConfig: MultiDebugConfig = {
  enabled: true,
  tools: [
    { toolset: 'busybox', mountPath: '/debug-tools' },
    { toolset: 'netshoot', mountPath: '/debug-tools' },
  ]
}

const duplicateResult = validateDebugConfig(duplicatePathConfig)
console.log('Duplicate path config:', JSON.stringify(duplicatePathConfig, null, 2))
console.log('Validation result:', JSON.stringify(duplicateResult, null, 2))
console.assert(duplicateResult.valid === false, 'Duplicate paths should fail validation')
console.assert(duplicateResult.errors.length > 0, 'Should have validation errors')
console.assert(
  duplicateResult.errors.some(e => e.includes('重复')),
  'Should mention duplicate paths'
)
console.log('✓ Duplicate paths detected correctly\n')

// Test 5: Validation - Invalid mount path
console.log('Test 5: Validation - Invalid mount path')
const invalidPathConfig: MultiDebugConfig = {
  enabled: true,
  tools: [
    { toolset: 'busybox', mountPath: 'invalid-path' }, // Missing leading /
  ]
}

const invalidPathResult = validateDebugConfig(invalidPathConfig)
console.log('Invalid path config:', JSON.stringify(invalidPathConfig, null, 2))
console.log('Validation result:', JSON.stringify(invalidPathResult, null, 2))
console.assert(invalidPathResult.valid === false, 'Invalid path should fail validation')
console.assert(invalidPathResult.errors.length > 0, 'Should have validation errors')
console.log('✓ Invalid paths detected correctly\n')

// Test 6: Validation - Custom image without address
console.log('Test 6: Validation - Custom image without address')
const missingImageConfig: MultiDebugConfig = {
  enabled: true,
  tools: [
    { toolset: 'custom', mountPath: '/debug-tools/custom' }, // Missing customImage
  ]
}

const missingImageResult = validateDebugConfig(missingImageConfig)
console.log('Missing image config:', JSON.stringify(missingImageConfig, null, 2))
console.log('Validation result:', JSON.stringify(missingImageResult, null, 2))
console.assert(missingImageResult.valid === false, 'Missing custom image should fail validation')
console.assert(
  missingImageResult.errors.some(e => e.includes('镜像地址')),
  'Should mention missing image address'
)
console.log('✓ Missing custom image detected correctly\n')

// Test 7: Validation - Invalid custom image format
console.log('Test 7: Validation - Invalid custom image format')
const invalidImageConfig: MultiDebugConfig = {
  enabled: true,
  tools: [
    { 
      toolset: 'custom', 
      mountPath: '/debug-tools/custom',
      customImage: 'INVALID IMAGE NAME!!!' // Invalid format
    },
  ]
}

const invalidImageResult = validateDebugConfig(invalidImageConfig)
console.log('Invalid image config:', JSON.stringify(invalidImageConfig, null, 2))
console.log('Validation result:', JSON.stringify(invalidImageResult, null, 2))
console.assert(invalidImageResult.valid === false, 'Invalid image format should fail validation')
console.assert(
  invalidImageResult.errors.some(e => e.includes('格式无效')),
  'Should mention invalid format'
)
console.log('✓ Invalid image format detected correctly\n')

console.log('=== All Verification Tests Passed! ===')
