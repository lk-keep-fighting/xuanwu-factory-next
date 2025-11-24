'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Package, Database, Box, Filter, Search, MoreVertical, RotateCw, Trash2, Tag, Pencil, Download, Globe, ArrowUpDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
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
import type {
  ApplicationService,
  DatabaseService,
  ImageService,
  LegacyNetworkConfig,
  NetworkConfig,
  NetworkConfigV2,
  Project,
  Service
} from '@/types/project'
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

type ServiceSubtitle = {
  label: string
  href?: string
}

const normalizeNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const formatDateTime = (value?: string) => {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', { hour12: false })
}

const isNetworkConfigV2 = (
  config: NetworkConfig | null | undefined
): config is NetworkConfigV2 => {
  if (!config || typeof config !== 'object') {
    return false
  }

  return Array.isArray((config as NetworkConfigV2).ports)
}

const isLegacyNetworkConfig = (
  config: NetworkConfig | null | undefined
): config is LegacyNetworkConfig => {
  if (!config || typeof config !== 'object') {
    return false
  }

  return 'container_port' in config
}

const extractNetworkPorts = (config?: NetworkConfig | null): number[] => {
  if (!config) {
    return []
  }

  if (isNetworkConfigV2(config)) {
    return config.ports
      .map((port) => normalizeNumericValue(port.service_port ?? port.container_port))
      .filter((value): value is number => value !== null)
  }

  if (isLegacyNetworkConfig(config)) {
    const port = normalizeNumericValue(config.service_port ?? config.container_port)
    return port !== null ? [port] : []
  }

  return []
}

type DomainAccessLink = {
  host: string
  label: string
  url: string
}

const isDomainCapableServiceType = (
  type: ServiceType | null
): type is ServiceType.APPLICATION | ServiceType.IMAGE =>
  type === ServiceType.APPLICATION || type === ServiceType.IMAGE

