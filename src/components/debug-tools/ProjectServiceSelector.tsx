'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, Loader2, Package, Database, Box } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { projectSvc } from '@/service/projectSvc'

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

interface ProjectServiceSelectorProps {
  onProjectSelect: (project: Project | null) => void
  onServiceSelect: (service: Service | null) => void
  selectedProject: Project | null
  selectedService: Service | null
  services: Service[]
  loading: boolean
}

const SERVICE_TYPE_ICONS = {
  application: Package,
  database: Database,
  image: Box
}

const SERVICE_TYPE_LABELS = {
  application: 'Application',
  database: 'Database',
  image: 'Image'
}

export function ProjectServiceSelector({
  onProjectSelect,
  onServiceSelect,
  selectedProject,
  selectedService,
  services,
  loading
}: ProjectServiceSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    try {
      setProjectsLoading(true)
      const data = await projectSvc.getProjects()
      setProjects(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载项目失败'
      toast.error(message)
      setProjects([])
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // 处理项目选择
  const handleProjectChange = (projectId: string) => {
    const project = projects.find(p => p.id === projectId) || null
    onProjectSelect(project)
    onServiceSelect(null) // 重置服务选择
  }

  // 处理服务选择
  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId) || null
    onServiceSelect(service)
  }

  const getServiceIcon = (type: string) => {
    const Icon = SERVICE_TYPE_ICONS[type as keyof typeof SERVICE_TYPE_ICONS] || Package
    return Icon
  }

  const getServiceTypeLabel = (type: string) => {
    return SERVICE_TYPE_LABELS[type as keyof typeof SERVICE_TYPE_LABELS] || type
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running': return 'bg-green-500'
      case 'pending': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      case 'stopped': return 'bg-gray-500'
      default: return 'bg-gray-400'
    }
  }

  return (
    <div className="space-y-4">
      {/* 项目选择 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">选择项目</label>
          <Select
            value={selectedProject?.id || ''}
            onValueChange={handleProjectChange}
            disabled={projectsLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={projectsLoading ? '加载中...' : '请选择项目'} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-gray-500">{project.identifier}</div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {project._count.services} 服务
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 服务选择 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">选择服务 (可选)</label>
          <Select
            value={selectedService?.id || ''}
            onValueChange={handleServiceChange}
            disabled={!selectedProject || loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                !selectedProject ? '请先选择项目' :
                loading ? '加载中...' :
                services.length === 0 ? '暂无服务' :
                '请选择服务'
              } />
            </SelectTrigger>
            <SelectContent>
              {services.map((service) => {
                const Icon = getServiceIcon(service.type)
                return (
                  <SelectItem key={service.id} value={service.id}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`}></div>
                          <span className="text-xs text-gray-500">
                            {getServiceTypeLabel(service.type)} · {service.status || '未知'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 当前选择状态 */}
      {selectedProject && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-blue-900">
                    {selectedProject.name}
                  </p>
                  <p className="text-sm text-blue-700">
                    命名空间: {selectedProject.identifier}
                  </p>
                </div>
              </div>
              
              {selectedService && (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-medium text-blue-900">
                      {selectedService.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedService.status)}`}></div>
                      <span className="text-xs text-blue-700">
                        {getServiceTypeLabel(selectedService.type)}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-white">
                    已选择
                  </Badge>
                </div>
              )}
            </div>
            
            {selectedProject.description && (
              <p className="text-sm text-blue-700 mt-2">
                {selectedProject.description}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm text-gray-500">加载服务列表...</span>
        </div>
      )}
    </div>
  )
}