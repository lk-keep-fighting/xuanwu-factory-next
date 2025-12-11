'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Search, Filter, Download, Play, Pause, RefreshCw, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
// import { Checkbox } from '@/components/ui/checkbox' // 暂时注释掉，使用原生input替代
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

interface LogEntry {
  id: string
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
  service: string
  pod: string
  container: string
  message: string
  source?: string
}

interface AggregatedLogViewerProps {
  project: Project | null
  services: Service[]
}

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const
const LOG_LEVEL_COLORS = {
  DEBUG: 'text-gray-600 bg-gray-100',
  INFO: 'text-blue-600 bg-blue-100',
  WARN: 'text-yellow-600 bg-yellow-100',
  ERROR: 'text-red-600 bg-red-100',
  FATAL: 'text-purple-600 bg-purple-100'
}

export function AggregatedLogViewer({ project, services }: AggregatedLogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [selectedLevels, setSelectedLevels] = useState<string[]>(['INFO', 'WARN', 'ERROR', 'FATAL'])
  const [autoScroll, setAutoScroll] = useState(true)

  // 加载聚合日志
  const loadAggregatedLogs = useCallback(async () => {
    if (!project) return

    try {
      setLoading(true)
      
      // 模拟聚合日志数据 - 实际应该从日志聚合系统获取
      const mockLogs: LogEntry[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
          level: 'INFO',
          service: 'api-gateway',
          pod: 'api-gateway-7d4b8c9f5-abc12',
          container: 'api-gateway',
          message: 'Started HTTP server on port 8080',
          source: 'main.go:45'
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          level: 'ERROR',
          service: 'user-service',
          pod: 'user-service-6b7c8d9e0-def34',
          container: 'user-service',
          message: 'Database connection failed: connection timeout',
          source: 'db.go:123'
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          level: 'WARN',
          service: 'order-service',
          pod: 'order-service-5a6b7c8d9-ghi56',
          container: 'order-service',
          message: 'High memory usage detected: 85%',
          source: 'monitor.go:67'
        },
        {
          id: '4',
          timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
          level: 'INFO',
          service: 'api-gateway',
          pod: 'api-gateway-7d4b8c9f5-abc12',
          container: 'api-gateway',
          message: 'GET /api/users - 200 OK (45ms)',
          source: 'router.go:89'
        },
        {
          id: '5',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          level: 'DEBUG',
          service: 'user-service',
          pod: 'user-service-6b7c8d9e0-def34',
          container: 'user-service',
          message: 'Processing user authentication request',
          source: 'auth.go:34'
        }
      ]

      setLogs(mockLogs)
    } catch (error) {
      console.error('Failed to load aggregated logs:', error)
      toast.error('加载聚合日志失败')
    } finally {
      setLoading(false)
    }
  }, [project])

  // 过滤日志
  useEffect(() => {
    let filtered = logs

    // 按服务过滤
    if (selectedServices.length > 0) {
      filtered = filtered.filter(log => selectedServices.includes(log.service))
    }

    // 按日志级别过滤
    if (selectedLevels.length > 0) {
      filtered = filtered.filter(log => selectedLevels.includes(log.level))
    }

    // 按搜索关键词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(query) ||
        log.service.toLowerCase().includes(query) ||
        log.pod.toLowerCase().includes(query)
      )
    }

    // 按时间排序（最新的在前）
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    setFilteredLogs(filtered)
  }, [logs, selectedServices, selectedLevels, searchQuery])

  // 初始加载
  useEffect(() => {
    if (project) {
      loadAggregatedLogs()
      // 默认选择所有服务
      setSelectedServices(services.map(s => s.name))
    }
  }, [project, services, loadAggregatedLogs])

  // 处理服务选择
  const handleServiceToggle = (serviceName: string, checked: boolean) => {
    setSelectedServices(prev => 
      checked 
        ? [...prev, serviceName]
        : prev.filter(s => s !== serviceName)
    )
  }

  // 处理日志级别选择
  const handleLevelToggle = (level: string, checked: boolean) => {
    setSelectedLevels(prev => 
      checked 
        ? [...prev, level]
        : prev.filter(l => l !== level)
    )
  }

  // 导出日志
  const exportLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${log.timestamp}] [${log.level}] [${log.service}/${log.pod}] ${log.message}`
    ).join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project?.name || 'project'}-logs-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('日志已导出')
  }

  // 格式化时间戳
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  if (!project) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">请先选择一个项目查看聚合日志</p>
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
              <FileText className="h-5 w-5" />
              聚合日志查看器
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadAggregatedLogs}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStreaming(!streaming)}
                className="gap-2"
              >
                {streaming ? (
                  <>
                    <Pause className="h-4 w-4" />
                    暂停
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    实时
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportLogs}
                disabled={filteredLogs.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                导出
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索日志内容、服务名或Pod名..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* 过滤器 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 服务选择 */}
              <div>
                <label className="text-sm font-medium mb-2 block">选择服务</label>
                <div className="flex flex-wrap gap-2">
                  {services.map((service) => (
                    <div key={service.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`service-${service.id}`}
                        checked={selectedServices.includes(service.name)}
                        onChange={(e) => 
                          handleServiceToggle(service.name, e.target.checked)
                        }
                        className="rounded border-gray-300"
                      />
                      <label
                        htmlFor={`service-${service.id}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {service.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* 日志级别选择 */}
              <div>
                <label className="text-sm font-medium mb-2 block">日志级别</label>
                <div className="flex flex-wrap gap-2">
                  {LOG_LEVELS.map((level) => (
                    <div key={level} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`level-${level}`}
                        checked={selectedLevels.includes(level)}
                        onChange={(e) => 
                          handleLevelToggle(level, e.target.checked)
                        }
                        className="rounded border-gray-300"
                      />
                      <label
                        htmlFor={`level-${level}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        <Badge variant="outline" className={LOG_LEVEL_COLORS[level]}>
                          {level}
                        </Badge>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 统计信息 */}
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                显示 {filteredLogs.length} / {logs.length} 条日志
              </span>
              <div className="flex items-center gap-4">
                <span>错误: {filteredLogs.filter(log => log.level === 'ERROR' || log.level === 'FATAL').length}</span>
                <span>警告: {filteredLogs.filter(log => log.level === 'WARN').length}</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="auto-scroll"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="auto-scroll" className="text-sm cursor-pointer">自动滚动</label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 日志列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            {filteredLogs.length > 0 ? (
              <div className="space-y-1 p-4">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg font-mono text-sm"
                  >
                    <div className="flex-shrink-0 text-gray-500 w-20">
                      {formatTimestamp(log.timestamp)}
                    </div>
                    <Badge
                      variant="outline"
                      className={`flex-shrink-0 ${LOG_LEVEL_COLORS[log.level]} text-xs`}
                    >
                      {log.level}
                    </Badge>
                    <div className="flex-shrink-0 text-blue-600 w-24 truncate">
                      {log.service}
                    </div>
                    <div className="flex-shrink-0 text-gray-500 w-32 truncate text-xs">
                      {log.pod}
                    </div>
                    <div className="flex-1 text-gray-900">
                      {log.message}
                    </div>
                    {log.source && (
                      <div className="flex-shrink-0 text-gray-400 text-xs">
                        {log.source}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>加载日志中...</span>
                  </div>
                ) : (
                  <div>
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>没有找到匹配的日志</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}