/**
 * Shared types and interfaces for service detail page tabs
 */

import type { Service, Deployment, Project, NetworkConfig, ServiceImageRecord } from './project'
import type { K8sServiceStatus } from './k8s'

/**
 * Tab value constants for the new tab structure
 */
export const TAB_VALUES = {
  OVERVIEW: 'overview',
  CONFIGURATION: 'configuration',
  ENVIRONMENT: 'environment',
  VOLUMES: 'volumes',
  NETWORK: 'network',
  DEBUG_TOOLS: 'debug-tools',
  DEPLOYMENTS: 'deployments',
  LOGS: 'logs',
  FILES: 'files',
  YAML: 'yaml'
} as const

/**
 * Legacy tab values for backward compatibility
 */
export const LEGACY_TAB_VALUES = {
  STATUS: 'status',
  GENERAL: 'general',
  VOLUMES: 'volumes'
} as const

export type TabValue = typeof TAB_VALUES[keyof typeof TAB_VALUES]
export type LegacyTabValue = typeof LEGACY_TAB_VALUES[keyof typeof LEGACY_TAB_VALUES]
export type AnyTabValue = TabValue | LegacyTabValue

/**
 * Network port form state for configuration
 */
export type NetworkPortFormState = {
  id: string
  containerPort: string
  servicePort: string
  protocol: 'TCP' | 'UDP'
  nodePort: string
  enableDomain: boolean
  domainPrefix: string
}

/**
 * Service network type (excluding Headless which is a flag)
 */
export type ServiceNetworkType = 'ClusterIP' | 'NodePort' | 'LoadBalancer'

/**
 * Deployment image information with resolved details
 */
export type DeploymentImageInfo = {
  id: string | null
  fullImage: string | null
  image: string
  tag?: string
  display: string
  record: ServiceImageRecord | null
}

/**
 * Pod event from Kubernetes
 */
export type PodEvent = {
  type: string
  reason: string
  message: string
  timestamp?: string
  count: number
  involvedObject: {
    kind: string
    name: string
  }
}

/**
 * Metrics data point for charts
 * Aligned with ResourceUsageChart component requirements
 */
export type MetricsDataPoint = {
  timestamp: number // Unix timestamp in milliseconds
  cpuUsed: number // in millicores
  cpuLimit?: number // in millicores
  cpuPercent?: number // percentage
  memoryUsed: number // in bytes
  memoryLimit?: number // in bytes
  memoryPercent?: number // percentage
}

/**
 * Pagination information
 */
export type PaginationInfo = {
  total: number
  totalPages: number
  page: number
  pageSize: number
  hasNext: boolean
  hasPrevious: boolean
}

/**
 * Props for Overview Tab component
 */
export interface OverviewTabProps {
  service: Service
  k8sStatus: K8sServiceStatus | null
  k8sStatusLoading: boolean
  k8sStatusError: string | null
  metricsHistory: MetricsDataPoint[]
  metricsLoading: boolean
  metricsError: string | null
  metricsTimeRange: string
  podEvents: PodEvent[]
  podEventsLoading: boolean
  podEventsError: string | null
  currentDeployment: DeploymentImageInfo | null
  ongoingDeployment: DeploymentImageInfo | null
  onRefreshStatus: () => Promise<void>
  onRefreshMetrics: (timeRange?: string) => void
  onRefreshEvents: () => Promise<void>
  onChangeTimeRange: (range: string) => void
}

/**
 * Resource limits configuration
 */
export type ResourceLimits = {
  cpu?: string
  memory?: string
}

/**
 * Resource requests configuration
 */
export type ResourceRequests = {
  cpu?: string
  memory?: string
}

/**
 * Network configuration for updates
 */
export type NetworkConfigUpdate = {
  serviceType: ServiceNetworkType
  ports: Array<{
    containerPort: number
    servicePort: number
    protocol: 'TCP' | 'UDP'
    nodePort?: number
    domain?: {
      enabled: boolean
      prefix: string
      host: string
    }
  }>
  headlessServiceEnabled: boolean
}

