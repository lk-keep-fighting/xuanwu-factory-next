/**
 * Utility functions for service detail page tab management
 */

import { TAB_VALUES, LEGACY_TAB_VALUES, type TabValue, type AnyTabValue } from '@/types/service-tabs'

/**
 * Map legacy tab values to new tab values for migration
 */
const LEGACY_TAB_MIGRATION_MAP: Record<string, TabValue> = {
  [LEGACY_TAB_VALUES.STATUS]: TAB_VALUES.OVERVIEW,
  [LEGACY_TAB_VALUES.GENERAL]: TAB_VALUES.CONFIGURATION,
  [LEGACY_TAB_VALUES.ENVIRONMENT]: TAB_VALUES.CONFIGURATION,
  [LEGACY_TAB_VALUES.VOLUMES]: TAB_VALUES.CONFIGURATION,
  [LEGACY_TAB_VALUES.NETWORK]: TAB_VALUES.CONFIGURATION
}

/**
 * Check if a tab value is a legacy tab value
 */
export function isLegacyTabValue(value: string): boolean {
  return Object.values(LEGACY_TAB_VALUES).includes(value as any)
}

/**
 * Check if a tab value is a valid new tab value
 */
export function isValidTabValue(value: string): value is TabValue {
  return Object.values(TAB_VALUES).includes(value as TabValue)
}

/**
 * Migrate a legacy tab value to the new tab structure
 * Returns the new tab value, or the default tab if migration is not possible
 */
export function migrateLegacyTab(legacyValue: string): TabValue {
  if (isValidTabValue(legacyValue)) {
    return legacyValue
  }

  const migrated = LEGACY_TAB_MIGRATION_MAP[legacyValue]
  if (migrated) {
    return migrated
  }

  // Default to overview tab if no migration found
  return TAB_VALUES.OVERVIEW
}

/**
 * Get the default tab value
 */
export function getDefaultTab(): TabValue {
  return TAB_VALUES.OVERVIEW
}

/**
 * Normalize any tab value (legacy or new) to a valid new tab value
 */
export function normalizeTabValue(value: string | undefined | null): TabValue {
  if (!value) {
    return getDefaultTab()
  }

  const trimmed = value.trim()
  
  if (!trimmed) {
    return getDefaultTab()
  }

  if (isValidTabValue(trimmed)) {
    return trimmed
  }

  if (isLegacyTabValue(trimmed)) {
    return migrateLegacyTab(trimmed)
  }

  return getDefaultTab()
}

/**
 * Get tab value from URL search params
 */
export function getTabFromURL(searchParams: URLSearchParams): TabValue {
  const tabParam = searchParams.get('tab')
  return normalizeTabValue(tabParam)
}

/**
 * Update URL with new tab value
 */
export function updateURLWithTab(tab: TabValue, router: any, pathname: string) {
  const params = new URLSearchParams(window.location.search)
  params.set('tab', tab)
  router.replace(`${pathname}?${params.toString()}`, { scroll: false })
}

/**
 * Get all valid tab values
 */
export function getAllTabValues(): TabValue[] {
  return Object.values(TAB_VALUES)
}

/**
 * Get tab label for display
 */
export function getTabLabel(tab: TabValue): string {
  const labels: Record<TabValue, string> = {
    [TAB_VALUES.OVERVIEW]: '概览',
    [TAB_VALUES.CONFIGURATION]: '配置',
    [TAB_VALUES.DEPLOYMENTS]: '部署',
    [TAB_VALUES.LOGS]: '日志',
    [TAB_VALUES.FILES]: '文件',
    [TAB_VALUES.YAML]: 'YAML'
  }
  
  return labels[tab] || tab
}
