/**
 * Validation script for service tab configuration
 * 
 * This script validates that the tab visibility logic works correctly
 * for all service types according to the requirements.
 */

import { ServiceType, type Service } from '@/types/project'
import { 
  getVisibleTabs, 
  getVisibleTabValues, 
  isTabVisible,
  validateCommonTabsForAllTypes,
  TAB_CONFIGS 
} from '../service-tab-config'
import { TAB_VALUES } from '@/types/service-tabs'

/**
 * Create a mock service for testing
 */
function createMockService(type: ServiceType): Service {
  return {
    id: 'test-id',
    name: 'test-service',
    type,
    status: 'pending',
    project_id: 'test-project',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as Service
}

/**
 * Validate that all service types show exactly 6 common tabs
 */
function validateCommonTabs(): boolean {
  console.log('Validating common tabs for all service types...')
  
  const serviceTypes = [ServiceType.APPLICATION, ServiceType.DATABASE, ServiceType.IMAGE]
  const expectedTabs = [
    TAB_VALUES.OVERVIEW,
    TAB_VALUES.CONFIGURATION,
    TAB_VALUES.DEPLOYMENTS,
    TAB_VALUES.LOGS,
    TAB_VALUES.FILES,
    TAB_VALUES.YAML
  ]
  
  let allValid = true
  
  for (const serviceType of serviceTypes) {
    const service = createMockService(serviceType)
    const visibleTabs = getVisibleTabValues(service)
    
    console.log(`\n${serviceType} service:`)
    console.log(`  Visible tabs: ${visibleTabs.join(', ')}`)
    console.log(`  Tab count: ${visibleTabs.length}`)
    
    // Check that we have exactly 6 tabs
    if (visibleTabs.length !== 6) {
      console.error(`  ❌ ERROR: Expected 6 tabs, got ${visibleTabs.length}`)
      allValid = false
      continue
    }
    
    // Check that all expected tabs are present
    const missingTabs = expectedTabs.filter(tab => !visibleTabs.includes(tab))
    if (missingTabs.length > 0) {
      console.error(`  ❌ ERROR: Missing tabs: ${missingTabs.join(', ')}`)
      allValid = false
      continue
    }
    
    // Check that no unexpected tabs are present
    const unexpectedTabs = visibleTabs.filter(tab => !expectedTabs.includes(tab))
    if (unexpectedTabs.length > 0) {
      console.error(`  ❌ ERROR: Unexpected tabs: ${unexpectedTabs.join(', ')}`)
      allValid = false
      continue
    }
    
    console.log('  ✅ All tabs correct')
  }
  
  return allValid
}

/**
 * Validate that tab visibility function works correctly
 */
function validateTabVisibility(): boolean {
  console.log('\n\nValidating tab visibility function...')
  
  const serviceTypes = [ServiceType.APPLICATION, ServiceType.DATABASE, ServiceType.IMAGE]
  let allValid = true
  
  for (const serviceType of serviceTypes) {
    const service = createMockService(serviceType)
    
    console.log(`\n${serviceType} service:`)
    
    // All tabs should be visible for all service types
    for (const tabConfig of TAB_CONFIGS) {
      const visible = isTabVisible(tabConfig.value, service)
      
      if (!visible) {
        console.error(`  ❌ ERROR: Tab ${tabConfig.value} should be visible but isn't`)
        allValid = false
      } else {
        console.log(`  ✅ Tab ${tabConfig.value} is visible`)
      }
    }
  }
  
  return allValid
}

/**
 * Validate tab configuration structure
 */
function validateTabConfiguration(): boolean {
  console.log('\n\nValidating tab configuration structure...')
  
  let allValid = true
  
  // Check that we have exactly 6 tab configurations
  if (TAB_CONFIGS.length !== 6) {
    console.error(`❌ ERROR: Expected 6 tab configurations, got ${TAB_CONFIGS.length}`)
    allValid = false
  } else {
    console.log('✅ Tab configuration count is correct (6 tabs)')
  }
  
  // Check that each tab has required properties
  for (const tabConfig of TAB_CONFIGS) {
    console.log(`\nValidating tab: ${tabConfig.value}`)
    
    if (!tabConfig.label) {
      console.error(`  ❌ ERROR: Tab ${tabConfig.value} missing label`)
      allValid = false
    } else {
      console.log(`  ✅ Label: ${tabConfig.label}`)
    }
    
    if (!tabConfig.icon) {
      console.error(`  ❌ ERROR: Tab ${tabConfig.value} missing icon`)
      allValid = false
    } else {
      console.log(`  ✅ Icon: present`)
    }
    
    if (typeof tabConfig.visible !== 'function') {
      console.error(`  ❌ ERROR: Tab ${tabConfig.value} missing or invalid visible function`)
      allValid = false
    } else {
      console.log(`  ✅ Visible function: present`)
    }
  }
  
  return allValid
}

/**
 * Run all validations
 */
export function runValidation(): boolean {
  console.log('='.repeat(60))
  console.log('SERVICE TAB CONFIGURATION VALIDATION')
  console.log('='.repeat(60))
  
  const results = {
    configuration: validateTabConfiguration(),
    commonTabs: validateCommonTabs(),
    visibility: validateTabVisibility(),
    builtInValidation: validateCommonTabsForAllTypes()
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('VALIDATION RESULTS')
  console.log('='.repeat(60))
  console.log(`Tab Configuration: ${results.configuration ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Common Tabs: ${results.commonTabs ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Tab Visibility: ${results.visibility ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Built-in Validation: ${results.builtInValidation ? '✅ PASS' : '❌ FAIL'}`)
  
  const allPassed = Object.values(results).every(result => result)
  
  console.log('\n' + '='.repeat(60))
  console.log(`OVERALL: ${allPassed ? '✅ ALL VALIDATIONS PASSED' : '❌ SOME VALIDATIONS FAILED'}`)
  console.log('='.repeat(60))
  
  return allPassed
}

// Run validation if this file is executed directly
if (require.main === module) {
  const success = runValidation()
  process.exit(success ? 0 : 1)
}
