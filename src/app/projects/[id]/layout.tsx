'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { ArrowLeft, FolderOpen, Package, Database, Box, Settings, MoreVertical, Pencil, Trash2, Plus, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { projectSvc } from '@/service/projectSvc'
import { serviceSvc } from '@/service/serviceSvc'
import { ServiceType } from '@/types/project'
import type { Project, Service } from '@/types/project'
import ServiceCreateForm from '../components/ServiceCreateForm'
import { ImportK8sServiceDialog } from '../components/ImportK8sServiceDialog'

const SERVICE_TYPE_ICONS = {
  [ServiceType.APPLICATION]: Package,
  [ServiceType.DATABASE]: Database,
  [ServiceType.IMAGE]: Box
}

const SERVICE_TYPE_LABELS = {
  [ServiceType.APPLICATION]: 'Application',
  [ServiceType.DATABASE]: 'Database',
  [ServiceType.IMAGE]: 'Image'
}

const IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

const sanitizeIdentifierInput = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+/, '')
    .slice(0, 63)

type ProjectFormState = {
  name: string
  identifier: string
  description: string
}

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

interface ProjectLayoutProps {
  children: React.ReactNode
}

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
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
    if (!projectId) return

    try {
      const data = await projectSvc.getProjectById(projectId)
      setProject(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`加载项目失败：${message}`)
    }
  }, [projectId])

  // 加载服务列表
  const loadServices = useCallback(async () => {
    if (!projectId) return

    try {
      const data = await serviceSvc.getServicesByProject(projectId)
      setServices(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`加载服务失败：${message}`)
    } finally {
      setLoading(false)
    }
  }, [projectId])

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

  // 判断当前是否在项目概览页面
  const isProjectOverview = pathname === `/projects/${projectId}`
  
  // 判断当前是否在服务详情页面
  const currentServiceId = pathname.includes('/services/') 
    ? pathname.split('/services/')[1]?.split('/')[0] 
    : null

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 左侧菜单 */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* 头部 */}
        <div className="p-6 border-b border-gray-200">
          <Button
            variant="ghost"
            onClick={() => router.push('/projects')}
            className="mb-4 gap-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回项目列表
          </Button>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  {project?.name || '加载中...'}
                </h1>
                {project?.identifier && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {project.identifier}
                  </Badge>
                )}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={!project}>
                    <MoreVertical className="w-4 h-4" />
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

            {project && (
              <p className="text-sm text-gray-500">
                {project.description || '暂无项目描述'}
              </p>
            )}
          </div>
        </div>

        {/* 菜单内容 */}
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* 项目概览 */}
              <div>
                <Button
                  variant={isProjectOverview ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3",
                    isProjectOverview && "bg-blue-50 text-blue-700 border-blue-200"
                  )}
                  onClick={() => router.push(`/projects/${projectId}`)}
                >
                  <FolderOpen className="w-4 h-4" />
                  项目概览
                </Button>
              </div>

              <Separator />

              {/* 服务列表 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-medium text-gray-700">服务列表</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1">
                        <Plus className="w-3 h-3" />
                        创建
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
                </div>

                {loading ? (
                  <div className="px-2 py-4 text-sm text-gray-500">加载中...</div>
                ) : services.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-gray-500">暂无服务</div>
                ) : (
                  <div className="space-y-1">
                    {services
                      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
                      .map((service) => {
                        const serviceType = service.type as ServiceType
                        const Icon = SERVICE_TYPE_ICONS[serviceType] || Package
                        const isActive = currentServiceId === service.id
                        
                        return (
                          <Button
                            key={service.id}
                            variant={isActive ? "secondary" : "ghost"}
                            className={cn(
                              "w-full justify-start gap-3 h-auto py-2",
                              isActive && "bg-blue-50 text-blue-700 border-blue-200"
                            )}
                            onClick={() => router.push(`/projects/${projectId}/services/${service.id}`)}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0 text-left">
                              <div className="font-medium truncate">{service.name}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {SERVICE_TYPE_LABELS[serviceType] || service.type}
                              </div>
                            </div>
                          </Button>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* 底部操作 */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setIsImportDialogOpen(true)}
            >
              <Download className="w-4 h-4" />
              从 K8s 导入
            </Button>
          </div>
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
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

          {createServiceType && projectId && (
            <ServiceCreateForm
              projectId={projectId}
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

      {/* 导入 K8s 服务对话框 */}
      {projectId && (
        <ImportK8sServiceDialog
          projectId={projectId}
          projectIdentifier={project?.identifier}
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onImported={loadServices}
        />
      )}
    </div>
  )
}