/**
 * Utility functions for resource limits and requests parsing/formatting
 */

/**
 * Parse resource value string into value and unit
 */
export function parseResourceValue(
  value: string | undefined,
  type: 'cpu' | 'memory'
): { value: string; unit: 'm' | 'core' | 'Mi' | 'Gi' } {
  if (!value) {
    return { 
      value: '', 
      unit: type === 'cpu' ? 'core' : 'Gi' 
    }
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return { 
      value: '', 
      unit: type === 'cpu' ? 'core' : 'Gi' 
    }
  }

  if (type === 'cpu') {
    // CPU: supports "1000m" or "1" format
    if (trimmed.endsWith('m')) {
      return { value: trimmed.slice(0, -1), unit: 'm' as const }
    }
    return { value: trimmed, unit: 'core' as const }
  }

  // Memory: supports "512Mi" or "1Gi" format
  if (trimmed.endsWith('Gi')) {
    return { value: trimmed.slice(0, -2), unit: 'Gi' as const }
  }

  if (trimmed.endsWith('Mi')) {
    return { value: trimmed.slice(0, -2), unit: 'Mi' as const }
  }

  // Default to Gi for memory
  return { value: trimmed, unit: 'Gi' as const }
}

/**
 * Combine resource value and unit into a string
 */
export function combineResourceValue(value: string, unit: string): string {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''
  
  if (unit === 'core') {
    return trimmedValue
  }
  
  return `${trimmedValue}${unit}`
}

/**
 * Validate resource value
 */
export function validateResourceValue(value: string): boolean {
  if (!value || !value.trim()) {
    return true // Empty is valid (means no limit)
  }

  const trimmed = value.trim()
  const num = parseFloat(trimmed)
  
  return !isNaN(num) && num > 0
}

/**
 * Format resource value for display
 */
export function formatResourceValue(value: string | undefined, type: 'cpu' | 'memory'): string {
  if (!value) return '-'
  
  const parsed = parseResourceValue(value, type)
  if (!parsed.value) return '-'
  
  return combineResourceValue(parsed.value, parsed.unit)
}