const normalizeDomainHostCandidate = (domainCandidate: unknown): string | null => {
  if (!domainCandidate) {
    return null
  }

  if (typeof domainCandidate === 'string') {
    const trimmed = domainCandidate.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (typeof domainCandidate === 'object') {
    const domainRecord = domainCandidate as Record<string, unknown>
    const enabledValue = domainRecord['enabled']
    const enabled = enabledValue === undefined ? true : Boolean(enabledValue)
    if (!enabled) {
      return null
    }

    const hostValue = domainRecord['host'] ?? domainRecord['hostname']
    if (typeof hostValue === 'string' && hostValue.trim().length > 0) {
      return hostValue.trim()
    }
  }

  return null
}

const getDomainAccessLinks = (
  service: Service,
  normalizedType: ServiceType | null
): DomainAccessLink[] => {
  if (!isDomainCapableServiceType(normalizedType)) {
    return []
  }

  const config = service.network_config
  if (!config || typeof config !== 'object') {
    return []
  }

  const hosts = new Set<string>()
  const addHost = (candidate: unknown) => {
    const host = normalizeDomainHostCandidate(candidate)
    if (host) {
      hosts.add(host)
    }
  }

  addHost((config as { domain?: unknown }).domain)

  if (isNetworkConfigV2(config)) {
    config.ports.forEach((port) => addHost(port?.domain))
  } else {
    const legacyPorts = (config as { ports?: unknown }).ports
    if (Array.isArray(legacyPorts)) {
      legacyPorts.forEach((port) => {
        if (port && typeof port === 'object') {
          addHost((port as { domain?: unknown }).domain)
        }
      })
    }
  }

  return Array.from(hosts)
    .map((host) => {
      const trimmedHost = host.trim()
      if (!trimmedHost) {
        return null
      }

      const hasProtocol = /^http?:\/\//i.test(trimmedHost)
      const url = hasProtocol ? trimmedHost : `http://${trimmedHost}`
      const label = hasProtocol ? trimmedHost.replace(/^http?:\/\//i, '') : trimmedHost
      return { host: trimmedHost, label, url }
    })
    .filter((link): link is DomainAccessLink => Boolean(link))
}

const getServiceSubtitle = (
  service: Service,
  normalizedType: ServiceType | null,
  applicationService: ApplicationService | null,
  databaseService: DatabaseService | null,
  imageService: ImageService | null
): ServiceSubtitle => {
  if (applicationService) {
    const repoUrl = applicationService.git_repository?.trim() ?? ''
    const normalizedRepoUrl = repoUrl.replace(/\/+$/, '')
    const repoNameCandidate = normalizedRepoUrl ? normalizedRepoUrl.split('/').pop() ?? normalizedRepoUrl : ''
    const cleanRepoName = repoNameCandidate ? repoNameCandidate.replace(/\.git$/i, '') : ''
    const branch = applicationService.git_branch?.trim() ?? ''
    const parts: string[] = []

    if (cleanRepoName) {
      parts.push(cleanRepoName)
    }
    if (branch) {
      parts.push(branch)
    }

    const fallbackLabel = branch || '未配置仓库'
    const label = parts.length > 0 ? parts.join(' · ') : fallbackLabel

    return {
      label,
      href: repoUrl || undefined
    }
  }

  if (databaseService) {
    const typeLabel = databaseService.database_type
      ? databaseService.database_type.toUpperCase()
      : 'Database'
    const version = databaseService.version?.trim()
    const label = version ? `${typeLabel} · ${version}` : typeLabel
    return { label }
  }

  if (imageService) {
    const imageName = imageService.image?.trim() || '未配置镜像'
    const tag = imageService.tag?.trim()
    const label = tag ? `${imageName}:${tag}` : imageName
    return { label }
  }

  if (normalizedType) {
    return { label: SERVICE_TYPE_LABELS[normalizedType] ?? UNKNOWN_SERVICE_TYPE_LABEL }
  }

  return {
    label:
      typeof service.type === 'string' && service.type.trim().length > 0
        ? service.type
        : UNKNOWN_SERVICE_TYPE_LABEL
  }
}

const getConnectivityLabel = (
  service: Service,
  applicationService: ApplicationService | null,
  databaseService: DatabaseService | null,
  imageService: ImageService | null
) => {
  const networkPorts = extractNetworkPorts(service.network_config)
  const primaryNetworkPort = typeof networkPorts[0] === 'number' ? networkPorts[0] : null

  if (applicationService) {
    const portValue = normalizeNumericValue(applicationService.port) ?? primaryNetworkPort
    return portValue !== null ? `端口 ${portValue}` : '-'
  }

  if (databaseService) {
    const internalPort = normalizeNumericValue(databaseService.port)
    const externalPort = normalizeNumericValue(databaseService.external_port)
    const labels: string[] = []

    if (internalPort !== null) {
      labels.push(`内 ${internalPort}`)
    }
    if (externalPort !== null) {
      labels.push(`外 ${externalPort}`)
    }

    if (labels.length > 0) {
      return labels.join(' / ')
    }

    return primaryNetworkPort !== null ? `端口 ${primaryNetworkPort}` : '-'
  }

  if (imageService) {
    return primaryNetworkPort !== null ? `端口 ${primaryNetworkPort}` : '-'
  }

  return primaryNetworkPort !== null ? `端口 ${primaryNetworkPort}` : '-'
}

const getReplicasLabel = (
  applicationService: ApplicationService | null,
  imageService: ImageService | null
) => {
  const candidates = [
    applicationService ? normalizeNumericValue(applicationService.replicas) : null,
    imageService ? normalizeNumericValue(imageService.replicas) : null
  ]

  for (const value of candidates) {
    if (typeof value === 'number') {
      return String(value)
    }
  }

  return '-'
}

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-500',
  pending: 'bg-yellow-500',
  stopped: 'bg-gray-500',
  error: 'bg-red-500',
  building: 'bg-blue-500'
}

const STATUS_LABELS: Record<string, string> = {
  running: '运行中',
  pending: '待启动',
  stopped: '已停止',
  error: '错误',
  building: '构建中'
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
  const [sortBy, setSortBy] = useState<'name' | 'updated_at'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
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

  // 重启服务
  const handleRestartService = async (serviceId: string) => {
    try {
      await serviceSvc.restartService(serviceId)
      toast.success('服务重启成功')
      await loadServices()
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`重启失败：${message}`)
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

  // 过滤和排序服务
  const filteredAndSortedServices = services
    .filter((service) => {
      const normalizedType = normalizeServiceType(service.type)
      const matchesSearch = service.name.toLowerCase().includes(searchKeyword.toLowerCase())
      const matchesType = selectedType === 'all' || normalizedType === selectedType
      return matchesSearch && matchesType
    })
    .sort((a, b) => {
      let comparison = 0
      
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name, 'zh-CN')
      } else if (sortBy === 'updated_at') {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
        comparison = aTime - bTime
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ArrowUpDown className="w-4 h-4" />
                {sortBy === 'name' ? '按名称' : '按更新时间'}
                {sortOrder === 'asc' ? ' ↑' : ' ↓'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setSortBy('name'); setSortOrder('asc') }}>
                名称升序 (A-Z)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('name'); setSortOrder('desc') }}>
                名称降序 (Z-A)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('updated_at'); setSortOrder('desc') }}>
                最近更新
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('updated_at'); setSortOrder('asc') }}>
                最早更新
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 服务列表 */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : filteredAndSortedServices.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无服务</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>服务</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>副本</TableHead>
                    <TableHead>网络/端口</TableHead>
                    <TableHead>最近更新</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedServices.map((service) => {
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
                    const subtitle = getServiceSubtitle(
                      service,
                      normalizedType,
                      applicationService,
                      databaseService,
                      imageService
                    )
                    const connectivityLabel = getConnectivityLabel(
                      service,
                      applicationService,
                      databaseService,
                      imageService
                    )
                    const replicasLabel = getReplicasLabel(applicationService, imageService)
                    const updatedAtLabel = formatDateTime(service.updated_at ?? service.created_at)
                    const domainLinks = getDomainAccessLinks(service, normalizedType)

                    return (
                      <TableRow
                        key={service.id ?? service.name}
                        className="cursor-pointer"
                        onClick={() => {
                          if (service.id) {
                            router.push(`/projects/${id}/services/${service.id}`)
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                              <Icon className="h-5 w-5 text-gray-700" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-gray-900">{service.name}</span>
                                <Badge variant="outline">{serviceTypeLabel}</Badge>
                              </div>
                              {subtitle.href ? (
                                <a
                                  href={subtitle.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                  title={subtitle.label}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {subtitle.label}
                                </a>
                              ) : (
                                <span className="text-xs text-gray-500" title={subtitle.label}>
                                  {subtitle.label}
                                </span>
                              )}
                              {domainLinks.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {domainLinks.map((link) => (
                                    <Button
                                      key={`${service.id ?? service.name}-${link.host}`}
                                      variant="outline"
                                      size="sm"
                                      className="gap-1.5"
                                      asChild
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={link.host}
                                      >
                                        <Globe className="h-3.5 w-3.5" />
                                        <span className="max-w-[160px] truncate">{link.label}</span>
                                      </a>
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                            <span className="text-gray-900">{statusLabel}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-900">{replicasLabel}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-900" title={connectivityLabel}>
                            {connectivityLabel}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-500" title={updatedAtLabel}>
                            {updatedAtLabel}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.stopPropagation()
                                  if (service.id) {
                                    void handleRestartService(service.id)
                                  }
                                }}
                              >
                                <RotateCw className="w-4 h-4 mr-2" />
                                重启
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={(event) => {
                                  event.stopPropagation()
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
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
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
