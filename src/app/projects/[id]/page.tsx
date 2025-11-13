'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Package, Database, Box, Filter, Search, MoreVertical, Play, Square, Trash2, Tag, Pencil, Download } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { projectSvc } from '@/service/projectSvc'
import { serviceSvc } from '@/service/serviceSvc'
import { ServiceType } from '@/types/project'
import type { ApplicationService, DatabaseService, ImageService, Project, Service } from '@/types/project'
import ServiceCreateForm from '../components/ServiceCreateForm'
import { ImportK8sServiceDialog } from '../components/ImportK8sServiceDialog'

const SERVICE_TYPE_ICONS = {
  [ServiceType.APPLICATION]: Package,
  [ServiceType.DATABASE]: Database,
  [ServiceType.IMAGE]: Box
} satisfies Record<ServiceType, LucideIcon>

const SERVICE_TYPE_LABELS = {
  [ServiceType.APPLICATION]: 'Application',
  [ServiceType.DATABASE]: 'Database',
  [ServiceType.IMAGE]: 'Image'
} satisfies Record<ServiceType, string>

const UNKNOWN_SERVICE_TYPE_LABEL = '未知服务类型'

const SERVICE_TYPE_VALUES = new Set<ServiceType>(Object.values(ServiceType))

const normalizeServiceType = (value: ServiceType | string | null | undefined): ServiceType | null => {
  if (!value) {
    return null
  }

  const normalized = String(value).trim().toLowerCase() as ServiceType
  return SERVICE_TYPE_VALUES.has(normalized) ? normalized : null
}

const isApplicationService = (
  service: Service,
  type: ServiceType | null
): service is ApplicationService => type === ServiceType.APPLICATION

const isDatabaseService = (
  service: Service,
  type: ServiceType | null
): service is DatabaseService => type === ServiceType.DATABASE

const isImageService = (
  service: Service,
  type: ServiceType | null
): service is ImageService => type === ServiceType.IMAGE

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-500',
  pending: 'bg-yellow-500',
  stopped: 'bg-gray-500',
  error: 'bg-red-500'
}

const STATUS_LABELS: Record<string, string> = {
  running: '运行中',
  pending: '待启动',
  stopped: '已停止',
  error: '错误'
}

type ProjectFormState = {
  name: string
  identifier: string
  description: string
}

const IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

const sanitizeIdentifierInput = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+/, '')
    .slice(0, 63)

