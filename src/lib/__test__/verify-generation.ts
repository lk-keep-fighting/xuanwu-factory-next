/**
 * Manual verification script for Kubernetes generation functions
 * Run with: npx tsx src/lib/__test__/verify-generation.ts
 */

import {
  generateDebugInitContainers,
  generateDebugVolumes,
  generateUsageInstructions,
} from '../debug-tools-utils'
import type { MultiDebugConfig } from '@/types/project'

console.log('='.repeat(80))
console.log('Kubernetes Configuration Generation Verification')
console.log('='.repeat(80))

// Test 1: Single tool configuration
console.log('\n📦 Test 1: Single Tool (BusyBox)')
console.log('-'.repeat(80))
const singleToolConfig: MultiDebugConfig = {
  enabled: true,
  tools: [
    { toolset: 'busybox', mountPath: '/debug-tools/busybox' }
  ]
}

const initContainers1 = generateDebugInitContainers(singleToolConfig)
const volumes1 = generateDebugVolumes(singleToolConfig)
const instructions1 = generateUsageInstructions(singleToolConfig)

console.log('\nInit Containers:', JSON.stringify(initContainers1, null, 2))
console.log('\nVolumes:', JSON.stringify(volumes1, null, 2))
console.log('\nUsage Instructions:\n', instructions1)

// Test 2: Multiple tools configuration
console.log('\n\n📦 Test 2: Multiple Tools (BusyBox + Netshoot + Ubuntu)')
console.log('-'.repeat(80))
const multiToolConfig: MultiDebugConfig = {
  enabled: true,
  tools: [
    { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
    { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' },
    { toolset: 'ubuntu', mountPath: '/debug-tools/ubuntu' }
  ]
}

const initContainers2 = generateDebugInitContainers(multiToolConfig)
const volumes2 = generateDebugVolumes(multiToolConfig)
const instructions2 = generateUsageInstructions(multiToolConfig)

console.log('\nInit Containers:', JSON.stringify(initContainers2, null, 2))
console.log('\nVolumes:', JSON.stringify(volumes2, null, 2))
console.log('\nUsage Instructions:\n', instructions2)

// Test 3: Custom image configuration
console.log('\n\n📦 Test 3: Custom Image')
console.log('-'.repeat(80))
const customConfig: MultiDebugConfig = {
  enabled: true,
  tools: [
    { 
      toolset: 'custom', 
      mountPath: '/debug-tools/custom',
      customImage: 'myregistry.com/debug-tools:v1.0'
    }
  ]
}

const initContainers3 = generateDebugInitContainers(customConfig)
const volumes3 = generateDebugVolumes(customConfig)
const instructions3 = generateUsageInstructions(customConfig)

console.log('\nInit Containers:', JSON.stringify(initContainers3, null, 2))
console.log('\nVolumes:', JSON.stringify(volumes3, null, 2))
console.log('\nUsage Instructions:\n', instructions3)

// Test 4: Verify ordering stability
console.log('\n\n📦 Test 4: Ordering Stability (Unsorted Input)')
console.log('-'.repeat(80))
const unsortedConfig: MultiDebugConfig = {
  enabled: true,
  tools: [
    { toolset: 'ubuntu', mountPath: '/debug-tools/ubuntu' },
    { toolset: 'busybox', mountPath: '/debug-tools/busybox' },
    { toolset: 'netshoot', mountPath: '/debug-tools/netshoot' }
  ]
}

const initContainers4 = generateDebugInitContainers(unsortedConfig)
const volumes4 = generateDebugVolumes(unsortedConfig)

console.log('\nInit Container Order:', initContainers4.map(c => c.name))
console.log('Volume Order:', volumes4.map(v => v.name))
console.log('\n✅ Should be alphabetically sorted: busybox, netshoot, ubuntu')

// Test 5: Disabled configuration
console.log('\n\n📦 Test 5: Disabled Configuration')
console.log('-'.repeat(80))
const disabledConfig: MultiDebugConfig = {
  enabled: false,
  tools: [
    { toolset: 'busybox', mountPath: '/debug-tools/busybox' }
  ]
}

const initContainers5 = generateDebugInitContainers(disabledConfig)
const volumes5 = generateDebugVolumes(disabledConfig)
const instructions5 = generateUsageInstructions(disabledConfig)

console.log('\nInit Containers:', initContainers5)
console.log('Volumes:', volumes5)
console.log('Instructions:', instructions5)
console.log('\n✅ Should all be empty')

console.log('\n' + '='.repeat(80))
console.log('✅ Verification Complete!')
console.log('='.repeat(80))
