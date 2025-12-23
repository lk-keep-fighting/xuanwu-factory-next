/**
 * Utility functions for network port management
 */

import type { NetworkPortFormState } from '@/types/service-tabs'

/**
 * Generate a unique port ID
 */
export function generatePortId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Create an empty network port form state with configurable default port
 */
export function createEmptyPort(defaultPort: string = '8080'): NetworkPortFormState {
  return {
    id: generatePortId(),
    containerPort: defaultPort,
    servicePort: defaultPort,
    protocol: 'TCP',
    nodePort: '',
    enableDomain: false,
    domainPrefix: ''
  }
}

/**
 * Normalize port number from various input types
 */
export function normalizePositivePortNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const parsed = parseInt(trimmed, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  return null
}

/**
 * Validate port number range
 */
export function isValidPortNumber(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

/**
 * Validate NodePort range (Kubernetes specific)
 */
export function isValidNodePort(port: number): boolean {
  return Number.isInteger(port) && port >= 30000 && port <= 32767
}

/**
 * Sanitize domain label input (lowercase, alphanumeric, hyphens only)
 */
export function sanitizeDomainLabelInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 63)
}

/**
 * Validate domain prefix
 */
export function isValidDomainPrefix(prefix: string): boolean {
  if (!prefix || prefix.length === 0) {
    return false
  }

  if (prefix.length > 63) {
    return false
  }

  // Must start and end with alphanumeric
  if (!/^[a-z0-9]/.test(prefix) || !/[a-z0-9]$/.test(prefix)) {
    return false
  }

  // Can only contain lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(prefix)) {
    return false
  }

  return true
}
