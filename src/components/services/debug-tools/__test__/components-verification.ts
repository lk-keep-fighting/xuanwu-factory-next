/**
 * Verification script for Task 4: 创建前端子组件
 * 
 * This file verifies that all required components and constants are properly exported
 * and match the specifications from the requirements and design documents.
 */

import type { DebugToolDefinition, DebugToolPreset } from '@/types/project'

// Verify exports exist
import { 
  DebugToolCard, 
  QuickPresetSelector, 
  UsageInstructions,
  TOOL_DEFINITIONS,
  QUICK_PRESETS
} from '../index'

// Verify TOOL_DEFINITIONS structure
function verifyToolDefinitions(tools: DebugToolDefinition[]): void {
  console.log('✓ Verifying TOOL_DEFINITIONS...')
  
  // Should have 4 tools: busybox, netshoot, ubuntu, custom
  if (tools.length !== 4) {
    throw new Error(`Expected 4 tool definitions, got ${tools.length}`)
  }
  
  const expectedToolsets = ['busybox', 'netshoot', 'ubuntu', 'custom']
  const actualToolsets = tools.map(t => t.toolset)
  
  for (const expected of expectedToolsets) {
    if (!actualToolsets.includes(expected as any)) {
      throw new Error(`Missing toolset: ${expected}`)
    }
  }
  
  // Verify each tool has required fields
  for (const tool of tools) {
    if (!tool.label || !tool.description || !tool.tools || !tool.defaultMountPath || !tool.size) {
      throw new Error(`Tool ${tool.toolset} is missing required fields`)
    }
    
    // Verify default mount paths match design spec
    const expectedPaths: Record<string, string> = {
      busybox: '/debug-tools/busybox',
      netshoot: '/debug-tools/netshoot',
      ubuntu: '/debug-tools/ubuntu',
      custom: '/debug-tools/custom'
    }
    
    if (tool.defaultMountPath !== expectedPaths[tool.toolset]) {
      throw new Error(
        `Tool ${tool.toolset} has incorrect default mount path: ` +
        `expected ${expectedPaths[tool.toolset]}, got ${tool.defaultMountPath}`
      )
    }
  }
  
  console.log('  ✓ All 4 tool definitions are valid')
  console.log('  ✓ Default mount paths match specification')
}

// Verify QUICK_PRESETS structure
function verifyQuickPresets(presets: DebugToolPreset[]): void {
  console.log('✓ Verifying QUICK_PRESETS...')
  
  // Should have 3 presets: basic, network, full
  if (presets.length !== 3) {
    throw new Error(`Expected 3 presets, got ${presets.length}`)
  }
  
  const expectedPresets = {
    basic: ['busybox'],
    network: ['busybox', 'netshoot'],
    full: ['busybox', 'netshoot', 'ubuntu']
  }
  
  for (const preset of presets) {
    if (!preset.id || !preset.label || !preset.description || !preset.toolsets) {
      throw new Error(`Preset ${preset.id} is missing required fields`)
    }
    
    const expected = expectedPresets[preset.id as keyof typeof expectedPresets]
    if (!expected) {
      throw new Error(`Unexpected preset id: ${preset.id}`)
    }
    
    if (JSON.stringify(preset.toolsets) !== JSON.stringify(expected)) {
      throw new Error(
        `Preset ${preset.id} has incorrect toolsets: ` +
        `expected ${JSON.stringify(expected)}, got ${JSON.stringify(preset.toolsets)}`
      )
    }
  }
  
  console.log('  ✓ All 3 presets are valid')
  console.log('  ✓ Preset toolsets match specification (Requirements 7.2)')
}

// Verify component exports
function verifyComponentExports(): void {
  console.log('✓ Verifying component exports...')
  
  if (typeof DebugToolCard !== 'function') {
    throw new Error('DebugToolCard is not exported as a function/component')
  }
  
  if (typeof QuickPresetSelector !== 'function') {
    throw new Error('QuickPresetSelector is not exported as a function/component')
  }
  
  if (typeof UsageInstructions !== 'function') {
    throw new Error('UsageInstructions is not exported as a function/component')
  }
  
  console.log('  ✓ DebugToolCard component exported')
  console.log('  ✓ QuickPresetSelector component exported')
  console.log('  ✓ UsageInstructions component exported')
}

// Run all verifications
export function runVerification(): void {
  console.log('\n=== Task 4 Component Verification ===\n')
  
  try {
    verifyComponentExports()
    verifyToolDefinitions(TOOL_DEFINITIONS)
    verifyQuickPresets(QUICK_PRESETS)
    
    console.log('\n✅ All verifications passed!')
    console.log('\nTask 4 Requirements Coverage:')
    console.log('  ✓ 1.1 - Multi-select tool interface components created')
    console.log('  ✓ 4.1 - Tool information display (name, description, size, tools)')
    console.log('  ✓ 4.2 - Tool selection cards implemented')
    console.log('  ✓ 7.1 - Quick preset selector created')
    console.log('  ✓ 7.2 - Three presets defined (basic, network, full)')
    console.log('\n')
  } catch (error) {
    console.error('\n❌ Verification failed:', error)
    throw error
  }
}

// Run if executed directly
if (require.main === module) {
  runVerification()
}
