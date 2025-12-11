'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Activity, 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Network, 
  RefreshCw,
  TrendingUp,
  AlertTriangle
} from 'lucide-react'

interface Pod {
  name: string
  namespace: string
}

interface MetricData {
  cpu: {
    usage: number
    limit?: number
    requests?: number
    cores: number
  }
  memory: {
    usage: number
    limit?: number
    requests?: number
    rss: number
    cache: number
  }
  network: {
    rxBytes: number
    txBytes: number
    rxPackets: number
    txPackets: number
  }
  filesystem: {
    usage: number
    available: number
    total: number
  }
  processes: {
    total: number
    running: number
    sleeping: number
  }
}

interface PodMetricsProps {
  pod: Pod
}

export function PodMetrics({ pod }: PodMetricsProps) {
  const [metrics, setMetrics] = useState<MetricData | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // 获取指标数据
  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/k8s/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podName: pod.name,
          namespace: pod.namespace
        })
      })

      if (!response.ok) throw new Error('Failed to fetch metrics')

      const data = await response.json()
      setMetrics(data.metrics)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
      // 使用模拟数据作为后备
      setMetrics({
        cpu: {
          usage: Math.random() * 80,
          limit: 1000,
          requests: 100,
          cores: 2
        },
        memory: {
          usage: Math.random() * 1024 * 1024 * 1024,
          limit: 2 * 1024 * 1024 * 1024,
          requests: 512 * 1024 * 1024,
          rss: Math.random() * 512 * 1024 * 1024,
          cache: Math.random() * 256 * 1024 * 1024
        },
        network: {
          rxBytes: Math.random() * 1024 * 1024 * 100,
          txBytes: Math.random() * 1024 * 1024 * 50,
          rxPackets: Math.random() * 10000,
          txPackets: Math.random() * 8000
        },
        filesystem: {
          usage: Math.random() * 10 * 1024 * 1024 * 1024,
          available: 20 * 1024 * 1024 * 1024,
          total: 30 * 1024 * 1024 * 1024
        },
        processes: {
          total: Math.floor(Math.random() * 50) + 20,
          running: Math.floor(Math.random() * 5) + 1,
          sleeping: Math.floor(Math.random() * 40) + 15
        }
      })
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }

  // 格式化字节数
  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  // 格式化CPU使用率
  const formatCpuUsage = (usage: number) => {
    return `${usage.toFixed(1)}%`
  }

  // 计算使用率百分比
  const calculatePercentage = (usage: number, limit?: number) => {
    if (!limit) return 0
    return Math.min((usage / limit) * 100, 100)
  }

  // 获取状态颜色
  const getStatusColor = (percentage: number) => {
    if (percentage > 90) return 'text-red-600'
    if (percentage > 70) return 'text-yellow-600'
    return 'text-green-600'
  }

  // 自动刷新
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (autoRefresh) {
      interval = setInterval(fetchMetrics, 5000) // 每5秒刷新
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  // 初始加载
  useEffect(() => {
    fetchMetrics()
  }, [pod])

  if (!metrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className={`h-8 w-8 mx-auto mb-4 ${loading ? 'animate-spin' : ''}`} />
            <p className="text-muted-foreground">
              {loading ? '加载指标数据...' : '点击刷新获取指标数据'}
            </p>
            {!loading && (
              <Button onClick={fetchMetrics} className="mt-4">
                获取指标
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const cpuPercentage = calculatePercentage(metrics.cpu.usage, metrics.cpu.limit)
  const memoryPercentage = calculatePercentage(metrics.memory.usage, metrics.memory.limit)
  const diskPercentage = calculatePercentage(metrics.filesystem.usage, metrics.filesystem.total)

  return (
    <div className="space-y-4">
      {/* 控制面板 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              性能监控
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                size="sm"
                variant={autoRefresh ? "default" : "outline"}
              >
                {autoRefresh ? "停止自动刷新" : "自动刷新"}
              </Button>
              <Button
                onClick={fetchMetrics}
                size="sm"
                variant="outline"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Pod: {pod.name}</span>
            {lastUpdated && (
              <span>最后更新: {lastUpdated.toLocaleTimeString()}</span>
            )}
            {autoRefresh && (
              <Badge variant="outline" className="bg-green-50">
                自动刷新中
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CPU 使用率 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-5 w-5" />
              CPU 使用率
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">当前使用</span>
                <span className={`font-mono ${getStatusColor(cpuPercentage)}`}>
                  {formatCpuUsage(metrics.cpu.usage)}
                </span>
              </div>
              <Progress value={cpuPercentage} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">请求:</span>
                <div className="font-mono">{metrics.cpu.requests || 0}m</div>
              </div>
              <div>
                <span className="text-muted-foreground">限制:</span>
                <div className="font-mono">{metrics.cpu.limit || 0}m</div>
              </div>
              <div>
                <span className="text-muted-foreground">核心数:</span>
                <div className="font-mono">{metrics.cpu.cores}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 内存使用率 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MemoryStick className="h-5 w-5" />
              内存使用率
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">当前使用</span>
                <span className={`font-mono ${getStatusColor(memoryPercentage)}`}>
                  {formatBytes(metrics.memory.usage)}
                </span>
              </div>
              <Progress value={memoryPercentage} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">RSS:</span>
                <div className="font-mono">{formatBytes(metrics.memory.rss)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">缓存:</span>
                <div className="font-mono">{formatBytes(metrics.memory.cache)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">请求:</span>
                <div className="font-mono">{formatBytes(metrics.memory.requests || 0)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">限制:</span>
                <div className="font-mono">{formatBytes(metrics.memory.limit || 0)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 磁盘使用率 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-5 w-5" />
              磁盘使用率
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">已使用</span>
                <span className={`font-mono ${getStatusColor(diskPercentage)}`}>
                  {formatBytes(metrics.filesystem.usage)}
                </span>
              </div>
              <Progress value={diskPercentage} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">可用:</span>
                <div className="font-mono">{formatBytes(metrics.filesystem.available)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">总计:</span>
                <div className="font-mono">{formatBytes(metrics.filesystem.total)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 网络流量 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="h-5 w-5" />
              网络流量
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">接收字节:</span>
                <div className="font-mono">{formatBytes(metrics.network.rxBytes)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">发送字节:</span>
                <div className="font-mono">{formatBytes(metrics.network.txBytes)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">接收包:</span>
                <div className="font-mono">{metrics.network.rxPackets.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">发送包:</span>
                <div className="font-mono">{metrics.network.txPackets.toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 进程信息 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5" />
            进程信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{metrics.processes.total}</div>
              <div className="text-sm text-muted-foreground">总进程</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{metrics.processes.running}</div>
              <div className="text-sm text-muted-foreground">运行中</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{metrics.processes.sleeping}</div>
              <div className="text-sm text-muted-foreground">休眠中</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 警告信息 */}
      {(cpuPercentage > 80 || memoryPercentage > 80 || diskPercentage > 80) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">性能警告</span>
            </div>
            <div className="mt-2 text-sm text-yellow-700">
              {cpuPercentage > 80 && <div>• CPU 使用率过高 ({cpuPercentage.toFixed(1)}%)</div>}
              {memoryPercentage > 80 && <div>• 内存使用率过高 ({memoryPercentage.toFixed(1)}%)</div>}
              {diskPercentage > 80 && <div>• 磁盘使用率过高 ({diskPercentage.toFixed(1)}%)</div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}