/**
 * Volume mount configuration
 */
export type VolumeMount = {
  nfs_subpath?: string
  container_path: string
  read_only: boolean
}

/**
 * Props for Configuration Tab component
 */
export interface ConfigurationTabProps {
  service: Service
  project: Project | null
  isEditing: boolean
  editedService: Partial<Service>
  envVars: Array<{ key: string; value: string }>
  volumes: VolumeMount[]
  networkServiceType: ServiceNetworkType
  networkPorts: NetworkPortFormState[]
  headlessServiceEnabled: boolean
  cpuValue: string
  cpuUnit: 'm' | 'core'
  memoryValue: string
  memoryUnit: 'Mi' | 'Gi'
  cpuRequestValue: string
  cpuRequestUnit: 'm' | 'core'
  memoryRequestValue: string
  memoryRequestUnit: 'Mi' | 'Gi'
  hasPendingNetworkDeploy: boolean
  onStartEdit: () => void
  onSave: () => Promise<void>
  onCancel: () => void
  onUpdateService: (updates: Partial<Service>) => void
  onUpdateEnvVars: (vars: Array<{ key: string; value: string }>) => void
  onUpdateVolumes: (volumes: VolumeMount[]) => void
  onUpdateNetwork: (config: NetworkConfigUpdate) => void
  onUpdateResources: (limits: ResourceLimits, requests: ResourceRequests) => void
}

/**
 * Props for Deployments Tab component
 */
export interface DeploymentsTabProps {
  service: Service
  deployments: Deployment[]
  deploymentsLoading: boolean
  deploymentsError: string | null
  serviceImages: ServiceImageRecord[]
  imagesLoading: boolean
  imagesError: string | null
  imagePagination: PaginationInfo
  currentDeployment: DeploymentImageInfo | null
  ongoingDeployment: DeploymentImageInfo | null
  onRefreshDeployments: () => Promise<void>
  onRefreshImages: () => Promise<void>
  onDeploy: (imageId?: string) => Promise<void>
  onBuild: (branch: string, tag: string) => Promise<void>
  onActivateImage: (imageId: string) => Promise<void>
  onPageChange: (page: number) => void
  // Build configuration props
  isEditingBuildConfig?: boolean
  onStartEditBuildConfig?: () => void
  onSaveBuildConfig?: (buildConfig: { build_type: string; build_args: Record<string, string> }) => Promise<void>
  onCancelEditBuildConfig?: () => void
}

/**
 * Props for Logs Tab component
 */
export interface LogsTabProps {
  serviceId: string
  logs: string
  logsLoading: boolean
  logsError: string | null
  onRefresh: () => Promise<void>
}

/**
 * Props for Files Tab component
 */
export interface FilesTabProps {
  serviceId: string
  serviceName: string
}

/**
 * Props for YAML Tab component
 */
export interface YAMLTabProps {
  serviceId: string
  yamlContent: string
  yamlLoading: boolean
  yamlError: string | null
  onRefresh: () => Promise<void>
}

/**
 * Props for Volumes Tab component
 */
export interface VolumesTabProps {
  isEditing: boolean
  volumes: VolumeMount[]
  serviceName: string
  serviceImage?: string
  onStartEdit: () => void
  onSave: () => Promise<void>
  onCancel: () => void
  onUpdateVolumes: (volumes: VolumeMount[]) => void
}

/**
 * Props for Debug Tools Tab component
 */
export interface DebugToolsTabProps {
  service: Service
  isEditing: boolean
  editedService: Partial<Service>
  onStartEdit: () => void
  onSave: () => Promise<void>
  onCancel: () => void
  onUpdateService: (updates: Partial<Service>) => void
}

/**
 * Tab configuration for dynamic rendering
 */
export type TabConfig = {
  value: TabValue
  label: string
  icon: React.ComponentType<{ className?: string }>
  visible: (service: Service) => boolean
  loadOnActivate?: () => Promise<void>
}
