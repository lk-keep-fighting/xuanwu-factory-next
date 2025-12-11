'use client'

import { useState, useEffect } from 'react'
import { Activity, Cpu, MemoryStick, HardDrive, Network, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

interface Project {
  id: string
  name: string
  identifier: string
}

interface Service {
  id: string
  name: string
  type: string
  status?: string
}

interface ServiceMetrics {
  serviceName: string
  podCount: number
  cpu: {
    usage: number
    limit: number
    percentage: number
  }
  memory: {
    usage: number
    limit: number
    percentage: number
  }
  network: {
    inbound: number
    outbound: number
  }
  disk: {
    usage: number
    limit: number
    percentage: number
  }
  status: 'healthy' | 'warning' | 'critical'
}

interface ProjectMetrics {
  totalPods: number
  runningPods: number
  totalCpu: number
  totalMemory: number
  totalDisk: number
  networkTraffic: number
  services: ServiceMetrics[]
}

interface ProjectMetricsOverviewProps {
  project: Project | null
  services: Service[]
}

export function ProjectMetricsOverview({ project, services }: ProjectMetricsOverviewProps) {
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // 加载项目性能指标
  const loadProjectMetrics = async () => {
    if (!project) return

    try {
      setLoading(true)
      
      // 模拟性能指标数据 - 实际应该从监控系统获取
      const mockMetrics: ProjectMetrics = {
        totalPods: services.length * 2, // 假设每个服务有2个Pod
        runningPods: services.filter(s => s.status === 'running').length * 2,
        totalCpu: 4.5,
        totalMemory: 8.2,
        totalDisk: 45.6,
        networkTraffic: 125.8,
        services: services.map((service, index) => ({
          serviceName: service.name,
          podCount: 2,
          cpu: {
            usage: 0.5 + Math.random() * 1.5,
            limit: 2,
            percentage: 25 + Math.random() * 50
          },
          memory: {
            usage: 512 + Math.random() * 1024,
            limit: 2048,
            percentage: 25 + Math.random() * 50
          },
          network: {
            inbound: Math.random() * 50,
            outbound: Math.random() * 30
          },
          disk: {
            usage: 2 + Math.random() * 8,
            limit: 20,
            percentage: 10 + Math.random() * 40
          },
          status: Math.random() > 0.8 ? 'warning' : Math.random() > 0.95 ? 'critical' : 'healthy'
        }))
      }

      setMetrics(mockMetrics)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load project metrics:', error)
      toast.error('加载性能指标失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (project && services.length > 0) {
      loadProjectMetrics()
      
      // 设置定时刷新
      const interval = setInterval(loadProjectMetrics, 30000) // 30秒刷新一次
      return () => clearInterval(interval)
    }
  }, [project, services])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  const formatCpu = (cpu: number) => {
    return `${cpu.toFixed(2)} cores`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <TrendingUp className="h-4 w-4" />
      case 'warning': return <Activity className="h-4 w-4" />
      case 'critical': return <TrendingDown className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500'
    if (percentage < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  if (!project) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">请先选择一个项目查看性能监控</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              项目性能监控
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="text-sm text-gray-500">
                  最后更新: {lastUpdated.toLocaleTimeString('zh-CN')}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={loadProjectMetrics}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{metrics.runningPods}/{metrics.totalPods}</div>
                <div className="text-sm text-gray-500">运行中Pod</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{formatCpu(metrics.totalCpu)}</div>
                <div className="text-sm text-gray-500">CPU使用</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{formatBytes(metrics.totalMemory * 1024 * 1024 * 1024)}</div>
                <div className="text-sm text-gray-500">内存使用</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{formatBytes(metrics.networkTraffic * 1024 * 1024)}/s</div>
                <div className="text-sm text-gray-500">网络流量</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 服务性能详情 */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {metrics.services.map((serviceMetrics) => (
            <Card key={serviceMetrics.serviceName}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{serviceMetrics.serviceName}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getStatusColor(serviceMetrics.status)}>
                      {getStatusIcon(serviceMetrics.status)}
                      {serviceMetrics.status}
                    </Badge>
                    <Badge variant="outline">
                      {serviceMetrics.podCount} Pods
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* CPU */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">CPU</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {formatCpu(serviceMetrics.cpu.usage)} / {formatCpu(serviceMetrics.cpu.limit)}
                      </span>
                    </div>
                    <Progress 
                      value={serviceMetrics.cpu.percentage} 
                      className="h-2"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {serviceMetrics.cpu.percentage.toFixed(1)}%
                    </div>
                  </div>

                  {/* 内存 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MemoryStick className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">内存</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {formatBytes(serviceMetrics.memory.usage * 1024 * 1024)} / {formatBytes(serviceMetrics.memory.limit * 1024 * 1024)}
                      </span>
                    </div>
                    <Progress 
                      value={serviceMetrics.memory.percentage} 
                      className="h-2"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {serviceMetrics.memory.percentage.toFixed(1)}%
                    </div>
                  </div>

                  {/* 磁盘 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium">磁盘</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {formatBytes(serviceMetrics.disk.usage * 1024 * 1024 * 1024)} / {formatBytes(serviceMetrics.disk.limit * 1024 * 1024 * 1024)}
                      </span>
                    </div>
                    <Progress 
                      value={serviceMetrics.disk.percentage} 
                      className="h-2"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {serviceMetrics.disk.percentage.toFixed(1)}%
                    </div>
                  </div>

                  {/* 网络 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Network className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">网络流量</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">入站</div>
                        <div className="font-medium">{formatBytes(serviceMetrics.network.inbound * 1024 * 1024)}/s</div>
                      </div>
                      <div>
                        <div className="text-gray-500">出站</div>
                        <div className="font-medium">{formatBytes(serviceMetrics.network.outbound * 1024 * 1024)}/s</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 加载状态 */}
      {loading && !metrics && (
        <Card>
          <CardContent className="p-8 text-center">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-500" />
            <p className="text-gray-500">加载性能指标中...</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}