'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bug, Network, Activity, FileText, Terminal, Settings, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { projectSvc } from '@/service/projectSvc'
import { serviceSvc } from '@/service/serviceSvc'
import { ProjectServiceSelector } from './ProjectServiceSelector'
import { ServiceDebugTabs } from './ServiceDebugTabs'
import { ServiceApiAnalysis } from './ServiceApiAnalysis'
import { AggregatedLogViewer } from './AggregatedLogViewer'
import { ProjectMetricsOverview } from './ProjectMetricsOverview'

interface Project {
  id: string
  name: string
  identifier: string
  description?: string
  _count: {
    services: number
  }
}

interface Service {
  id: string
  name: string
  type: string
  status?: string
  project_id: string
}

export function ProjectDebugPanel() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // 加载项目的服务列表
  const loadServices = useCallback(async (projectId: string) => {
    if (!projectId) return

    try {
      setLoading(true)
      const data = await serviceSvc.getServicesByProject(projectId)
      setServices(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载服务失败'
      toast.error(message)
      setServices([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 处理项目选择
  const handleProjectSelect = useCallback((project: Project | null) => {
    setSelectedProject(project)
    setSelectedService(null)
    setServices([])
    
    if (project) {
      loadServices(project.id)
    }
  }, [loadServices])

  // 处理服务选择
  const handleServiceSelect = useCallback((service: Service | null) => {
    setSelectedService(service)
  }, [])

  // 刷新服务状态
  const refreshServiceStatus = useCallback(async () => {
    if (!selectedProject) return

    try {
      setRefreshing(true)
      await loadServices(selectedProject.id)
      toast.success('服务状态已刷新')
    } catch (error) {
      toast.error('刷新失败')
    } finally {
      setRefreshing(false)
    }
  }, [selectedProject, loadServices])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Bug className="h-8 w-8 text-blue-600" />
              项目调试中心
            </h1>
            <p className="text-muted-foreground mt-2">
              选择项目进行调试，分析服务间API调用关系，聚合日志统一监控
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50">
              玄武AI 集成
            </Badge>
            {selectedProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={refreshServiceStatus}
                disabled={refreshing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                刷新状态
              </Button>
            )}
          </div>
        </div>

        {/* 项目选择 */}
        <Card>
          <CardHeader>
            <CardTitle>项目选择</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectServiceSelector
              onProjectSelect={handleProjectSelect}
              onServiceSelect={handleServiceSelect}
              selectedProject={selectedProject}
              selectedService={selectedService}
              services={services}
              loading={loading}
            />
          </CardContent>
        </Card>

        {/* 调试工具标签页 */}
        {selectedProject && (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                项目概览
              </TabsTrigger>
              <TabsTrigger value="service" className="flex items-center gap-2" disabled={!selectedService}>
                <Terminal className="h-4 w-4" />
                服务调试
              </TabsTrigger>
              <TabsTrigger value="api-analysis" className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                API分析
              </TabsTrigger>
              <TabsTrigger value="aggregated-logs" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                聚合日志
              </TabsTrigger>
              <TabsTrigger value="metrics" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                性能监控
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>项目调试概览</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedProject ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Bug className="h-5 w-5 text-blue-600" />
                            <span className="font-medium">当前项目</span>
                          </div>
                          <p className="text-sm font-semibold">{selectedProject.name}</p>
                          <p className="text-xs text-gray-500">{selectedProject.identifier}</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Network className="h-5 w-5 text-green-600" />
                            <span className="font-medium">服务总数</span>
                          </div>
                          <p className="text-2xl font-bold">{services.length}</p>
                          <p className="text-xs text-gray-500">运行中: {services.filter(s => s.status === 'running').length}</p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Activity className="h-5 w-5 text-purple-600" />
                            <span className="font-medium">调试状态</span>
                          </div>
                          <p className="text-sm font-semibold">{selectedService ? '已选择服务' : '未选择服务'}</p>
                          <p className="text-xs text-gray-500">{selectedService ? selectedService.name : '请选择服务'}</p>
                        </div>
                      </div>

                      {services.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-3">服务列表</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {services.map((service) => (
                              <div
                                key={service.id}
                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                  selectedService?.id === service.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => handleServiceSelect(service)}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{service.name}</span>
                                  <Badge variant="outline" className="text-xs">{service.type}</Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className={`w-2 h-2 rounded-full ${
                                    service.status === 'running' ? 'bg-green-500' :
                                    service.status === 'pending' ? 'bg-yellow-500' :
                                    service.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                                  }`}></div>
                                  <span className="text-xs text-gray-500">{service.status || '未知'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>请先在上方选择一个项目开始调试</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="service">
              {selectedService ? (
                <ServiceDebugTabs
                  project={selectedProject}
                  service={selectedService}
                />
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Terminal className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">请先选择一个服务进行调试</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="api-analysis">
              <ServiceApiAnalysis
                project={selectedProject}
                services={services}
              />
            </TabsContent>

            <TabsContent value="aggregated-logs">
              <AggregatedLogViewer
                project={selectedProject}
                services={services}
              />
            </TabsContent>

            <TabsContent value="metrics">
              <ProjectMetricsOverview
                project={selectedProject}
                services={services}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}