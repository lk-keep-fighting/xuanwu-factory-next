'use client'

import { useState, useEffect } from 'react'
import { Network, ArrowRight, Activity, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

interface ApiCall {
  id: string
  source: string
  target: string
  method: string
  path: string
  status: number
  responseTime: number
  timestamp: string
  count: number
}

interface ServiceConnection {
  source: string
  target: string
  callCount: number
  avgResponseTime: number
  errorRate: number
  lastCall: string
}

interface ServiceApiAnalysisProps {
  project: Project | null
  services: Service[]
}

export function ServiceApiAnalysis({ project, services }: ServiceApiAnalysisProps) {
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([])
  const [connections, setConnections] = useState<ServiceConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h')

  // 加载API调用数据
  const loadApiAnalysis = async () => {
    if (!project) return

    try {
      setLoading(true)
      
      // 模拟API调用数据 - 实际应该从监控系统获取
      const mockApiCalls: ApiCall[] = [
        {
          id: '1',
          source: 'frontend',
          target: 'api-gateway',
          method: 'GET',
          path: '/api/users',
          status: 200,
          responseTime: 45,
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          count: 156
        },
        {
          id: '2',
          source: 'api-gateway',
          target: 'user-service',
          method: 'GET',
          path: '/users',
          status: 200,
          responseTime: 23,
          timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          count: 156
        },
        {
          id: '3',
          source: 'user-service',
          target: 'database',
          method: 'SELECT',
          path: 'users table',
          status: 200,
          responseTime: 12,
          timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          count: 156
        },
        {
          id: '4',
          source: 'frontend',
          target: 'api-gateway',
          method: 'POST',
          path: '/api/orders',
          status: 500,
          responseTime: 2000,
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          count: 12
        }
      ]

      // 计算服务连接关系
      const connectionMap = new Map<string, ServiceConnection>()
      
      mockApiCalls.forEach(call => {
        const key = `${call.source}->${call.target}`
        const existing = connectionMap.get(key)
        
        if (existing) {
          existing.callCount += call.count
          existing.avgResponseTime = (existing.avgResponseTime + call.responseTime) / 2
          existing.errorRate = call.status >= 400 ? existing.errorRate + 1 : existing.errorRate
          if (new Date(call.timestamp) > new Date(existing.lastCall)) {
            existing.lastCall = call.timestamp
          }
        } else {
          connectionMap.set(key, {
            source: call.source,
            target: call.target,
            callCount: call.count,
            avgResponseTime: call.responseTime,
            errorRate: call.status >= 400 ? 1 : 0,
            lastCall: call.timestamp
          })
        }
      })

      setApiCalls(mockApiCalls)
      setConnections(Array.from(connectionMap.values()))
      
    } catch (error) {
      console.error('Failed to load API analysis:', error)
      toast.error('加载API分析数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (project) {
      loadApiAnalysis()
    }
  }, [project, selectedTimeRange])

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600'
    if (status >= 300 && status < 400) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getResponseTimeColor = (ms: number) => {
    if (ms < 100) return 'text-green-600'
    if (ms < 500) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (!project) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Network className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">请先选择一个项目查看API调用分析</p>
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
              <Network className="h-5 w-5" />
              API调用分析
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="15m">最近15分钟</option>
                <option value="1h">最近1小时</option>
                <option value="6h">最近6小时</option>
                <option value="24h">最近24小时</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadApiAnalysis}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{connections.length}</div>
              <div className="text-sm text-gray-500">服务连接</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {apiCalls.reduce((sum, call) => sum + call.count, 0)}
              </div>
              <div className="text-sm text-gray-500">总调用次数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {Math.round(apiCalls.reduce((sum, call) => sum + call.responseTime, 0) / apiCalls.length) || 0}ms
              </div>
              <div className="text-sm text-gray-500">平均响应时间</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {apiCalls.filter(call => call.status >= 400).length}
              </div>
              <div className="text-sm text-gray-500">错误调用</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="topology" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="topology">服务拓扑</TabsTrigger>
          <TabsTrigger value="calls">API调用</TabsTrigger>
          <TabsTrigger value="performance">性能分析</TabsTrigger>
        </TabsList>

        <TabsContent value="topology">
          <Card>
            <CardHeader>
              <CardTitle>服务调用拓扑图</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {connections.map((connection, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{connection.source}</Badge>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <Badge variant="outline">{connection.target}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{connection.callCount}</div>
                        <div className="text-gray-500">调用次数</div>
                      </div>
                      <div className="text-center">
                        <div className={`font-medium ${getResponseTimeColor(connection.avgResponseTime)}`}>
                          {formatResponseTime(connection.avgResponseTime)}
                        </div>
                        <div className="text-gray-500">平均响应</div>
                      </div>
                      <div className="text-center">
                        <div className={`font-medium ${connection.errorRate > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {connection.errorRate}
                        </div>
                        <div className="text-gray-500">错误次数</div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {connections.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Network className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>暂无服务调用数据</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle>API调用详情</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {apiCalls.map((call) => (
                  <div key={call.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="font-mono">
                        {call.method}
                      </Badge>
                      <div>
                        <div className="font-medium">{call.path}</div>
                        <div className="text-sm text-gray-500">
                          {call.source} → {call.target}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className={`font-medium ${getStatusColor(call.status)}`}>
                          {call.status}
                        </div>
                        <div className="text-gray-500">状态</div>
                      </div>
                      <div className="text-center">
                        <div className={`font-medium ${getResponseTimeColor(call.responseTime)}`}>
                          {formatResponseTime(call.responseTime)}
                        </div>
                        <div className="text-gray-500">响应时间</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{call.count}</div>
                        <div className="text-gray-500">调用次数</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-600">
                          {formatTimestamp(call.timestamp)}
                        </div>
                        <div className="text-gray-500">最后调用</div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {apiCalls.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>暂无API调用数据</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>性能分析</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 响应时间分析 */}
                <div>
                  <h4 className="font-medium mb-3">响应时间分析</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">快速响应 (&lt;100ms)</span>
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {apiCalls.filter(call => call.responseTime < 100).length}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span className="text-sm font-medium">中等响应 (100-500ms)</span>
                      </div>
                      <div className="text-2xl font-bold text-yellow-600">
                        {apiCalls.filter(call => call.responseTime >= 100 && call.responseTime < 500).length}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-medium">慢响应 (&gt;500ms)</span>
                      </div>
                      <div className="text-2xl font-bold text-red-600">
                        {apiCalls.filter(call => call.responseTime >= 500).length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 错误分析 */}
                <div>
                  <h4 className="font-medium mb-3">错误分析</h4>
                  <div className="space-y-2">
                    {apiCalls
                      .filter(call => call.status >= 400)
                      .map((call) => (
                        <div key={call.id} className="flex items-center justify-between p-3 border border-red-200 bg-red-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            <div>
                              <div className="font-medium text-red-900">
                                {call.method} {call.path}
                              </div>
                              <div className="text-sm text-red-700">
                                {call.source} → {call.target}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <Badge variant="destructive">{call.status}</Badge>
                            <span className="text-red-700">{call.count} 次错误</span>
                          </div>
                        </div>
                      ))}
                    
                    {apiCalls.filter(call => call.status >= 400).length === 0 && (
                      <div className="text-center py-4 text-green-600">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>暂无错误调用</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}