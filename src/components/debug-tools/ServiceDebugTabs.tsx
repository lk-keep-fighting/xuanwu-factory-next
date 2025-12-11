'use client'

import { useState, useEffect } from 'react'
import { Terminal, FileText, Settings, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ClaudeCodeTerminal } from './ClaudeCodeTerminal'
import { LogViewer } from '@/components/shared/LogViewer'
import { PodFileExplorer } from './PodFileExplorer'
import { PodMetrics } from './PodMetrics'

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
  project_id: string
}

interface Pod {
  name: string
  namespace: string
  status: string
  ready: string
  restartCount: number
  containers: string[]
  age?: string
}

interface ServiceDebugTabsProps {
  project: Project
  service: Service
}

export function ServiceDebugTabs({ project, service }: ServiceDebugTabsProps) {
  const [pods, setPods] = useState<Pod[]>([])
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null)
  const [loading, setLoading] = useState(false)

  // 加载服务的Pod列表
  useEffect(() => {
    const loadServicePods = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/k8s/pods?namespace=${project.identifier}&labelSelector=app=${service.name}`)
        if (response.ok) {
          const data = await response.json()
          setPods(data.pods || [])
          // 自动选择第一个运行中的Pod
          const runningPod = data.pods?.find((pod: Pod) => pod.status === 'Running')
          setSelectedPod(runningPod || data.pods?.[0] || null)
        }
      } catch (error) {
        console.error('Failed to load service pods:', error)
        setPods([])
        setSelectedPod(null)
      } finally {
        setLoading(false)
      }
    }

    loadServicePods()
  }, [project.identifier, service.name])

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running': return 'bg-green-500'
      case 'pending': return 'bg-yellow-500'
      case 'failed': return 'bg-red-500'
      case 'succeeded': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      {/* 服务信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>服务调试: {service.name}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{service.type}</Badge>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  service.status === 'running' ? 'bg-green-500' :
                  service.status === 'pending' ? 'bg-yellow-500' :
                  service.status === 'error' ? 'bg-red-500' :
                  'bg-gray-500'
                }`}></div>
                <span className="text-sm text-gray-600">{service.status || '未知'}</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">项目</p>
              <p className="font-medium">{project.name}</p>
              <p className="text-xs text-gray-400">{project.identifier}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Pod 数量</p>
              <p className="font-medium">{pods.length}</p>
              <p className="text-xs text-gray-400">
                运行中: {pods.filter(p => p.status === 'Running').length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">当前调试 Pod</p>
              <p className="font-medium">{selectedPod?.name || '未选择'}</p>
              {selectedPod && (
                <p className="text-xs text-gray-400">{selectedPod.status}</p>
              )}
            </div>
          </div>

          {/* Pod 选择器 */}
          {pods.length > 1 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">选择 Pod:</p>
              <div className="flex flex-wrap gap-2">
                {pods.map((pod) => (
                  <button
                    key={pod.name}
                    onClick={() => setSelectedPod(pod)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      selectedPod?.name === pod.name
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(pod.status)}`}></div>
                      <span>{pod.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 调试工具标签页 */}
      {selectedPod ? (
        <Tabs defaultValue="terminal" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="terminal" className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              玄武AI 终端
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              日志查看
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              文件浏览
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              性能监控
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terminal">
            <ClaudeCodeTerminal 
              pod={selectedPod}
              debugSession={null}
            />
          </TabsContent>

          <TabsContent value="logs">
            <LogViewer 
              podName={selectedPod.name}
              namespace={project.identifier}
              containers={selectedPod.containers}
              title={`${service.name} 日志查看器`}
              description={`查看 ${selectedPod.name} 的实时日志`}
              onLoadLogs={async (params) => {
                const searchParams = new URLSearchParams({
                  namespace: params.namespace || '',
                  podName: params.podName || '',
                  container: params.container || '',
                  tailLines: params.tailLines?.toString() || '100'
                })
                const response = await fetch(`/api/k8s/logs?${searchParams}`)
                return await response.json()
              }}
              streamingUrl={(params) => 
                `ws://localhost:3001/api/k8s/logs/stream?namespace=${params.namespace}&podName=${params.podName}&container=${params.container}`
              }
              showStreaming={true}
              showSearch={true}
              showLevelFilter={true}
              showExport={true}
            />
          </TabsContent>

          <TabsContent value="files">
            <PodFileExplorer 
              pod={selectedPod}
              debugSession={null}
            />
          </TabsContent>

          <TabsContent value="metrics">
            <PodMetrics 
              pod={selectedPod}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Terminal className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">
              {loading ? '正在加载 Pod...' : '该服务暂无可用的 Pod'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}