const validateProjectForm = (form: ProjectFormState): string | null => {
  if (!form.name.trim()) {
    return '请输入项目名称'
  }

  if (!form.identifier.trim()) {
    return '请输入项目编号'
  }

  if (!IDENTIFIER_PATTERN.test(form.identifier.trim())) {
    return '项目编号需由小写字母、数字或中划线组成，且不能以中划线开头或结尾'
  }

  return null
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedType, setSelectedType] = useState<ServiceType | 'all'>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createServiceType, setCreateServiceType] = useState<ServiceType | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [projectForm, setProjectForm] = useState<ProjectFormState>({
    name: '',
    identifier: '',
    description: ''
  })
  const [updatingProject, setUpdatingProject] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)

  // 加载项目信息
  const loadProject = useCallback(async () => {
    if (!id) return

    try {
      const data = await projectSvc.getProjectById(id)
      setProject(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`加载项目失败：${message}`)
    }
  }, [id])

  // 加载服务列表
  const loadServices = useCallback(async () => {
    if (!id) return

    try {
      setLoading(true)
      const data = await serviceSvc.getServicesByProject(id)
      setServices(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`加载服务失败：${message}`)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadProject()
    loadServices()
  }, [loadProject, loadServices])

  // 打开创建服务对话框
  const handleOpenCreateDialog = (type: ServiceType) => {
    setCreateServiceType(type)
    setIsCreateDialogOpen(true)
  }

  const openProjectEditDialog = () => {
    if (!project) return
    setProjectForm({
      name: project.name,
      identifier: project.identifier,
      description: project.description || ''
    })
    setIsProjectDialogOpen(true)
  }

  const handleProjectUpdate = async () => {
    if (!project?.id) return

    const validationError = validateProjectForm(projectForm)
    if (validationError) {
      toast.error(validationError)
      return
    }

    try {
      setUpdatingProject(true)
      const updated = await projectSvc.updateProject(project.id, {
        name: projectForm.name.trim(),
        identifier: projectForm.identifier.trim(),
        description: projectForm.description.trim()
      })
      if (updated) {
        setProject(updated)
      }
      toast.success('项目信息已更新')
      setIsProjectDialogOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`更新项目失败：${message}`)
    } finally {
      setUpdatingProject(false)
    }
  }

  const handleProjectDelete = async () => {
    if (!project?.id) return
    if (!confirm(`确定要删除项目「${project.name}」吗？此操作将删除其下的所有服务。`)) return

    try {
      setDeletingProject(true)
      await projectSvc.deleteProject(project.id)
      toast.success('项目已删除')
      router.push('/projects')
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`删除项目失败：${message}`)
    } finally {
      setDeletingProject(false)
    }
  }

  // 删除服务
  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('确定要删除这个服务吗？')) return

    try {
      const result = await serviceSvc.deleteService(serviceId)
      toast.success(result.message || '服务删除成功')
      if (result.warning) {
        toast.warning(result.warning)
      }
      loadServices()
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`删除服务失败：${message}`)
    }
  }

  // 过滤服务
  const filteredServices = services.filter((service) => {
    const normalizedType = normalizeServiceType(service.type)
    const matchesSearch = service.name.toLowerCase().includes(searchKeyword.toLowerCase())
    const matchesType = selectedType === 'all' || normalizedType === selectedType
    return matchesSearch && matchesType
  })

  // 统计服务数量
  const serviceTypeCounts: Record<ServiceType, number> = {
    [ServiceType.APPLICATION]: 0,
    [ServiceType.DATABASE]: 0,
    [ServiceType.IMAGE]: 0
  }

  services.forEach((service) => {
    const normalizedType = normalizeServiceType(service.type)
    if (normalizedType) {
      serviceTypeCounts[normalizedType] += 1
    }
  })

  const serviceStats = {
    total: services.length,
    application: serviceTypeCounts[ServiceType.APPLICATION],
    database: serviceTypeCounts[ServiceType.DATABASE],
    image: serviceTypeCounts[ServiceType.IMAGE]
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面头部 */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/projects')}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回项目列表
          </Button>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-[240px]">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold text-gray-900">{project?.name}</h1>
                  {project?.identifier && (
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs font-medium">
                      <Tag className="w-3 h-3" />
                      {project.identifier}
                    </Badge>
                  )}
                </div>
                {project && (
                  project.description ? (
                    <p className="text-gray-500 mt-2">{project.description}</p>
                  ) : (
                    <p className="text-gray-400 mt-2">暂无项目描述</p>
                  )
                )}
              </div>

              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="w-4 h-4" />
                      创建服务
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenCreateDialog(ServiceType.APPLICATION)}>
                      <Package className="w-4 h-4 mr-2" />
                      Application
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenCreateDialog(ServiceType.DATABASE)}>
                      <Database className="w-4 h-4 mr-2" />
                      Database
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenCreateDialog(ServiceType.IMAGE)}>
                      <Box className="w-4 h-4 mr-2" />
                      Image
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setIsImportDialogOpen(true)}
                >
                  <Download className="w-4 h-4" />
                  从 K8s 导入
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2" disabled={!project}>
                      <MoreVertical className="w-4 h-4" />
                      项目操作
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={openProjectEditDialog} disabled={!project}>
                      <Pencil className="w-4 h-4 mr-2" />
                      编辑项目
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={handleProjectDelete}
                      disabled={!project || deletingProject}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      删除项目
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* 服务统计 */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{serviceStats.total}</div>
                <div className="text-sm text-gray-500">总服务数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{serviceStats.application}</div>
                <div className="text-sm text-gray-500">Applications</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{serviceStats.database}</div>
                <div className="text-sm text-gray-500">Databases</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{serviceStats.image}</div>
                <div className="text-sm text-gray-500">Images</div>
              </div>
            </div>
          </div>
        </div>

        {/* 筛选和搜索 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="搜索服务..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-10"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                {selectedType === 'all' ? '全部类型' : SERVICE_TYPE_LABELS[selectedType]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSelectedType('all')}>
                全部类型
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedType(ServiceType.APPLICATION)}>
                <Package className="w-4 h-4 mr-2" />
                Application
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedType(ServiceType.DATABASE)}>
                <Database className="w-4 h-4 mr-2" />
                Database
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedType(ServiceType.IMAGE)}>
                <Box className="w-4 h-4 mr-2" />
                Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 服务列表 */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无服务</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => {
              const normalizedType = normalizeServiceType(service.type)
              const Icon = normalizedType ? SERVICE_TYPE_ICONS[normalizedType] : Package
              const serviceTypeLabel =
                normalizedType
                  ? SERVICE_TYPE_LABELS[normalizedType]
                  : typeof service.type === 'string' && service.type.trim().length
                    ? service.type
                    : UNKNOWN_SERVICE_TYPE_LABEL
              const statusKey =
                typeof service.status === 'string' ? service.status.trim().toLowerCase() : 'pending'
              const statusColor = STATUS_COLORS[statusKey] ?? 'bg-gray-500'
              const statusLabel =
                STATUS_LABELS[statusKey] ??
                (typeof service.status === 'string' && service.status.trim().length
                  ? service.status
                  : '未知状态')
              const applicationService = isApplicationService(service, normalizedType) ? service : null
              const databaseService = isDatabaseService(service, normalizedType) ? service : null
              const imageService = isImageService(service, normalizedType) ? service : null

              return (
                <Card
                  key={service.id}
                  className="hover:shadow-lg transition-all duration-200 cursor-pointer"
                  onClick={() => router.push(`/projects/${id}/services/${service.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Icon className="w-5 h-5 text-gray-700" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{service.name}</h3>
                          <Badge variant="outline" className="mt-1">
                            {serviceTypeLabel}
                          </Badge>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            // TODO: 启动服务
                          }}>
                            <Play className="w-4 h-4 mr-2" />
                            启动
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            // TODO: 停止服务
                          }}>
                            <Square className="w-4 h-4 mr-2" />
                            停止
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (service.id) {
                                void handleDeleteService(service.id)
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">状态</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                          <span className="text-gray-900">{statusLabel}</span>
                        </div>
                      </div>

                      {applicationService && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">仓库</span>


                            <a 
                              href={applicationService.git_repository || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline text-right truncate ml-2 max-w-[250px]" 
                              title={applicationService.git_repository || '-'}
                              onClick={(e) => {
                                if (!applicationService.git_repository) {
                                  e.preventDefault()
                                }
                                e.stopPropagation()
                              }}
                            >
                              {applicationService.git_repository ? applicationService.git_repository.split('/').pop() || applicationService.git_repository : '-'}
                            </a>
                          </div>
                          {/* {applicationService.port && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">端口</span>
                              <span className="text-gray-900">{applicationService.port}</span>
                            </div>
                          )} */}
                        </>
                      )}

                      {databaseService && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">类型</span>
                            <span className="text-gray-900 uppercase">{databaseService.database_type}</span>
                          </div>
                          {databaseService.version && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">版本</span>
                              <span className="text-gray-900">{databaseService.version}</span>
                            </div>
                          )}
                        </>
                      )}

                      {imageService && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">镜像</span>
                          <span className="text-gray-900 truncate ml-2">
                            {imageService.image}
                          </span>
                        </div>
                      )}
                      {imageService && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">标签</span>
                          <span className="text-gray-900 truncate ml-2">
                            {imageService.tag && `${imageService.tag}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* 编辑项目对话框 */}
      <Dialog
        open={isProjectDialogOpen}
        onOpenChange={(open) => {
          setIsProjectDialogOpen(open)
          if (!open && project) {
            setProjectForm({
              name: project.name,
              identifier: project.identifier,
              description: project.description || ''
            })
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑项目信息</DialogTitle>
            <DialogDescription>更新项目的基础信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>项目名称 *</Label>
              <Input
                value={projectForm.name}
                onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="输入项目名称"
              />
            </div>
            <div className="space-y-2">
              <Label>项目编号 *</Label>
              <Input
                value={projectForm.identifier}
                onChange={(e) => setProjectForm((prev) => ({
                  ...prev,
                  identifier: sanitizeIdentifierInput(e.target.value)
                }))}
                placeholder="用于访问的唯一二级域名"
              />
              <p className="text-xs text-gray-500">仅支持小写字母、数字和中划线，长度 1-63 位</p>
            </div>
            <div className="space-y-2">
              <Label>项目描述</Label>
              <Textarea
                value={projectForm.description}
                onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="输入项目描述"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsProjectDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleProjectUpdate} disabled={updatingProject}>
                {updatingProject ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 创建服务对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>创建 {createServiceType && SERVICE_TYPE_LABELS[createServiceType]}</DialogTitle>
            <DialogDescription>配置新服务的参数</DialogDescription>
          </DialogHeader>

          {createServiceType && id && (
            <ServiceCreateForm
              projectId={id}
              projectIdentifier={project?.identifier}
              serviceType={createServiceType}
              onSuccess={() => {
                setIsCreateDialogOpen(false)
                setCreateServiceType(null)
                loadServices()
              }}
              onCancel={() => {
                setIsCreateDialogOpen(false)
                setCreateServiceType(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {id && (
        <ImportK8sServiceDialog
          projectId={id}
          projectIdentifier={project?.identifier}
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onImported={loadServices}
        />
      )}
    </div>
  )
}
