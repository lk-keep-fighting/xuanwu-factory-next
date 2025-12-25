'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

/**
 * Loading fallback component for lazy-loaded tabs
 */
function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <p className="text-sm text-gray-500">加载中...</p>
      </div>
    </div>
  )
}

/**
 * Lazy-loaded tab components with code splitting
 * 
 * These components are loaded on-demand when their respective tabs are activated,
 * reducing the initial bundle size and improving page load performance.
 */

export const LazyOverviewTab = dynamic(
  () => import('./OverviewTab').then(mod => ({ default: mod.OverviewTab })),
  {
    loading: () => <TabLoadingFallback />,
    ssr: false
  }
)

export const LazyConfigurationTab = dynamic(
  () => import('./ConfigurationTab').then(mod => ({ default: mod.ConfigurationTab })),
  {
    loading: () => <TabLoadingFallback />,
    ssr: false
  }
)

export const LazyDeploymentsTab = dynamic(
  () => import('./DeploymentsTab').then(mod => ({ default: mod.DeploymentsTab })),
  {
    loading: () => <TabLoadingFallback />,
    ssr: false
  }
)

export const LazyEnvironmentTab = dynamic(
  () => import('./EnvironmentTab').then(mod => ({ default: mod.EnvironmentTab })),
  {
    loading: () => <TabLoadingFallback />,
    ssr: false
  }
)

export const LazyVolumesTab = dynamic(
  () => import('./VolumesTab').then(mod => ({ default: mod.VolumesTab })),
  {
    loading: () => <TabLoadingFallback />,
    ssr: false
  }
)

export const LazyNetworkTab = dynamic(
  () => import('./NetworkTab').then(mod => ({ default: mod.NetworkTab })),
  {
    loading: () => <TabLoadingFallback />,
    ssr: false
  }
)

export const LazyDebugToolsTab = dynamic(
  () => import('./DebugToolsTab').then(mod => ({ default: mod.DebugToolsTab })),
  {
    loading: () => <TabLoadingFallback />,
    ssr: false
  }
)

export const LazyDiagnosticsTab = dynamic(
  () => import('./DiagnosticsTab').then(mod => ({ default: mod.DiagnosticsTab })),
  {
    loading: () => <TabLoadingFallback />,
    ssr: false
  }
)

/**
 * Re-export types for convenience
 */
export type { OverviewTabProps } from '@/types/service-tabs'
export type { ConfigurationTabProps } from '@/types/service-tabs'
export type { DeploymentsTabProps } from '@/types/service-tabs'
export type { DebugToolsTabProps } from '@/types/service-tabs'
export type { DiagnosticsTabProps } from '@/types/service-tabs'
export type { VolumesTabProps } from '@/types/service-tabs'
export type { EnvironmentTabProps } from './EnvironmentTab'
export type { NetworkTabProps } from './NetworkTab'
