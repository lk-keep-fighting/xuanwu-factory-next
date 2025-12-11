'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Folder, Server, Box } from 'lucide-react'

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
  age?: string
}

interface ProjectServicePodSelectorProps {
  onSelectionChange: (selection: {
    project: Project | null
    service: Service | null
    pod: Pod | null
  }) => void
}

export function ProjectServicePodSelector({ onSelectionChange }: ProjectServicePodSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [pods, setPods] = useState<Pod[]>([])
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null)
  
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingServices, setLoadingServices] = useState(false)
  const [loadingPods, setLoadingPods] = useState(false)

  // 获取项目列表
  const fetchProjects = async () => {
    setLoadingProjects(true)
    try {
      const response = await fetch('/api/projects')
      if (!response.ok) throw new Error('Failed to fetch projects')
      
      const data = await response.json()
      setProjects(data)
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoadingProjects(false)
    }
  }

  // 获取服务列表
  const fetchServices = async (projectId: string) => {
    setLoadingServices(true)
    try {
      const response = await fetch(`/api/services?project_id=${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch services')
      
      const data = await response.json()
      setServices(data)
    } catch (error) {
      console.error('Failed to fetch services:', error)
      setServices([])
    } finally {
      setLoadingServices(false)
    }
  }

  // 获取Pod列表
  const fetchPods = async (service: Service, project: Project) => {
    setLoadingPods(true)
    try {
      // 使用项目标识符作为namespace
      const namespace = project.identifier
      const labelSelector = `app=${service.name}`
      
      const response = await fetch(`/api/k8s/pods?namespace=${namespace}&labelSelector=${labelSelector}`)
      if (!response.ok) throw new Error('Failed to fetch pods')
      
      const data = await response.json()
      setPods(data.pods || [])
    } catch (error) {
      console.error('Failed to fetch pods:', error)
      setPods([])
    } finally {
      setLoadingPods(false)
    }
  }

  // 处理项目选择
  const handleProjectSelect = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      setSelectedProject(project)
      setSelectedService(null)
      setSelectedPod(null)
      setServices([])
      setPods([])
      
      fetchServices(projectId)
      onSelectionChange({ project, service: null, pod: null })
    }
  }

  // 处理服务选择
  const handleServiceSelect = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId)
    if (service && selectedProject) {
      setSelectedService(service)
      setSelectedPod(null)
      setPods([])
      
      fetchPods(service, selectedProject)
      onSelectionChange({ project: selectedProject, service, pod: null })
    }
  }

  // 处理Pod选择
  const handlePodSelect = (podName: string) => {
    const pod = pods.find(p => p.name === podName)
    if (pod && selectedProject && selectedService) {
      setSelectedPod(pod)
      onSelectionChange({ project: selectedProject, service: selectedService, pod })
    }
  }

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running': return 'bg-green-500'
      case 'pending': return 'bg-yellow-500'
      case 'failed': return 'bg-red-500'
      case 'succeeded': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  // 获取服务类型颜色
  const getServiceTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'application': return 'bg-blue-100 text-blue-800'
      case 'database': return 'bg-green-100 text-green-800'
      case 'image': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 初始化加载项目
  useEffect(() => {
    fetchProjects()
  }, [])

  return (
    <div className="space-y-6">
      {/* 选择器 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Box className="h-5 w-5" />
            选择调试目标
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 项目选择 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              <label className="text-sm font-medium">项目</label>
              <Button
                onClick={fetchProjects}
                size="sm"
                variant="ghost"
                disabled={loadingProjects}
              >
                <RefreshCw className={`h-3 w-3 ${loadingProjects ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <Select onValueChange={handleProjectSelect} disabled={loadingProjects}>
              <SelectTrigger>
                <SelectValue placeholder={loadingProjects ? "加载项目中..." : "选择项目"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <span>{project.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {project._count.services} 服务
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 服务选择 */}
          {selectedProject && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <label className="text-sm font-medium">服务</label>
                {loadingServices && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              <Select onValueChange={handleServiceSelect} disabled={loadingServices}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingServices ? "加载服务中..." : "选择服务"} />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      <div className="flex items-center gap-2">
                        <span>{service.name}</span>
                        <Badge className={`text-xs ${getServiceTypeColor(service.type)}`}>
                          {service.type}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pod选择 */}
          {selectedService && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4" />
                <label className="text-sm font-medium">Pod</label>
                {loadingPods && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              <Select onValueChange={handlePodSelect} disabled={loadingPods}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingPods ? "加载Pod中..." : "选择Pod"} />
                </SelectTrigger>
                <SelectContent>
                  {pods.map((pod) => (
                    <SelectItem key={pod.name} value={pod.name}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(pod.status)}`} />
                        <span>{pod.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {pod.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {pod.ready}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 选择摘要 */}
      {(selectedProject || selectedService || selectedPod) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">选择摘要</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedProject && (
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">项目:</span>
                  <span>{selectedProject.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {selectedProject.identifier}
                  </Badge>
                </div>
              )}
              
              {selectedService && (
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-green-500" />
                  <span className="font-medium">服务:</span>
                  <span>{selectedService.name}</span>
                  <Badge className={`text-xs ${getServiceTypeColor(selectedService.type)}`}>
                    {selectedService.type}
                  </Badge>
                </div>
              )}
              
              {selectedPod && (
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-purple-500" />
                  <span className="font-medium">Pod:</span>
                  <span>{selectedPod.name}</span>
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedPod.status)}`} />
                  <Badge variant="outline" className="text-xs">
                    {selectedPod.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    重启: {selectedPod.restartCount}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}