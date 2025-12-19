'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Combobox,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxInput,
  ComboboxList,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem
} from '@/components/ui/shadcn-io/combobox'
import { projectSvc } from '@/service/projectSvc'
import { serviceSvc } from '@/service/serviceSvc'
import type { Project, Service, ServiceType, NetworkConfigV2, NetworkPortConfig } from '@/types/project'
import { DEFAULT_DOMAIN_ROOT } from '@/lib/network'
import { Download, Loader2, RefreshCcw, Package, Database, Box, Search } from 'lucide-react'

interface ImportServiceDialogProps {
  projectId: string
  projectIdentifier?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
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

export function ImportServiceDialog({
  projectId,
  projectIdentifier,
  open,
  onOpenChange,
  onImported
}: ImportServiceDialogProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set())
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [servicesLoading, setServicesLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [serviceSearch, setServiceSearch] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceType | 'all'>('all')
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const projectDropdownRef = useRef<HTMLDivElement>(null)

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    setProjectsLoading(true)
    try {
      const data = await projectSvc.getProjects()
      // 过滤掉当前项目
      const filteredProjects = data.filter(p => p.id !== projectId)
      setProjects(filteredProjects)
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载项目列表失败'
      toast.error(message)
      setProjects([])
    } finally {
      setProjectsLoading(false)
    }
  }, [projectId])

  // 加载选中项目的服务列表
  const loadServices = useCallback(async (selectedProjectId: string) => {
    setServicesLoading(true)
    try {
      const data = await serviceSvc.getServicesByProject(selectedProjectId)
      setServices(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载服务列表失败'
      toast.error(message)
      setServices([])
    } finally {
      setServicesLoading(false)
    }
  }, [])

  // 初始化加载项目列表
  useEffect(() => {
    if (open) {
      loadProjects()
    }
  }, [open, loadProjects])

  // 当选择项目时加载服务列表
  useEffect(() => {
    if (selectedProject?.id) {
      loadServices(selectedProject.id)
      setSelectedServices(new Set())
    } else {
      setServices([])
      setSelectedServices(new Set())
    }
  }, [selectedProject, loadServices])

  // 过滤项目列表
  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects
    const keyword = projectSearch.toLowerCase()
    return projects.filter(project => 
      project.name.toLowerCase().includes(keyword) ||
      project.identifier.toLowerCase().includes(keyword) ||
      (project.description && project.description.toLowerCase().includes(keyword))
    )
  }, [projects, projectSearch])

  // 过滤服务列表
  const filteredServices = useMemo(() => {
    // 只处理有ID的服务
    let filtered = services.filter(service => service.id)

    // 按类型过滤
    if (serviceTypeFilter !== 'all') {
      filtered = filtered.filter(service => service.type === serviceTypeFilter)
    }

    // 按搜索关键词过滤
    if (serviceSearch.trim()) {
      const keyword = serviceSearch.toLowerCase()
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(keyword)
      )
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }, [services, serviceTypeFilter, serviceSearch])

  const projectComboboxData = useMemo(() => {
    return filteredProjects
      .filter(project => project.id) // 确保项目有ID
      .map(project => ({
        value: project.id!,
        label: project.name
      }))
  }, [filteredProjects])

  // 处理项目选择
  const handleProjectSelect = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    setSelectedProject(project || null)
    setProjectSearch('')
  }, [projects])

  // 处理服务选择
  const handleServiceToggle = useCallback((serviceId: string) => {
    setSelectedServices(prev => {
      const newSet = new Set(prev)
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId)
      } else {
        newSet.add(serviceId)
      }
      return newSet
    })
  }, [])

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selectedServices.size === filteredServices.length) {
      setSelectedServices(new Set())
    } else {
      setSelectedServices(new Set(filteredServices.map(s => s.id!).filter(Boolean)))
    }
  }, [selectedServices.size, filteredServices])

  // 更新网络配置中的域名设置
  const updateNetworkDomains = useCallback((networkConfig: any, targetProjectIdentifier: string): any => {
    if (!networkConfig || !targetProjectIdentifier) return networkConfig

    // 处理新版本的网络配置 (NetworkConfigV2)
    if (networkConfig.ports && Array.isArray(networkConfig.ports)) {
      const updatedPorts = networkConfig.ports.map((port: NetworkPortConfig) => {
        if (port.domain && port.domain.enabled && port.domain.prefix) {
          // 更新域名配置
          const newHost = `${port.domain.prefix}.${targetProjectIdentifier}.${DEFAULT_DOMAIN_ROOT}`
          return {
            ...port,
            domain: {
              ...port.domain,
              host: newHost
            }
          }
        }
        return port
      })

      return {
        ...networkConfig,
        ports: updatedPorts
      }
    }

    // 处理旧版本的网络配置 (如果有域名相关字段)
    // 这里可以根据实际的旧版本配置结构进行处理
    
    return networkConfig
  }, [])

  // 导入选中的服务
  const handleImport = useCallback(async () => {
    if (!selectedProject || selectedServices.size === 0) return

    setImporting(true)
    try {
      const servicesToImport = services.filter(s => s.id && selectedServices.has(s.id))
      let successCount = 0
      let failCount = 0

      for (const service of servicesToImport) {
        try {
          // 创建服务配置的副本，移除ID和项目相关字段
          const { id, project_id, created_at, updated_at, status, ...serviceConfig } = service
          
          // 处理网络配置中的域名设置
          let updatedNetworkConfig = serviceConfig.network_config
          if (updatedNetworkConfig && projectIdentifier) {
            updatedNetworkConfig = updateNetworkDomains(updatedNetworkConfig, projectIdentifier)
          }
          
          const importedService = {
            ...serviceConfig,
            project_id: projectId,
            name: service.name, // 保持原始服务名称
            status: 'pending' as const,
            network_config: updatedNetworkConfig
          }

          await serviceSvc.createService(importedService)
          successCount++
        } catch (error) {
          console.error(`导入服务 ${service.name} 失败:`, error)
          failCount++
        }
      }

      if (successCount > 0) {
        toast.success(`成功导入 ${successCount} 个服务${failCount > 0 ? `，${failCount} 个失败` : ''}`)
        onImported()
        onOpenChange(false)
      } else {
        toast.error('所有服务导入失败')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败'
      toast.error(message)
    } finally {
      setImporting(false)
    }
  }, [selectedProject, selectedServices, services, projectId, onImported, onOpenChange])

  // 点击外部关闭项目下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setProjectDropdownOpen(false)
      }
    }

    if (projectDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [projectDropdownOpen])

  // 重置状态
  const resetState = useCallback(() => {
    setProjects([])
    setSelectedProject(null)
    setServices([])
    setSelectedServices(new Set())
    setProjectSearch('')
    setServiceSearch('')
    setServiceTypeFilter('all')
    setProjectDropdownOpen(false)
  }, [])

  return (
    <Dialog
      open={open}
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen) {
          resetState()
        }
        onOpenChange(dialogOpen)
      }}
    >
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[1200px] lg:max-w-[1400px]">
        <DialogHeader>
          <DialogTitle>导入服务配置</DialogTitle>
          <DialogDescription>
            从其他项目导入服务配置到当前项目。
            {projectIdentifier ? `导入后将归属项目编号 ${projectIdentifier}` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 项目选择 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>选择源项目</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={loadProjects}
                disabled={projectsLoading}
              >
                {projectsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                刷新
              </Button>
            </div>

            <div className="relative" ref={projectDropdownRef}>
              <button
                type="button"
                className="w-full justify-between gap-3 px-3 py-2 h-auto min-h-[48px] border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              >
                <div className="flex w-full flex-col items-start gap-1 text-left">
                  <span className="w-full truncate text-sm font-semibold text-gray-900">
                    {selectedProject ? selectedProject.name : '选择项目'}
                  </span>
                  <div className="flex w-full items-center gap-2 text-xs text-gray-500">
                    <span className="truncate">
                      {selectedProject 
                        ? `${selectedProject.identifier} - ${selectedProject.description || '无描述'}`
                        : '从其他项目导入服务配置'
                      }
                    </span>
                  </div>
                </div>
              </button>
              
              {projectDropdownOpen && (
                <div className="absolute z-50 w-[420px] mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                  <div className="p-3 border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="搜索项目..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {projectsLoading ? (
                      <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        正在加载项目...
                      </div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        未找到匹配的项目
                      </div>
                    ) : (
                      <div>
                        {filteredProjects.map((project) => (
                          <div
                            key={project.id}
                            className="flex flex-col gap-1 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => {
                              handleProjectSelect(project.id!)
                              setProjectDropdownOpen(false)
                            }}
                          >
                            <span className="text-sm font-medium text-gray-900">
                              {project.name}
                            </span>
                            <span className="text-xs text-gray-500">{project.identifier}</span>
                            {project.description && (
                              <span className="text-[11px] text-gray-400">{project.description}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedProject && (
            <>
              <div className="border-t" />

              {/* 服务筛选 */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="搜索服务..."
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  <Select value={serviceTypeFilter} onValueChange={(value) => setServiceTypeFilter(value as ServiceType | 'all')}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部类型</SelectItem>
                      <SelectItem value="application">Application</SelectItem>
                      <SelectItem value="database">Database</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={filteredServices.length === 0}
                  >
                    {selectedServices.size === filteredServices.length ? '取消全选' : '全选'}
                  </Button>
                  <span className="text-sm text-gray-500">
                    已选择 {selectedServices.size} / {filteredServices.length} 个服务
                  </span>
                </div>
              </div>

              {/* 服务列表 */}
              <div className="rounded-lg border border-gray-200 p-4">
                {servicesLoading ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在加载服务列表...
                  </div>
                ) : filteredServices.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
                    <div className="rounded-md border border-dashed border-gray-200 px-6 py-4">
                      {services.length === 0 ? '该项目暂无服务' : '没有符合条件的服务'}
                    </div>
                  </div>
                ) : (
                  <div className="h-[400px] overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filteredServices.map((service) => {
                        const serviceType = service.type as ServiceType
                        const Icon = SERVICE_TYPE_ICONS[serviceType] || Package
                        const isSelected = service.id ? selectedServices.has(service.id) : false
                        
                        return (
                          <Card 
                            key={service.id} 
                            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                              isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:border-blue-200'
                            }`}
                            onClick={() => service.id && handleServiceToggle(service.id)}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Icon className="h-5 w-5 text-gray-600" />
                                  <CardTitle className="text-base font-semibold text-gray-900">
                                    {service.name}
                                  </CardTitle>
                                </div>
                                <Badge variant="secondary" className="shrink-0">
                                  {SERVICE_TYPE_LABELS[serviceType] || service.type}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                {service.type === 'application' && (
                                  <div className="text-xs text-gray-600">
                                    {(service as any).git_repository && (
                                      <div className="truncate">
                                        📦 {(service as any).git_repository}
                                      </div>
                                    )}
                                    {(service as any).git_branch && (
                                      <div>🌿 {(service as any).git_branch}</div>
                                    )}
                                  </div>
                                )}
                                {service.type === 'database' && (
                                  <div className="text-xs text-gray-600">
                                    <div>🗄️ {(service as any).database_type}</div>
                                    {(service as any).version && (
                                      <div>📋 v{(service as any).version}</div>
                                    )}
                                  </div>
                                )}
                                {service.type === 'image' && (
                                  <div className="text-xs text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded">
                                    {(service as any).image}:{(service as any).tag || 'latest'}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Badge variant="outline" className="text-xs">
                                    {service.status || 'pending'}
                                  </Badge>
                                  {service.created_at && (
                                    <span>
                                      {new Date(service.created_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 导入按钮 */}
              {filteredServices.length > 0 && (
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={importing}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    onClick={handleImport}
                    disabled={selectedServices.size === 0 || importing}
                    className="gap-2"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        导入中...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        导入 {selectedServices.size} 个服务
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}