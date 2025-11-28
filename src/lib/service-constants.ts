/**
 * Constants for service detail page
 */

/**
 * Service status values
 */
export const SERVICE_STATUSES = ['running', 'pending', 'stopped', 'error', 'building'] as const

export type ServiceStatus = (typeof SERVICE_STATUSES)[number]

/**
 * Status colors for badges
 */
export const STATUS_COLORS: Record<ServiceStatus, string> = {
  running: 'bg-green-500',
  pending: 'bg-yellow-500',
  stopped: 'bg-gray-500',
  error: 'bg-red-500',
  building: 'bg-blue-500'
}

/**
 * Status labels for display
 */
export const STATUS_LABELS: Record<ServiceStatus, string> = {
  running: '运行中',
  pending: '待启动',
  stopped: '已停止',
  error: '错误',
  building: '构建中'
}

/**
 * Normalize service status from various sources
 */
export function normalizeServiceStatus(status?: string): ServiceStatus {
  if (!status || typeof status !== 'string') {
    return 'pending'
  }
  
  const normalized = status.trim().toLowerCase()

  // Handle common variations
  if (normalized === 'stoped' || normalized === 'inactive') {
    return 'stopped'
  }

  return SERVICE_STATUSES.includes(normalized as ServiceStatus) 
    ? (normalized as ServiceStatus) 
    : 'pending'
}

/**
 * Deployment status metadata
 */
export const DEPLOYMENT_STATUS_META = {
  pending: { label: '待开始', className: 'bg-gray-100 text-gray-600' },
  building: { label: '构建中', className: 'bg-blue-100 text-blue-700' },
  success: { label: '部署成功', className: 'bg-green-100 text-green-700' },
  failed: { label: '部署失败', className: 'bg-red-100 text-red-700' }
} as const

/**
 * Service image status metadata
 */
export const IMAGE_STATUS_META = {
  pending: { 
    label: '等待构建', 
    badgeClass: 'bg-gray-100 text-gray-600', 
    textClass: 'text-gray-500' 
  },
  building: { 
    label: '构建中', 
    badgeClass: 'bg-blue-100 text-blue-600', 
    textClass: 'text-blue-600' 
  },
  success: { 
    label: '构建成功', 
    badgeClass: 'bg-green-100 text-green-700', 
    textClass: 'text-green-600' 
  },
  failed: { 
    label: '构建失败', 
    badgeClass: 'bg-red-100 text-red-700', 
    textClass: 'text-red-600' 
  }
} as const

/**
 * Configuration constants
 */
export const LOGS_LINE_COUNT = 200
export const IMAGE_HISTORY_PAGE_SIZE = 10
export const SUCCESS_IMAGE_OPTIONS_LIMIT = 100
export const DEPLOY_IMAGE_PAGE_SIZE = 5

/**
 * Time range options for metrics
 */
export const METRICS_TIME_RANGES = ['1h', '6h', '24h', '7d'] as const

export type MetricsTimeRange = typeof METRICS_TIME_RANGES[number]

/**
 * Default metrics time range
 */
export const DEFAULT_METRICS_TIME_RANGE: MetricsTimeRange = '1h'

/**
 * Metrics refresh interval (in milliseconds)
 */
export const METRICS_REFRESH_INTERVAL = 60000 // 60 seconds
