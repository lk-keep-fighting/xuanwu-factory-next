/**
 * LogViewer - A reusable log viewing component with advanced features
 * 
 * Features:
 * - Real-time log streaming via WebSocket
 * - Search and filtering by log level
 * - Export logs to file
 * - Auto-scroll and manual scroll control
 * - Support for multiple containers
 * - Structured and plain text log parsing
 * 
 * Usage Examples:
 * 
 * 1. Simple service logs (like service details page):
 * <LogViewer
 *   serviceId={serviceId}
 *   logs={logs}
 *   loading={loading}
 *   error={error}
 *   onRefresh={() => loadLogs()}
 *   showStreaming={false}
 * />
 * 
 * 2. Pod logs with streaming (like debug tools):
 * <LogViewer
 *   podName={pod.name}
 *   namespace={pod.namespace}
 *   containers={pod.containers}
 *   onLoadLogs={async (params) => {
 *     const response = await fetch(`/api/k8s/logs?${new URLSearchParams(params)}`)
 *     return await response.json()
 *   }}
 *   streamingUrl={(params) => 
 *     `ws://localhost:3001/api/k8s/logs/stream?${new URLSearchParams(params)}`
 *   }
 * />
 * 
 * 3. Custom log source:
 * <LogViewer
 *   title="Custom Logs"
 *   onLoadLogs={async () => ({ logs: await getCustomLogs() })}
 *   showControls={true}
 *   showStreaming={false}
 * />
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { FileText, Download, Search, Play, Pause, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

interface LogEntry {
  timestamp: string
  level: string
  message: string
  source?: string
}

interface LogViewerProps {
  // Data source configuration
  serviceId?: string
  podName?: string
  namespace?: string
  containers?: string[]
  
  // Display configuration
  title?: string
  description?: string
  showControls?: boolean
  showStreaming?: boolean
  showExport?: boolean
  showSearch?: boolean
  showLevelFilter?: boolean
  
  // Initial configuration
  initialTailLines?: number
  initialContainer?: string
  
  // Custom data loading functions
  onLoadLogs?: (params: { 
    serviceId?: string
    podName?: string
    namespace?: string
    container?: string
    tailLines?: number 
  }) => Promise<{ logs: string; error?: string }>
  
  // WebSocket streaming configuration
  streamingUrl?: string | ((params: { 
    serviceId?: string
    podName?: string
    namespace?: string
    container?: string 
  }) => string)
  
  // External logs data (for simple use cases)
  logs?: string
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
}

export function LogViewer({
  serviceId,
  podName,
  namespace,
  containers = [],
  title = "日志查看器",
  description = "查看实时日志",
  showControls = true,
  showStreaming = true,
  showExport = true,
  showSearch = true,
  showLevelFilter = true,
  initialTailLines = 100,
  initialContainer,
  onLoadLogs,
  streamingUrl,
  logs: externalLogs,
  loading: externalLoading = false,
  error: externalError = null,
  onRefresh
}: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [selectedContainer, setSelectedContainer] = useState<string>(
    initialContainer || containers[0] || ''
  )
  const [isStreaming, setIsStreaming] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [logLevel, setLogLevel] = useState<string>('all')
  const [tailLines, setTailLines] = useState(initialTailLines)
  const [autoScroll, setAutoScroll] = useState(true)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [internalLoading, setInternalLoading] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Use external state if provided, otherwise use internal state
  const isLoading = externalLoading || internalLoading
  const error = externalError || internalError
  const hasExternalLogs = externalLogs !== undefined

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [autoScroll])

  useEffect(() => {
    scrollToBottom()
  }, [filteredLogs, scrollToBottom])

  // 过滤日志
  useEffect(() => {
    let filtered = logs

    // 按搜索词过滤
    if (searchTerm && showSearch) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.level.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 按日志级别过滤
    if (logLevel !== 'all' && showLevelFilter) {
      filtered = filtered.filter(log => 
        log.level.toLowerCase() === logLevel.toLowerCase()
      )
    }

    setFilteredLogs(filtered)
  }, [logs, searchTerm, logLevel, showSearch, showLevelFilter])

  // 解析日志行
  const parseLogLines = useCallback((logText: string): LogEntry[] => {
    return logText.split('\n')
      .filter(line => line.trim())
      .map(parseLogLine)
      .filter(Boolean) as LogEntry[]
  }, [])

  // 智能解析日志行 - 用于外部日志，避免拆分多行日志条目
  const parseLogLinesSmarter = useCallback((logText: string): LogEntry[] => {
    const lines = logText.split('\n').filter(line => line.trim())
    const entries: LogEntry[] = []
    let currentEntry: LogEntry | null = null
    
    for (const line of lines) {
      // 检查是否是新的日志条目的开始（通常以时间戳开始）
      const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*[Z]?)/)
      const isNewEntry = timestampMatch || 
                        line.match(/^\d{4}\/\d{2}\/\d{2}/) || // 2024/12/11 格式
                        line.match(/^\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/) || // Dec 11 15:30:45 格式
                        line.match(/^\[\d{4}-\d{2}-\d{2}/) // [2024-12-11] 格式
      
      if (isNewEntry) {
        // 保存之前的条目
        if (currentEntry) {
          entries.push(currentEntry)
        }
        
        // 开始新的条目
        currentEntry = parseLogLine(line)
      } else if (currentEntry) {
        // 这是多行日志的续行，添加到当前条目
        currentEntry.message += '\n' + line
      } else {
        // 没有当前条目，创建一个新的
        currentEntry = parseLogLine(line)
      }
    }
    
    // 添加最后一个条目
    if (currentEntry) {
      entries.push(currentEntry)
    }
    
    return entries
  }, [])

  const parseLogLine = useCallback((line: string): LogEntry | null => {
    if (!line.trim()) return null

    // 尝试解析结构化日志 (JSON)
    try {
      const parsed = JSON.parse(line)
      return {
        timestamp: parsed.timestamp || parsed.time || new Date().toISOString(),
        level: parsed.level || parsed.severity || 'INFO',
        message: parsed.message || parsed.msg || line,
        source: parsed.logger || parsed.component
      }
    } catch {
      // 解析普通文本日志
      const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*[Z]?)/)
      const levelMatch = line.match(/\b(DEBUG|INFO|WARN|WARNING|ERROR|FATAL|TRACE)\b/i)
      
      return {
        timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
        level: levelMatch ? levelMatch[1].toUpperCase() : 'INFO',
        message: line,
      }
    }
  }, [])

  // 获取历史日志
  const fetchLogs = useCallback(async () => {
    if (hasExternalLogs) {
      // Use external logs data
      if (externalLogs) {
        const parsedLogs = parseLogLinesSmarter(externalLogs)
        setLogs(parsedLogs)
      } else {
        setLogs([])
      }
      return
    }

    if (!onLoadLogs) {
      console.warn('LogViewer: No onLoadLogs function provided')
      return
    }

    try {
      setInternalLoading(true)
      setInternalError(null)
      
      const result = await onLoadLogs({
        serviceId,
        podName,
        namespace,
        container: selectedContainer,
        tailLines
      })

      if (result.error) {
        setLogs([])
        setInternalError(result.error)
        toast.error("获取日志失败", {
          description: result.error
        })
      } else {
        const parsedLogs = parseLogLines(result.logs || '')
        setLogs(parsedLogs)
        setInternalError(null)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      const message = error instanceof Error ? error.message : '获取日志失败'
      setInternalError(message)
      toast.error("获取日志失败", {
        description: message
      })
    } finally {
      setInternalLoading(false)
    }
  }, [
    hasExternalLogs, 
    externalLogs, 
    onLoadLogs, 
    serviceId, 
    podName, 
    namespace, 
    selectedContainer, 
    tailLines,
    parseLogLines,
    parseLogLinesSmarter
  ])

  // 开始流式日志
  const startStreaming = useCallback(() => {
    if (!showStreaming || !streamingUrl) return

    if (ws) {
      ws.close()
    }

    const wsUrl = typeof streamingUrl === 'function' 
      ? streamingUrl({ serviceId, podName, namespace, container: selectedContainer })
      : streamingUrl

    const websocket = new WebSocket(wsUrl)

    websocket.onopen = () => {
      setIsStreaming(true)
      setWs(websocket)
      toast.success("开始流式日志", {
        description: "正在实时获取日志"
      })
    }

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'log_line') {
          const logEntry = parseLogLine(data.line)
          if (logEntry) {
            setLogs(prev => [...prev, logEntry])
          }
        }
      } catch (error) {
        console.error('Failed to parse log message:', error)
      }
    }

    websocket.onclose = () => {
      setIsStreaming(false)
      setWs(null)
    }

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
      toast.error("流式日志错误", {
        description: "无法建立实时日志连接"
      })
    }
  }, [showStreaming, streamingUrl, ws, serviceId, podName, namespace, selectedContainer, parseLogLine])

  // 停止流式日志
  const stopStreaming = useCallback(() => {
    if (ws) {
      ws.close()
    }
  }, [ws])

  // 清空日志
  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  // 导出日志
  const exportLogs = useCallback(() => {
    if (!showExport) return

    const logText = filteredLogs.map(log => 
      `[${log.timestamp}] ${log.level}: ${log.message}`
    ).join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const filename = podName 
      ? `${podName}-${selectedContainer}-logs-${new Date().toISOString().split('T')[0]}.txt`
      : `service-${serviceId}-logs-${new Date().toISOString().split('T')[0]}.txt`
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [showExport, filteredLogs, podName, selectedContainer, serviceId])

  // 获取日志级别颜色
  const getLevelColor = useCallback((level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
      case 'FATAL':
        return 'text-red-600 bg-red-50'
      case 'WARN':
      case 'WARNING':
        return 'text-yellow-600 bg-yellow-50'
      case 'INFO':
        return 'text-blue-600 bg-blue-50'
      case 'DEBUG':
      case 'TRACE':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }, [])

  // 处理刷新
  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh()
    } else {
      fetchLogs()
    }
  }, [onRefresh, fetchLogs])

  // 初始加载
  useEffect(() => {
    if (selectedContainer || !containers.length) {
      fetchLogs()
    }
  }, [selectedContainer, tailLines, fetchLogs, containers.length])

  // 处理外部日志数据变化
  useEffect(() => {
    if (hasExternalLogs && externalLogs) {
      // For external logs, we need to be more careful about parsing
      // Split by lines but try to group related lines together
      const parsedLogs = parseLogLinesSmarter(externalLogs)
      setLogs(parsedLogs)
    } else if (hasExternalLogs && !externalLogs) {
      setLogs([])
    }
  }, [hasExternalLogs, externalLogs, parseLogLinesSmarter])

  return (
    <div className="space-y-4">
      {/* 控制面板 */}
      {showControls && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {title}
            </CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 容器选择和基本控制 */}
            <div className="flex items-center gap-4 flex-wrap">
              {containers.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label>容器:</Label>
                  <Select value={selectedContainer} onValueChange={setSelectedContainer}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {containers.map((container) => (
                        <SelectItem key={container} value={container}>
                          {container}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Label>行数:</Label>
                <Input
                  type="number"
                  value={tailLines}
                  onChange={(e) => setTailLines(parseInt(e.target.value) || 100)}
                  className="w-20"
                  min="1"
                  max="10000"
                />
              </div>

              <div className="flex items-center gap-2">
                {showStreaming && streamingUrl && (
                  <>
                    {!isStreaming ? (
                      <Button onClick={startStreaming} size="sm">
                        <Play className="h-4 w-4 mr-1" />
                        开始流式
                      </Button>
                    ) : (
                      <Button onClick={stopStreaming} size="sm" variant="destructive">
                        <Pause className="h-4 w-4 mr-1" />
                        停止流式
                      </Button>
                    )}
                  </>
                )}
                
                <Button onClick={handleRefresh} size="sm" variant="outline" disabled={isLoading}>
                  <RotateCcw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
                
                <Button onClick={clearLogs} size="sm" variant="outline">
                  清空
                </Button>
              </div>
            </div>

            {/* 过滤和搜索 */}
            {(showSearch || showLevelFilter || showExport) && (
              <div className="flex items-center gap-4 flex-wrap">
                {showSearch && (
                  <div className="flex items-center gap-2 flex-1 min-w-64">
                    <Search className="h-4 w-4" />
                    <Input
                      placeholder="搜索日志内容..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                )}

                {showLevelFilter && (
                  <div className="flex items-center gap-2">
                    <Label>级别:</Label>
                    <Select value={logLevel} onValueChange={setLogLevel}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="error">ERROR</SelectItem>
                        <SelectItem value="warn">WARN</SelectItem>
                        <SelectItem value="info">INFO</SelectItem>
                        <SelectItem value="debug">DEBUG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    checked={autoScroll}
                    onCheckedChange={setAutoScroll}
                  />
                  <Label>自动滚动</Label>
                </div>

                {showExport && (
                  <Button onClick={exportLogs} size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-1" />
                    导出
                  </Button>
                )}
              </div>
            )}

            {/* 状态信息 */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>总计: {logs.length} 条</span>
              <span>显示: {filteredLogs.length} 条</span>
              {isStreaming && (
                <Badge variant="outline" className="bg-green-50">
                  实时流式中
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 日志显示区域 */}
      <Card>
        <CardContent className="p-0">
          <div className="h-96 overflow-y-auto font-mono text-sm">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <RotateCcw className="h-4 w-4 animate-spin mr-2" />
                日志加载中...
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-red-500 p-4">
                <div className="text-center">
                  <p className="mb-2">加载日志失败</p>
                  <p className="text-sm text-red-400">{error}</p>
                  <Button 
                    onClick={handleRefresh} 
                    size="sm" 
                    variant="outline" 
                    className="mt-2"
                  >
                    重试
                  </Button>
                </div>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                暂无日志数据
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredLogs.map((log, index) => (
                  <div
                    key={`${log.timestamp}-${index}`}
                    className="flex items-start gap-2 p-2 hover:bg-muted/50 rounded text-xs"
                  >
                    <span className="text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getLevelColor(log.level)} whitespace-nowrap`}
                    >
                      {log.level}
                    </Badge>
                    {log.source && (
                      <span className="text-muted-foreground whitespace-nowrap">
                        [{log.source}]
                      </span>
                    )}
                    <span className="flex-1 break-all whitespace-pre-wrap">
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}