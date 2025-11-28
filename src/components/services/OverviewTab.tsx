'use client'

import { memo, useCallback } from 'react'
import { RefreshCw, Activity, AlertCircle, TrendingUp, Box, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ResourceUsageChart } from './ResourceUsageChart'
import { formatDateTime } from '@/lib/date-utils'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/service-constants'
import type { OverviewTabProps, MetricsDataPoint } from '@/types/service-tabs'

/**
 * StatusCard - Shows service status, replicas, and errors
 * Memoized to prevent unnecessary re-renders
 */
const StatusCard = memo(function StatusCard({
  k8sStatus,
  k8sStatusLoading,
  k8sStatusError,
  onRefresh
}: {
  k8sStatus: OverviewTabProps['k8sStatus']
  k8sStatusLoading: boolean
  k8sStatusError: string | null
  onRefresh: () => Promise<void>
}) {
  const status = k8sStatus?.status?.toLowerCase() || 'unknown'
  const statusColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800'
  const statusLabel = STATUS_LABELS[status as keyof typeof STATUS_LABELS] || '未知'

  // Calculate replica information
  const readyReplicas = k8sStatus?.readyReplicas ?? 0
  const totalReplicas = k8sStatus?.replicas ?? 0
  const hasReplicaInfo = totalReplicas > 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">服务状态</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={k8sStatusLoading}
        >
          <RefreshCw className={`h-4 w-4 ${k8sStatusLoading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {k8sStatusError ? (
          <div className="flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{k8sStatusError}</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className={statusColor}>{statusLabel}</Badge>
              {hasReplicaInfo && (
                <span className="text-sm text-gray-600">
                  副本: {readyReplicas}/{totalReplicas}
                </span>
              )}
            </div>
            
            {k8sStatus?.error && (
              <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{k8sStatus.error}</span>
              </div>
            )}
            
            {k8sStatus?.podStatus?.containerStatuses && Array.isArray(k8sStatus.podStatus.containerStatuses) && (
              <div className="text-xs text-gray-500">
                <div className="font-medium mb-1">容器状态:</div>
                {k8sStatus.podStatus.containerStatuses.map((container: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 py-1">
                    {container.ready ? (
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-600" />
                    )}
                    <span className="font-mono">{container.name || `容器 ${idx + 1}`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
})

/**
 * DeploymentInfoCard - Shows deployment information
 * Memoized to prevent unnecessary re-renders
 */
const DeploymentInfoCard = memo(function DeploymentInfoCard({
  currentDeployment,
  ongoingDeployment
}: {
  currentDeployment: OverviewTabProps['currentDeployment']
  ongoingDeployment: OverviewTabProps['ongoingDeployment']
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">部署信息</CardTitle>
      </CardHeader>
      <CardContent>
        {!currentDeployment && !ongoingDeployment ? (
          <div className="text-sm text-gray-500 text-center py-4">
            暂无部署信息
          </div>
        ) : (
          <div className="space-y-3">
            {ongoingDeployment && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
                  <span className="text-sm font-medium text-blue-900">部署进行中</span>
                </div>
                <div className="text-xs text-blue-700 font-mono">
                  {ongoingDeployment.display}
                </div>
              </div>
            )}
            
            {currentDeployment && (
              <div>
                <div className="text-xs text-gray-600 mb-1">当前部署</div>
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-mono">{currentDeployment.display}</span>
                </div>
                {currentDeployment.record?.metadata && 
                 typeof currentDeployment.record.metadata === 'object' && 
                 'branch' in currentDeployment.record.metadata && (
                  <div className="mt-2 text-xs text-gray-500">
                    分支: {String(currentDeployment.record.metadata.branch)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
})

/**
 * ResourceMetricsCard - Shows current CPU/memory usage
 * Memoized to prevent unnecessary re-renders
 */
const ResourceMetricsCard = memo(function ResourceMetricsCard({
  metricsHistory,
  metricsLoading,
  metricsError
}: {
  metricsHistory: MetricsDataPoint[]
  metricsLoading: boolean
  metricsError: string | null
}) {
  // Get the latest metrics data point
  const latestMetrics = metricsHistory.length > 0 ? metricsHistory[metricsHistory.length - 1] : null

  const formatCpu = (millicores?: number) => {
    if (millicores === undefined) return '-'
    if (millicores >= 1000) {
      return `${(millicores / 1000).toFixed(2)} cores`
    }
    return `${millicores.toFixed(0)}m`
  }

  const formatMemory = (bytes?: number) => {
    if (bytes === undefined) return '-'
    const units = ['B', 'KB', 'MB', 'GB']
    let value = bytes
    let unitIndex = 0
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024
      unitIndex++
    }
    
    return `${value.toFixed(1)} ${units[unitIndex]}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">当前资源使用</CardTitle>
      </CardHeader>
      <CardContent>
        {metricsLoading ? (
          <div className="flex items-center justify-center h-20 text-sm text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            加载中...
          </div>
        ) : metricsError ? (
          <div className="flex items-start gap-2 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{metricsError}</span>
          </div>
        ) : !latestMetrics ? (
          <div className="text-sm text-gray-500 text-center py-4">
            暂无指标数据
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-gray-600">CPU 使用</div>
              <div className="text-2xl font-bold text-blue-600">
                {latestMetrics.cpuPercent?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-xs text-gray-500">
                {formatCpu(latestMetrics.cpuUsed)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-600">内存使用</div>
              <div className="text-2xl font-bold text-green-600">
                {latestMetrics.memoryPercent?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-xs text-gray-500">
                {formatMemory(latestMetrics.memoryUsed)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

/**
 * PodEventsCard - Shows recent Kubernetes events (limited to 10)
 * Memoized to prevent unnecessary re-renders
 */
const PodEventsCard = memo(function PodEventsCard({
  podEvents,
  podEventsLoading,
  podEventsError,
  onRefresh
}: {
  podEvents: OverviewTabProps['podEvents']
  podEventsLoading: boolean
  podEventsError: string | null
  onRefresh: () => Promise<void>
}) {
  // Limit to 10 events as per requirements
  const displayEvents = podEvents.slice(0, 10)

  const getEventIcon = (type: string) => {
    const normalizedType = type.toLowerCase()
    if (normalizedType === 'normal') {
      return <CheckCircle className="h-4 w-4 text-green-600" />
    }
    if (normalizedType === 'warning') {
      return <AlertCircle className="h-4 w-4 text-amber-600" />
    }
    return <AlertCircle className="h-4 w-4 text-red-600" />
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">最近事件</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={podEventsLoading}
        >
          <RefreshCw className={`h-4 w-4 ${podEventsLoading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {podEventsError ? (
          <div className="flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{podEventsError}</span>
          </div>
        ) : displayEvents.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            暂无事件
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {displayEvents.map((event, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs border-b border-gray-100 pb-2 last:border-0">
                {getEventIcon(event.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{event.reason}</span>
                    {event.count > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        {event.count}x
                      </Badge>
                    )}
                  </div>
                  <div className="text-gray-600 break-words">{event.message}</div>
                  {event.timestamp && (
                    <div className="text-gray-400 mt-1">
                      {formatDateTime(event.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
})



/**
 * OverviewTab - Main component that consolidates all operational information
 * Memoized to prevent unnecessary re-renders when parent re-renders
 */
export const OverviewTab = memo(function OverviewTab({
  service,
  k8sStatus,
  k8sStatusLoading,
  k8sStatusError,
  metricsHistory,
  metricsLoading,
  metricsError,
  metricsTimeRange,
  podEvents,
  podEventsLoading,
  podEventsError,
  currentDeployment,
  ongoingDeployment,
  onRefreshStatus,
  onRefreshMetrics,
  onRefreshEvents,
  onChangeTimeRange
}: OverviewTabProps) {
  console.log('[OverviewTab] 渲染，metricsTimeRange:', metricsTimeRange, 'dataPoints:', metricsHistory.length)
  
  const timeRangeOptions = [
    { value: '1h', label: '1小时' },
    { value: '6h', label: '6小时' },
    { value: '24h', label: '24小时' },
    { value: '7d', label: '7天' }
  ]

  return (
    <div className="space-y-6">
      {/* Top row: Status, Deployment Info, and Current Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          k8sStatus={k8sStatus}
          k8sStatusLoading={k8sStatusLoading}
          k8sStatusError={k8sStatusError}
          onRefresh={onRefreshStatus}
        />
        <DeploymentInfoCard
          currentDeployment={currentDeployment}
          ongoingDeployment={ongoingDeployment}
        />
        <ResourceMetricsCard
          metricsHistory={metricsHistory}
          metricsLoading={metricsLoading}
          metricsError={metricsError}
        />
      </div>

      {/* Historical metrics chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm font-medium">资源使用趋势</CardTitle>
            <CardDescription className="text-xs">
              基于 Prometheus 的历史监控数据
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {timeRangeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={metricsTimeRange === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    console.log('[OverviewTab] 时间范围按钮点击:', option.value, '当前值:', metricsTimeRange)
                    onChangeTimeRange(option.value)
                  }}
                  className="text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                console.log('[OverviewTab] 刷新按钮点击，当前 timeRange:', metricsTimeRange)
                onRefreshMetrics(metricsTimeRange)
              }}
            >
              <RefreshCw className={`h-4 w-4 ${metricsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {metricsError ? (
            <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-4 rounded">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium mb-1">无法获取监控数据</div>
                <div>{metricsError}</div>
              </div>
            </div>
          ) : (
            <ResourceUsageChart data={metricsHistory} height={300} />
          )}
        </CardContent>
      </Card>

      {/* Bottom row: Events */}
      <PodEventsCard
        podEvents={podEvents}
        podEventsLoading={podEventsLoading}
        podEventsError={podEventsError}
        onRefresh={onRefreshEvents}
      />
    </div>
  )
})
