'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Terminal, FileText, Activity, Settings, Play, Square } from 'lucide-react'
import { ProjectServicePodSelector } from './ProjectServicePodSelector'
import { ClaudeCodeTerminal } from './ClaudeCodeTerminal'
import { LogViewer } from '@/components/shared/LogViewer'
import { PodFileExplorer } from './PodFileExplorer'
import { PodMetrics } from './PodMetrics'

interface Project {
  id: string
  name: string
  identifier: string
  _count: {
    services: number
  }
}

interface Service {
  id: string
  name: string
  type: string
  project_id: string
}

interface Pod {
  name: string
  namespace: string
  status: string
  ready: string
  restartCount: number
  containers: string[]
  age?: string // 可选，因为从API获取的Pod可能没有这个字段
}

interface PodDebugPanelProps {
  // 移除旧的props，现在通过选择器来管理
}

export function PodDebugPanel({}: PodDebugPanelProps) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null)
  const [debugSession, setDebugSession] = useState<{
    active: boolean
    podName: string
    container: string
  } | null>(null)

  // 处理选择变化
  const handleSelectionChange = (selection: {
    project: Project | null
    service: Service | null
    pod: Pod | null
  }) => {
    setSelectedProject(selection.project)
    setSelectedService(selection.service)
    setSelectedPod(selection.pod)
    
    // 如果选择了新的Pod，停止当前调试会话
    if (debugSession && selection.pod?.name !== debugSession.podName) {
      stopDebugSession()
    }
  }

  // 启动调试会话
  const startDebugSession = async (pod: Pod, container: string) => {
    if (!selectedProject) return
    
    try {
      const response = await fetch('/api/debug/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podName: pod.name,
          namespace: selectedProject.identifier, // 使用项目标识符作为namespace
          container
        })
      })
      
      if (!response.ok) throw new Error('Failed to start debug session')
      
      const session = await response.json()
      setDebugSession({
        active: true,
        podName: pod.name,
        container
      })
    } catch (error) {
      console.error('Failed to start debug session:', error)
    }
  }

  // 停止调试会话
  const stopDebugSession = async () => {
    if (!debugSession) return
    
    try {
      await fetch('/api/debug/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podName: debugSession.podName,
          container: debugSession.container
        })
      })
    } catch (error) {
      console.error('Failed to stop debug session:', error)
    } finally {
      setDebugSession(null)
    }
  }

  // 移除旧的useEffect和handlePodSelect，现在通过选择器管理

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
      {/* 项目-服务-Pod选择器 */}
      <ProjectServicePodSelector onSelectionChange={handleSelectionChange} />

      {/* 调试会话控制 */}
      {selectedPod && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              调试会话
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {selectedPod.containers.length > 1 && (
                <Select>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="选择容器" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedPod.containers.map((container) => (
                      <SelectItem key={container} value={container}>
                        {container}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {!debugSession?.active ? (
                <Button 
                  onClick={() => startDebugSession(selectedPod, selectedPod.containers[0])}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  启动调试
                </Button>
              ) : (
                <Button 
                  onClick={stopDebugSession}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  停止调试
                </Button>
              )}

              {debugSession?.active && (
                <Badge variant="outline" className="bg-green-50">
                  调试中: {debugSession.podName}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 调试工具标签页 */}
      {selectedPod && (
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
              debugSession={debugSession}
            />
          </TabsContent>

          <TabsContent value="logs">
            <LogViewer 
              podName={selectedPod.name}
              namespace={selectedProject?.identifier || selectedPod.namespace}
              containers={selectedPod.containers}
              title="Pod 日志查看器"
              description="查看Pod实时日志"
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
              debugSession={debugSession}
            />
          </TabsContent>

          <TabsContent value="metrics">
            <PodMetrics 
              pod={selectedPod}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}