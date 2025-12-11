'use client'

import { memo, useCallback, useState, useEffect, useRef } from 'react'
import { RefreshCw, Activity, AlertCircle, TrendingUp, Box, CheckCircle, XCircle, Clock, Monitor, Eye, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ResourceUsageChart } from './ResourceUsageChart'
import { formatDateTime } from '@/lib/date-utils'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/service-constants'
import type { OverviewTabProps, MetricsDataPoint } from '@/types/service-tabs'

/**
 * PodMonitorDialog - Real-time Pod monitoring dialog
 */
const PodMonitorDialog = memo(function PodMonitorDialog({
  open,
  onClose,
  serviceId,
  serviceName
}: {
  open: boolean
  onClose: () => void
  serviceId: string
  serviceName: string
}) {
  const [podStatus, setPodStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchPodStatus = useCallback(async () => {
    if (!serviceId) return

    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/services/${serviceId}/status`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '获取 Pod 状态失败')
      }

      // 处理不同的 podStatus 结构
      const podStatus = data.podStatus
      if (podStatus) {
        // 如果有 pods 数组（Deployment），直接使用
        if (podStatus.pods && Array.isArray(podStatus.pods)) {
          setPodStatus({ pods: podStatus.pods })
        }
        // 如果有 containerStatuses（StatefulSet），转换为 pods 格式
        else if (podStatus.containerStatuses && Array.isArray(podStatus.containerStatuses)) {
          setPodStatus({
            pods: [{
              name: `${serviceName}-pod`,
              phase: 'Running', // StatefulSet 通常是运行状态
              containers: podStatus.containerStatuses.map((c: any) => ({
                name: c.name,
                ready: c.ready || false,
                restartCount: c.restartCount || 0,
                state: c.state
              }))
            }]
          })
        }
        // 其他情况设为空
        else {
          setPodStatus({ pods: [] })
        }
      } else {
        setPodStatus({ pods: [] })
      }
    } catch (err: any) {
      setError(err.message || '获取 Pod 状态失败')
      setPodStatus(null)
    } finally {
      setLoading(false)
    }
  }, [serviceId])

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true)
    fetchPodStatus()
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    intervalRef.current = setInterval(() => {
      fetchPodStatus()
    }, 3000) // Refresh every 3 seconds
  }, [fetchPodStatus])

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Handle dialog open/close
  useEffect(() => {
    if (open) {
      startMonitoring()
    } else {
      stopMonitoring()
      setPodStatus(null)
      setError(null)
    }

    return () => {
      stopMonitoring()
    }
  }, [open, startMonitoring, stopMonitoring])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Pod 实时监控 - {serviceName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-sm text-gray-600">
                {isMonitoring ? '实时监控中 (每3秒刷新)' : '监控已停止'}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPodStatus}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                手动刷新
              </Button>
              <Button
                variant={isMonitoring ? 'destructive' : 'default'}
                size="sm"
                onClick={isMonitoring ? stopMonitoring : startMonitoring}
              >
                {isMonitoring ? '停止监控' : '开始监控'}
              </Button>
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-4 rounded">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : !podStatus?.pods || podStatus.pods.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  加载 Pod 状态中...
                </div>
              ) : (
                '暂无 Pod 信息'
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {podStatus.pods.map((pod: any, podIdx: number) => (
                <Card key={podIdx} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4 text-blue-600" />
                        <span className="font-mono text-sm font-medium">{pod.name}</span>
                      </div>
                      <Badge variant="outline" className={
                        pod.phase === 'Running' ? 'border-green-500 text-green-700' :
                        pod.phase === 'Pending' ? 'border-yellow-500 text-yellow-700' :
                        pod.phase === 'Failed' ? 'border-red-500 text-red-700' :
                        'border-gray-500 text-gray-700'
                      }>
                        {pod.phase}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {pod.containers && pod.containers.length > 0 && (
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-gray-700">容器状态:</div>
                        {pod.containers.map((container: any, containerIdx: number) => (
                          <div key={containerIdx} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {container.ready ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                )}
                                <span className="font-mono text-sm font-medium">{container.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {container.restartCount > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    重启 {container.restartCount}次
                                  </Badge>
                                )}
                                <Badge variant={container.ready ? 'default' : 'destructive'} className="text-xs">
                                  {container.ready ? '就绪' : '未就绪'}
                                </Badge>
                              </div>
                            </div>
                            {container.state && (
                              <div className="text-xs text-gray-600">
                                <div className="grid grid-cols-2 gap-2">
                                  {container.state.running && (
                                    <div>
                                      <span className="font-medium">运行开始:</span>
                                      <div className="font-mono">
                                        {formatDateTime(container.state.running.startedAt)}
                                      </div>
                                    </div>
                                  )}
                                  {container.state.waiting && (
                                    <div>
                                      <span className="font-medium">等待原因:</span>
                                      <div>{container.state.waiting.reason}</div>
                                    </div>
                                  )}
                                  {container.state.terminated && (
                                    <div>
                                      <span className="font-medium">终止原因:</span>
                                      <div>{container.state.terminated.reason}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
})

/**
 * StatusCard - Shows service status, replicas, and errors
 * Memoized to prevent unnecessary re-renders
 */
const StatusCard = memo(function StatusCard({
  k8sStatus,
  k8sStatusLoading,
  k8sStatusError,
  onRefresh,
  serviceId,
  serviceName
}: {
  k8sStatus: OverviewTabProps['k8sStatus']
  k8sStatusLoading: boolean
  k8sStatusError: string | null
  onRefresh: () => Promise<void>
  serviceId: string
  serviceName: string
}) {
  const [podMonitorOpen, setPodMonitorOpen] = useState(false)
  
  const status = k8sStatus?.status?.toLowerCase() || 'unknown'
  const statusColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800'
  const statusLabel = STATUS_LABELS[status as keyof typeof STATUS_LABELS] || '未知'

  // Calculate replica information
  const readyReplicas = k8sStatus?.readyReplicas ?? 0
  const totalReplicas = k8sStatus?.replicas ?? 0
  const hasReplicaInfo = totalReplicas > 0
  const hasPods = k8sStatus?.podStatus?.pods && k8sStatus.podStatus.pods.length > 0

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">服务状态</CardTitle>
          <div className="flex gap-1">
            {hasPods && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPodMonitorOpen(true)}
                className="gap-1"
                title="Pod 实时监控"
              >
                <Eye className="h-4 w-4" />
                监控
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={k8sStatusLoading}
            >
              <RefreshCw className={`h-4 w-4 ${k8sStatusLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
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
              
              {hasPods && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Box className="h-3 w-3 text-blue-600" />
                  <span>{k8sStatus?.podStatus?.pods?.length || 0} 个 Pod</span>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setPodMonitorOpen(true)}
                    className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                  >
                    查看详情
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <PodMonitorDialog
        open={podMonitorOpen}
        onClose={() => setPodMonitorOpen(false)}
        serviceId={serviceId}
        serviceName={serviceName}
      />
    </>
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
  const handleCopyImage = useCallback(async (imageText: string) => {
    try {
      await navigator.clipboard.writeText(imageText)
      toast.success('镜像地址已复制到剪贴板')
    } catch (error) {
      toast.error('复制失败')
    }
  }, [])

  // 解析镜像地址，分离镜像名称和标签
  const parseImageDisplay = useCallback((imageDisplay: string) => {
    const lastColonIndex = imageDisplay.lastIndexOf(':')
    if (lastColonIndex === -1) {
      return { imageName: imageDisplay, tag: 'latest' }
    }
    
    const imageName = imageDisplay.substring(0, lastColonIndex)
    const tag = imageDisplay.substring(lastColonIndex + 1)
    
    // 如果标签包含 '/' 或者看起来像是镜像名称的一部分，则认为没有标签
    if (tag.includes('/') || tag.includes('.')) {
      return { imageName: imageDisplay, tag: 'latest' }
    }
    
    return { imageName, tag }
  }, [])

  // 渲染镜像信息的组件
  const ImageDisplay = useCallback(({ 
    imageDisplay, 
    textColor = 'text-gray-700',
    isOngoing = false
  }: { 
    imageDisplay: string
    textColor?: string
    isOngoing?: boolean
  }) => {
    const { imageName, tag } = parseImageDisplay(imageDisplay)
    
    return (
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-mono ${textColor} break-all leading-relaxed`}>
          {imageName}
        </div>
        <div className="flex items-center gap-1 mt-2">
          <span className="text-xs text-gray-500 font-medium">TAG</span>
          <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono ${
            isOngoing 
              ? 'bg-blue-100 text-blue-800 border border-blue-200' 
              : 'bg-gray-100 text-gray-700 border border-gray-200'
          }`}>
            {tag}
          </div>
        </div>
      </div>
    )
  }, [parseImageDisplay])

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
                <div className="flex items-start gap-2">
                  <ImageDisplay 
                    imageDisplay={ongoingDeployment.display}
                    textColor="text-blue-700"
                    isOngoing={true}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyImage(ongoingDeployment.display)}
                    className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 flex-shrink-0 mt-1"
                    title="复制镜像地址"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            
            {currentDeployment && (
              <div>
                <div className="text-xs text-gray-600 mb-2">当前镜像</div>
                <div className="flex items-start gap-2">
                  <Box className="h-4 w-4 text-gray-600 flex-shrink-0 mt-1" />
                  <ImageDisplay 
                    imageDisplay={currentDeployment.display}
                    textColor="text-gray-700"
                    isOngoing={false}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyImage(currentDeployment.display)}
                    className="h-6 w-6 p-0 text-gray-600 hover:text-gray-800 flex-shrink-0 mt-1"
                    title="复制镜像地址"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
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
          serviceId={service.id || ''}
          serviceName={service.name || ''}
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
