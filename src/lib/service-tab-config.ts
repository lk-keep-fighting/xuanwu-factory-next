/**
 * Tab configuration and visibility logic for service detail page
 * 
 * This module defines which tabs are visible for each service type
 * and provides utilities for filtering tabs based on service properties.
 */

import { 
  Activity, 
  Settings, 
  Rocket, 
  Terminal, 
  Folder, 
  FileCode 
} from 'lucide-react'
import { TAB_VALUES, type TabValue, type TabConfig } from '@/types/service-tabs'
import { ServiceType, type Service } from '@/types/project'

/**
 * Complete tab configuration with visibility rules
 * 
 * All service types (Application, Database, Image) show the same 6 common tabs:
 * - Overview: Service status, resource metrics, recent events, and deployment status
 * - Configuration: General settings, environment variables, volumes, network, and resources
 * - Deployments: Deployment history, build history (for Application), and image management
 * - Logs: Real-time log viewing with refresh controls
 * - Files: File browser and manager with upload/download capabilities
 * - YAML: Kubernetes YAML configuration viewer
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export const TAB_CONFIGS: TabConfig[] = [
  {
    value: TAB_VALUES.OVERVIEW,
    label: '概览',
    icon: Activity,
    visible: () => true // Always visible for all service types
  },
  {
    value: TAB_VALUES.CONFIGURATION,
    label: '配置',
    icon: Settings,
    visible: () => true // Always visible for all service types
  },
  {
    value: TAB_VALUES.DEPLOYMENTS,
    label: '部署',
    icon: Rocket,
    visible: () => true // Always visible for all service types
  },
  {
    value: TAB_VALUES.LOGS,
    label: '日志',
    icon: Terminal,
    visible: () => true // Always visible for all service types
  },
  {
    value: TAB_VALUES.FILES,
    label: '文件',
    icon: Folder,
    visible: () => true // Always visible for all service types
  },
  {
    value: TAB_VALUES.YAML,
    label: 'YAML',
    icon: FileCode,
    visible: () => true // Always visible for all service types
  }
]

/**
 * Get visible tabs for a service
 * 
 * Filters the tab configuration based on service type and returns
 * only the tabs that should be visible.
 * 
 * @param service - The service to get visible tabs for
 * @returns Array of tab configurations that should be visible
 */
export function getVisibleTabs(service: Service | null): TabConfig[] {
  if (!service) {
    // If no service, return all tabs (defensive)
    return TAB_CONFIGS
  }

  return TAB_CONFIGS.filter(tab => tab.visible(service))
}

/**
 * Check if a tab should be visible for a service
 * 
 * @param tabValue - The tab value to check
 * @param service - The service to check against
 * @returns true if the tab should be visible
 */
export function isTabVisible(tabValue: TabValue, service: Service | null): boolean {
  if (!service) {
    return true // Defensive: show all tabs if no service
  }

  const tabConfig = TAB_CONFIGS.find(tab => tab.value === tabValue)
  if (!tabConfig) {
    return false // Unknown tab
  }

  return tabConfig.visible(service)
}

/**
 * Get all tab values that should be visible for a service
 * 
 * @param service - The service to get visible tab values for
 * @returns Array of tab values that should be visible
 */
export function getVisibleTabValues(service: Service | null): TabValue[] {
  return getVisibleTabs(service).map(tab => tab.value)
}

/**
 * Validate that all service types show the 6 common tabs
 * This is a utility function for testing/validation
 * 
 * @returns true if all service types show exactly 6 tabs
 */
export function validateCommonTabsForAllTypes(): boolean {
  const serviceTypes = [ServiceType.APPLICATION, ServiceType.DATABASE, ServiceType.IMAGE]
  const expectedTabCount = 6
  
  for (const serviceType of serviceTypes) {
    const mockService: Service = {
      id: 'test',
      name: 'test',
      type: serviceType,
      status: 'pending',
      project_id: 'test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as Service
    
    const visibleTabs = getVisibleTabs(mockService)
    
    if (visibleTabs.length !== expectedTabCount) {
      console.error(
        `Service type ${serviceType} has ${visibleTabs.length} tabs, expected ${expectedTabCount}`
      )
      return false
    }
  }
  
  return true
}

/**
 * Get tab configuration by value
 * 
 * @param tabValue - The tab value to get configuration for
 * @returns The tab configuration or undefined if not found
 */
export function getTabConfig(tabValue: TabValue): TabConfig | undefined {
  return TAB_CONFIGS.find(tab => tab.value === tabValue)
}

/**
 * Get tab label by value
 * 
 * @param tabValue - The tab value to get label for
 * @returns The tab label or the tab value if not found
 */
export function getTabLabel(tabValue: TabValue): string {
  const config = getTabConfig(tabValue)
  return config?.label || tabValue
}

/**
 * Get tab icon component by value
 * 
 * @param tabValue - The tab value to get icon for
 * @returns The icon component or undefined if not found
 */
export function getTabIcon(tabValue: TabValue): React.ComponentType<{ className?: string }> | undefined {
  const config = getTabConfig(tabValue)
  return config?.icon
}
