'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Play, Square, Trash2, RefreshCw, Settings, Terminal, FileText, Activity, Rocket, HardDrive, Save, Plus, X, Globe, FileCode, Check, Box, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxCreateNew
} from '@/components/ui/shadcn-io/combobox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ImageReferencePicker, type ImageReferenceValue } from '@/components/services/ImageReferencePicker'
import { serviceSvc } from '@/service/serviceSvc'
import { systemConfigSvc } from '@/service/systemConfigSvc'
import { projectSvc } from '@/service/projectSvc'
import { DEFAULT_DOMAIN_ROOT, sanitizeDomainLabel } from '@/lib/network'
import { findVolumeTemplate, generateNFSSubpath } from '@/lib/volume-templates'
import { cn } from '@/lib/utils'
import { parseImageReference, formatImageReference, isImageReferenceEqual } from '@/lib/service-image'
import { extractGitLabProjectPath } from '@/lib/gitlab'
import { ServiceType, GitProvider, DatabaseType, DATABASE_TYPE_METADATA } from '@/types/project'
import type { Service, Deployment, Project, NetworkConfig, NetworkConfigV2, NetworkPortConfig, ServiceImageRecord, ServiceImageStatus, DatabaseService, SupportedDatabaseType } from '@/types/project'
import type { K8sServiceStatus } from '@/types/k8s'
import type { GitProviderConfig } from '@/types/system'

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

const SERVICE_STATUSES = ['running', 'pending', 'stopped', 'error', 'building'] as const

type ServiceStatus = (typeof SERVICE_STATUSES)[number]

type GitBranchOption = {
  value: string
  label: string
  isDefault: boolean
  description?: string | null
}

const normalizeServiceStatus = (status?: string): ServiceStatus => {
  if (!status || typeof status !== 'string') {
    return 'pending'
  }
  const normalized = status.trim().toLowerCase()

  if (normalized === 'stoped' || normalized === 'inactive') {
    return 'stopped'
  }

  return SERVICE_STATUSES.includes(normalized as ServiceStatus) ? (normalized as ServiceStatus) : 'pending'
}

const DEPLOYMENT_STATUS_META: Record<Deployment['status'], { label: string; className: string }> = {
  pending: { label: '待开始', className: 'bg-gray-100 text-gray-600' },
  building: { label: '构建中', className: 'bg-blue-100 text-blue-700' },
  success: { label: '部署成功', className: 'bg-green-100 text-green-700' },
  failed: { label: '部署失败', className: 'bg-red-100 text-red-700' }
}

const LOGS_LINE_COUNT = 200
const IMAGE_HISTORY_PAGE_SIZE = 10
const SUCCESS_IMAGE_OPTIONS_LIMIT = 100

const IMAGE_STATUS_META: Record<ServiceImageStatus, { label: string; badgeClass: string; textClass: string }> = {
  pending: { label: '等待构建', badgeClass: 'bg-gray-100 text-gray-600', textClass: 'text-gray-500' },
  building: { label: '构建中', badgeClass: 'bg-blue-100 text-blue-600', textClass: 'text-blue-600' },
  success: { label: '构建成功', badgeClass: 'bg-green-100 text-green-700', textClass: 'text-green-600' },
  failed: { label: '构建失败', badgeClass: 'bg-red-100 text-red-700', textClass: 'text-red-600' }
}

type NetworkPortFormState = {
  id: string
  containerPort: string
  servicePort: string
  protocol: 'TCP' | 'UDP'
  nodePort: string
  enableDomain: boolean
  domainPrefix: string
}

type DeploymentImageInfo = {
  id: string | null
  fullImage: string | null
  image: string
  tag?: string
  display: string
  record: ServiceImageRecord | null
}

const generatePortId = () =>
  typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10)

const createEmptyPort = (): NetworkPortFormState => ({
  id: generatePortId(),
  containerPort: '',
  servicePort: '',
  protocol: 'TCP',
  nodePort: '',
  enableDomain: false,
  domainPrefix: ''
})

const isNetworkConfigV2 = (config: NetworkConfig): config is NetworkConfigV2 =>
  Boolean(config) && Array.isArray((config as NetworkConfigV2).ports)

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return value
  }
}

const formatDuration = (start?: string, end?: string) => {
  if (!start || !end) return '-'
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diff = endDate.getTime() - startDate.getTime()

  if (!Number.isFinite(diff) || diff <= 0) {
    return '小于 1 秒'
  }

  const totalSeconds = Math.floor(diff / 1000)
  if (totalSeconds < 60) {
    return `${totalSeconds} 秒`
  }

  const totalMinutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (totalMinutes < 60) {
    return seconds ? `${totalMinutes} 分 ${seconds} 秒` : `${totalMinutes} 分`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const parts = [`${hours} 小时`]

  if (minutes) {
    parts.push(`${minutes} 分`)
  }

  if (seconds) {
    parts.push(`${seconds} 秒`)
  }

  return parts.join(' ')
}

// 解析资源限制字符串
const parseResourceValue = (value: string | undefined, type: 'cpu' | 'memory') => {
  if (!value) return { value: '', unit: type === 'cpu' ? 'core' : 'Mi' }

  const trimmed = value.trim()
  if (!trimmed) return { value: '', unit: type === 'cpu' ? 'core' : 'Mi' }

  if (type === 'cpu') {
    // CPU: 支持 "1000m" 或 "1" 格式
    if (trimmed.endsWith('m')) {
      return { value: trimmed.slice(0, -1), unit: 'm' as const }
    }

    return { value: trimmed, unit: 'core' as const }
  }

  // Memory: 支持 "512Mi" 或 "1Gi" 格式
  if (trimmed.endsWith('Gi')) {
    return { value: trimmed.slice(0, -2), unit: 'Gi' as const }
  }

  if (trimmed.endsWith('Mi')) {
    return { value: trimmed.slice(0, -2), unit: 'Mi' as const }
  }

  // 默认当作 Mi
  return { value: trimmed, unit: 'Mi' as const }
}

// 组合资源限制字符串
const combineResourceValue = (value: string, unit: string) => {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''
  if (unit === 'core') {
    return trimmedValue
  }
  return `${trimmedValue}${unit}`
}

const buildDatabaseConnectionUrl = (
  type: SupportedDatabaseType,
  host: string,
  port: number,
  username: string,
  password: string,
  databaseName: string
): string => {
  const normalizedHost = host.trim()
  const normalizedPort = Number.isFinite(port) ? port : Number(port)

  if (!normalizedHost || !Number.isFinite(normalizedPort) || normalizedPort <= 0) {
    return ''
  }

  if (type === DatabaseType.MYSQL) {
    const encodedUser = encodeURIComponent(username || 'root')
    const encodedPassword = encodeURIComponent(password || '')
    const encodedDatabase = databaseName ? `/${encodeURIComponent(databaseName)}` : ''
    return `mysql://${encodedUser}:${encodedPassword}@${normalizedHost}:${normalizedPort}${encodedDatabase}`
  }

  const encodedPassword = password ? encodeURIComponent(password) : ''
  return encodedPassword
    ? `redis://:${encodedPassword}@${normalizedHost}:${normalizedPort}`
    : `redis://${normalizedHost}:${normalizedPort}`
}

export default function ServiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const serviceId = params.serviceId as string

  const [service, setService] = useState<Service | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('general')
  const [isEditing, setIsEditing] = useState(false)
  const [editedService, setEditedService] = useState<any>({})
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([])
  const [volumes, setVolumes] = useState<Array<{ nfs_subpath?: string; container_path: string; read_only: boolean }>>([])
  // 资源限制状态
  const [cpuValue, setCpuValue] = useState('')
  const [cpuUnit, setCpuUnit] = useState<'m' | 'core'>('core')
  const [memoryValue, setMemoryValue] = useState('')
  const [memoryUnit, setMemoryUnit] = useState<'Mi' | 'Gi'>('Mi')
  const [networkServiceType, setNetworkServiceType] = useState<'ClusterIP' | 'NodePort' | 'LoadBalancer'>('ClusterIP')
  const [networkPorts, setNetworkPorts] = useState<NetworkPortFormState[]>([createEmptyPort()])
  const [deploying, setDeploying] = useState(false)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [deploymentsLoading, setDeploymentsLoading] = useState(true)
  const [deploymentsError, setDeploymentsError] = useState<string | null>(null)
  const [logs, setLogs] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [hasLoadedLogs, setHasLoadedLogs] = useState(false)
  const [yamlContent, setYamlContent] = useState<string>('')
  const [yamlLoading, setYamlLoading] = useState(false)
  const [yamlError, setYamlError] = useState<string | null>(null)
  const [serviceImages, setServiceImages] = useState<ServiceImageRecord[]>([])
  const [successfulServiceImages, setSuccessfulServiceImages] = useState<ServiceImageRecord[]>([])
  const [imagePagination, setImagePagination] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    pageSize: IMAGE_HISTORY_PAGE_SIZE,
    hasNext: false,
    hasPrevious: false
  })
  const [imagesLoading, setImagesLoading] = useState(false)
  const [imagesError, setImagesError] = useState<string | null>(null)
  const [imagePickerValue, setImagePickerValue] = useState<ImageReferenceValue>({ optionId: null, image: '', tag: undefined })
  const [selectedServiceImageId, setSelectedServiceImageId] = useState<string | null>(null)
  const [activateImageLoading, setActivateImageLoading] = useState(false)
  const [buildingImage, setBuildingImage] = useState(false)
  const [buildBranch, setBuildBranch] = useState('')
  const [buildTag, setBuildTag] = useState('')
  const [buildDialogOpen, setBuildDialogOpen] = useState(false)
  const [buildTagType, setBuildTagType] = useState<'dev' | 'test' | 'release'>('dev')
  const [customBuildTag, setCustomBuildTag] = useState('')
  const [deployDialogOpen, setDeployDialogOpen] = useState(false)
  const [deployImageList, setDeployImageList] = useState<ServiceImageRecord[]>([])
  const [deployImagePage, setDeployImagePage] = useState(1)
  const [deployImageTotal, setDeployImageTotal] = useState(0)
  const [deployImageLoading, setDeployImageLoading] = useState(false)
  const [externalAccessUpdating, setExternalAccessUpdating] = useState(false)
  const [selectedDeployImageId, setSelectedDeployImageId] = useState<string | null>(null)
  const DEPLOY_IMAGE_PAGE_SIZE = 5
  const [k8sStatusInfo, setK8sStatusInfo] = useState<K8sServiceStatus | null>(null)
  const [k8sStatusLoading, setK8sStatusLoading] = useState(false)
  const [k8sStatusError, setK8sStatusError] = useState<string | null>(null)
  const [gitProviderConfig, setGitProviderConfig] = useState<GitProviderConfig | null>(null)
  const [gitProviderConfigLoaded, setGitProviderConfigLoaded] = useState(false)
  const [branchOptions, setBranchOptions] = useState<GitBranchOption[]>([])
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchError, setBranchError] = useState<string | null>(null)
  const [branchPickerOpen, setBranchPickerOpen] = useState(false)
  const [branchSearch, setBranchSearch] = useState('')
  const [hasPendingNetworkDeploy, setHasPendingNetworkDeploy] = useState(false)
  const [pendingNetworkDeployMarkedAt, setPendingNetworkDeployMarkedAt] = useState<number | null>(null)
  const pendingNetworkDeployStorageKey = useMemo(
    () => (serviceId ? `service:${serviceId}:pending-network-deploy` : null),
    [serviceId]
  )
  const branchInitialLoadRef = useRef(false)
  const gitBranchRef = useRef<string>('')
  const imageSelectionManuallyChangedRef = useRef(false)
  const lastAppliedActiveImageRef = useRef<{ id: string | null; fullImage: string | null }>({
    id: null,
    fullImage: null
  })
  const serviceType = service?.type

  useEffect(() => {
    if (!pendingNetworkDeployStorageKey) {
      setHasPendingNetworkDeploy(false)
      setPendingNetworkDeployMarkedAt(null)
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    try {
      const rawValue = window.localStorage.getItem(pendingNetworkDeployStorageKey)
      if (!rawValue) {
        setHasPendingNetworkDeploy(false)
        setPendingNetworkDeployMarkedAt(null)
        return
      }
      const parsed = JSON.parse(rawValue) as { markedAt?: number }
      if (parsed && typeof parsed.markedAt === 'number') {
        setHasPendingNetworkDeploy(true)
        setPendingNetworkDeployMarkedAt(parsed.markedAt)
      } else {
        setHasPendingNetworkDeploy(true)
        setPendingNetworkDeployMarkedAt(null)
      }
    } catch (error) {
      console.error('[ServiceDetail] Failed to read pending network deploy flag:', error)
      setHasPendingNetworkDeploy(false)
      setPendingNetworkDeployMarkedAt(null)
    }
  }, [pendingNetworkDeployStorageKey])

  const persistPendingNetworkDeployFlag = useCallback(
    (markedAt: number | null) => {
      if (!pendingNetworkDeployStorageKey || typeof window === 'undefined') {
        return
      }

      try {
        if (markedAt === null) {
          window.localStorage.removeItem(pendingNetworkDeployStorageKey)
        } else {
          window.localStorage.setItem(
            pendingNetworkDeployStorageKey,
            JSON.stringify({ markedAt })
          )
        }
      } catch (error) {
        console.error('[ServiceDetail] Failed to persist pending network deploy flag:', error)
      }
    },
    [pendingNetworkDeployStorageKey]
  )

  const markPendingNetworkDeploy = useCallback(() => {
    const timestamp = Date.now()
    setHasPendingNetworkDeploy(true)
    setPendingNetworkDeployMarkedAt(timestamp)
    persistPendingNetworkDeployFlag(timestamp)
  }, [persistPendingNetworkDeployFlag])

  const clearPendingNetworkDeploy = useCallback(() => {
    setHasPendingNetworkDeploy(false)
    setPendingNetworkDeployMarkedAt(null)
    persistPendingNetworkDeployFlag(null)
  }, [persistPendingNetworkDeployFlag])

  const databaseService =
    serviceType === ServiceType.DATABASE && service ? (service as DatabaseService) : null
  const editedDatabaseService =
    isEditing && serviceType === ServiceType.DATABASE ? (editedService as DatabaseService) : null
  const normalizedDatabaseType = (() => {
    const rawType = databaseService?.database_type
    return typeof rawType === 'string' ? rawType.toLowerCase() : ''
  })()
  const isMysqlDatabase = normalizedDatabaseType === DatabaseType.MYSQL
  const isRedisDatabase = normalizedDatabaseType === DatabaseType.REDIS
  const supportedDatabaseType: SupportedDatabaseType | null =
    isMysqlDatabase || isRedisDatabase ? (normalizedDatabaseType as SupportedDatabaseType) : null
  const databaseNetworkConfig = databaseService?.network_config as Record<string, unknown> | null
  const databaseNetworkServiceType = (() => {
    if (!databaseNetworkConfig || typeof databaseNetworkConfig !== 'object') {
      return ''
    }
    const snakeCase = databaseNetworkConfig as { service_type?: unknown }
    if (typeof snakeCase.service_type === 'string') {
      return snakeCase.service_type
    }
    const camelCase = databaseNetworkConfig as { serviceType?: unknown }
    if (typeof camelCase.serviceType === 'string') {
      return camelCase.serviceType
    }
    return ''
  })()
  const externalAccessEnabled = useMemo(() => {
    if (!databaseService) {
      return false
    }
    const normalized = databaseNetworkServiceType.trim().toLowerCase()
    if (normalized === 'nodeport') {
      return true
    }
    return typeof databaseService.external_port === 'number' && databaseService.external_port > 0
  }, [databaseNetworkServiceType, databaseService?.external_port, databaseService?.id])
  const databaseTypeLabel = supportedDatabaseType
    ? DATABASE_TYPE_METADATA[supportedDatabaseType].label
    : databaseService?.database_type ?? '-'
  const databaseUsernameValue =
    (isEditing ? editedDatabaseService?.username : databaseService?.username) ?? ''
  const databasePasswordValue =
    (isEditing ? editedDatabaseService?.password : databaseService?.password) ?? ''
  const databaseRootPasswordValue =
    (isEditing ? editedDatabaseService?.root_password : databaseService?.root_password) ?? ''
  const databaseNameInputValue = isEditing
    ? editedDatabaseService?.database_name ?? databaseService?.database_name ?? ''
    : databaseService?.database_name ?? '-'
  const databaseVersionValue = databaseService?.version ?? 'latest'
  const databaseVolumeSizeValue = databaseService?.volume_size ?? '10Gi'
  const databaseVolumeSizeInputValue = isEditing
    ? editedDatabaseService?.volume_size ?? databaseVolumeSizeValue
    : databaseVolumeSizeValue

  useEffect(() => {
    if (!serviceType || serviceType.toLowerCase() !== ServiceType.APPLICATION) {
      setGitProviderConfig(null)
      setGitProviderConfigLoaded(true)
      return
    }

    let cancelled = false

    const loadConfig = async () => {
      try {
        const config = await systemConfigSvc.getGitProviderConfig()
        if (cancelled) return

        if (config?.provider === GitProvider.GITLAB) {
          setGitProviderConfig(config)
        } else {
          setGitProviderConfig(null)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[ServiceDetailPage] Failed to load git provider config:', error)
          setGitProviderConfig(null)
        }
      } finally {
        if (!cancelled) {
          setGitProviderConfigLoaded(true)
        }
      }
    }

    setGitProviderConfigLoaded(false)
    void loadConfig()

    return () => {
      cancelled = true
    }
  }, [serviceType])

  const isGitLabProvider = useMemo(() => (serviceType === 'application' ? (service as any)?.git_provider ?? '' : '').toLowerCase() === GitProvider.GITLAB, [serviceType, service])

  const effectiveGitRepository = useMemo(() => {
    if (!service || serviceType !== 'application') {
      return ''
    }

    if (isEditing && typeof editedService.git_repository === 'string') {
      return editedService.git_repository.trim()
    }

    return ((service as any).git_repository ?? '').trim()
  }, [editedService.git_repository, isEditing, service, serviceType])

  const gitlabIntegrationReady = useMemo(() => {
    if (!isGitLabProvider) {
      return false
    }

    if (!gitProviderConfigLoaded || !gitProviderConfig) {
      return false
    }

    return gitProviderConfig.enabled && gitProviderConfig.hasToken
  }, [gitProviderConfig, gitProviderConfigLoaded, isGitLabProvider])

  const repositoryIdentifier = useMemo(() => {
    if (!gitlabIntegrationReady) {
      return null
    }

    if (!effectiveGitRepository) {
      return null
    }

    const extracted = extractGitLabProjectPath(effectiveGitRepository, gitProviderConfig?.baseUrl)
    if (extracted) {
      return extracted
    }

    const fallback = effectiveGitRepository.replace(/\.git$/i, '')
    if (fallback.includes('://')) {
      return null
    }

    return fallback
  }, [effectiveGitRepository, gitProviderConfig?.baseUrl, gitlabIntegrationReady])

  const normalizedBranchValue = useMemo(() => {
    const raw = (editedService?.git_branch ?? (serviceType === 'application' ? (service as any)?.git_branch : '') ?? '').trim()
    return raw
  }, [editedService?.git_branch, serviceType === 'application' ? (service as any)?.git_branch : undefined, serviceType])

  useEffect(() => {
    gitBranchRef.current = normalizedBranchValue
  }, [normalizedBranchValue])

  const branchOptionMap = useMemo(() => new Map(branchOptions.map((option) => [option.value, option])), [branchOptions])
  const branchComboboxData = useMemo(() => branchOptions.map((option) => ({ value: option.value, label: option.label })), [branchOptions])
  const selectedBranchOption = useMemo(() => {
    if (!normalizedBranchValue) {
      return null
    }

    return branchOptionMap.get(normalizedBranchValue) ?? null
  }, [branchOptionMap, normalizedBranchValue])

  const branchDisplayLabel = selectedBranchOption?.label || normalizedBranchValue || '选择分支'
  const branchDisplayDescription = useMemo(() => {
    if (selectedBranchOption?.description) {
      return selectedBranchOption.description
    }

    if (selectedBranchOption?.isDefault) {
      return '默认分支'
    }

    if (normalizedBranchValue) {
      return '自定义分支'
    }

    return branchLoading ? '分支列表加载中…' : '请选择分支'
  }, [branchLoading, normalizedBranchValue, selectedBranchOption])

  const branchSelectorAvailable = gitlabIntegrationReady && Boolean(repositoryIdentifier)
  const branchSelectorDisabled = !isEditing || !branchSelectorAvailable
  const isGitConfigLoading = isGitLabProvider && !gitProviderConfigLoaded
  const showGitlabConfigWarning = isGitLabProvider && gitProviderConfigLoaded && (!gitProviderConfig || !gitProviderConfig.enabled || !gitProviderConfig.hasToken)

  const fetchBranches = useCallback(
    async (
      keyword?: string,
      options: { useDefaultBranch?: boolean } = {}
    ) => {
      if (!branchSelectorAvailable || !repositoryIdentifier) {
        if (options.useDefaultBranch) {
          branchInitialLoadRef.current = false
        }
        return
      }

      setBranchLoading(true)
      setBranchError(null)

      try {
        const result = await systemConfigSvc.getGitRepositoryBranches(repositoryIdentifier, {
          search: keyword?.trim() || undefined,
          perPage: 100
        })

        const optionsMapped = result.items.map<GitBranchOption>((branch) => {
          const descriptionParts: string[] = []

          if (branch.commit?.shortId) {
            descriptionParts.push(`#${branch.commit.shortId}`)
          }

          if (branch.commit?.title) {
            descriptionParts.push(branch.commit.title)
          }

          return {
            value: branch.name,
            label: branch.name,
            isDefault: branch.default,
            description: descriptionParts.join(' · ') || null
          }
        })

        const currentBranch = gitBranchRef.current.trim()
        if (currentBranch && !optionsMapped.some((item) => item.value === currentBranch)) {
          optionsMapped.unshift({
            value: currentBranch,
            label: currentBranch,
            isDefault: false,
            description: null
          })
        }

        setBranchOptions(optionsMapped)

        if (options.useDefaultBranch) {
          const matched = optionsMapped.find((item) => item.value === currentBranch)

          if (!matched) {
            const fallback = optionsMapped.find((item) => item.isDefault) ?? optionsMapped[0]
            if (fallback) {
              gitBranchRef.current = fallback.value
              setEditedService((prev: any) => ({ ...prev, git_branch: fallback.value }))
              setBuildBranch((prev) => (prev.trim() ? prev : fallback.value))
            }
          }

          branchInitialLoadRef.current = true
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '仓库分支加载失败'
        setBranchError(message)
        setBranchOptions([])
      } finally {
        setBranchLoading(false)
      }
    },
    [branchSelectorAvailable, repositoryIdentifier, setEditedService]
  )

  useEffect(() => {
    if (!branchSelectorAvailable) {
      setBranchPickerOpen(false)
      setBranchOptions([])
      setBranchError(null)
      setBranchSearch('')
      branchInitialLoadRef.current = false
      setBranchLoading(false)
      return
    }

    branchInitialLoadRef.current = false
    void fetchBranches(undefined, { useDefaultBranch: true })
  }, [branchSelectorAvailable, fetchBranches])

  useEffect(() => {
    if (!branchSelectorAvailable || !branchPickerOpen) {
      return
    }

    const keyword = branchSearch.trim()
    if (!keyword) {
      return
    }

    const handler = window.setTimeout(() => {
      void fetchBranches(keyword, { useDefaultBranch: false })
    }, 350)

    return () => {
      window.clearTimeout(handler)
    }
  }, [branchPickerOpen, branchSearch, branchSelectorAvailable, fetchBranches])

  useEffect(() => {
    if (branchSelectorDisabled && branchPickerOpen) {
      setBranchPickerOpen(false)
    }
  }, [branchPickerOpen, branchSelectorDisabled])

  const serviceImageLookup = useMemo(() => {
    const byId = new Map<string, ServiceImageRecord>()
    const byFullImage = new Map<string, ServiceImageRecord>()

    const register = (entry?: ServiceImageRecord) => {
      if (!entry) return
      const { id, full_image } = entry
      if (typeof id === 'string' && id && !byId.has(id)) {
        byId.set(id, entry)
      }
      if (typeof full_image === 'string' && full_image && !byFullImage.has(full_image)) {
        byFullImage.set(full_image, entry)
      }
    }

    serviceImages.forEach(register)
    successfulServiceImages.forEach(register)

    return { byId, byFullImage }
  }, [serviceImages, successfulServiceImages])

  const resolveDeploymentImageInfo = useCallback(
    (deployment: Deployment | null | undefined): DeploymentImageInfo | null => {
      if (!deployment) {
        return null
      }

      const serviceImageId = deployment.service_image_id ?? null
      let record: ServiceImageRecord | null = null

      if (serviceImageId) {
        record = serviceImageLookup.byId.get(serviceImageId) ?? null
      }

      let fullImage = record?.full_image ?? deployment.image_tag ?? null

      if ((!record || !record.full_image) && fullImage) {
        record = serviceImageLookup.byFullImage.get(fullImage) ?? record
        fullImage = record?.full_image ?? fullImage
      }

      if (!record && deployment.service_image) {
        record = deployment.service_image
        fullImage = record?.full_image ?? fullImage
      }

      const effectiveFullImage = typeof fullImage === 'string' && fullImage.trim() ? fullImage : null
      const parsed = parseImageReference(effectiveFullImage ?? undefined)
      const baseImage = record?.image ?? parsed.image
      const baseTag = record?.tag ?? parsed.tag
      const display = baseImage ? formatImageReference(baseImage, baseTag) : effectiveFullImage ?? '未知镜像'

      return {
        id: record?.id ?? serviceImageId,
        fullImage: effectiveFullImage,
        image: baseImage,
        tag: baseTag,
        display,
        record: record ?? null
      }
    },
    [serviceImageLookup]
  )

  const latestSuccessfulDeployment = useMemo(
    () => deployments.find((item) => item.status === 'success') ?? null,
    [deployments]
  )

  const latestActiveDeploymentInProgress = useMemo(
    () => deployments.find((item) => item.status === 'building' || item.status === 'pending') ?? null,
    [deployments]
  )

  const currentDeploymentInfo = useMemo(
    () => resolveDeploymentImageInfo(latestSuccessfulDeployment),
    [latestSuccessfulDeployment, resolveDeploymentImageInfo]
  )

  const ongoingDeploymentInfo = useMemo(
    () => resolveDeploymentImageInfo(latestActiveDeploymentInProgress),
    [latestActiveDeploymentInProgress, resolveDeploymentImageInfo]
  )

  const ongoingDeploymentFullImage = ongoingDeploymentInfo?.fullImage ?? null
  const latestDeployment = useMemo(() => deployments[0] ?? null, [deployments])

  useEffect(() => {
    if (!hasPendingNetworkDeploy) {
      return
    }

    const deploymentTimestamp = (() => {
      if (latestSuccessfulDeployment?.completed_at) {
        const parsed = Date.parse(latestSuccessfulDeployment.completed_at)
        return Number.isNaN(parsed) ? null : parsed
      }
      if (latestSuccessfulDeployment?.created_at) {
        const parsed = Date.parse(latestSuccessfulDeployment.created_at)
        return Number.isNaN(parsed) ? null : parsed
      }
      return null
    })()

    if (!deploymentTimestamp) {
      return
    }

    if (!pendingNetworkDeployMarkedAt || deploymentTimestamp > pendingNetworkDeployMarkedAt) {
      clearPendingNetworkDeploy()
    }
  }, [
    clearPendingNetworkDeploy,
    hasPendingNetworkDeploy,
    latestSuccessfulDeployment?.completed_at,
    latestSuccessfulDeployment?.created_at,
    pendingNetworkDeployMarkedAt
  ])

  const activeServiceImageRecord = currentDeploymentInfo?.record ?? null
  const activeServiceImageId = currentDeploymentInfo?.id ?? activeServiceImageRecord?.id ?? null
  const activeServiceImageFullImage = currentDeploymentInfo?.fullImage ?? activeServiceImageRecord?.full_image ?? null

  const extractMetadataBranch = (image?: ServiceImageRecord | null) => {
    if (!image || !image.metadata || typeof image.metadata !== 'object') {
      return null
    }
    const metadata = image.metadata as Record<string, unknown>
    const branch = metadata['branch']
    return typeof branch === 'string' && branch.trim() ? branch.trim() : null
  }

  const activeImageBranch = extractMetadataBranch(activeServiceImageRecord)
  const ongoingImageBranch = extractMetadataBranch(ongoingDeploymentInfo?.record ?? null)

  const builtImageRef = useMemo(() => parseImageReference(serviceType === 'application' ? (service as any)?.built_image : undefined), [serviceType === 'application' ? (service as any)?.built_image : undefined, serviceType])
  const builtImageDisplay = builtImageRef.image ? formatImageReference(builtImageRef.image, builtImageRef.tag) : ''
  const applicationImageOptions = useMemo(
    () =>
      successfulServiceImages.map((image) => {
        const status = (image.build_status ?? 'pending') as ServiceImageStatus
        const infoParts = [
          image.build_number ? `构建号 #${image.build_number}` : null,
          image.created_at ? `创建于 ${formatDateTime(image.created_at)}` : null
        ].filter(Boolean)

        return {
          id: image.id,
          image: image.image,
          tag: image.tag,
          status,
          label: formatImageReference(image.image, image.tag),
          description: infoParts.join(' · ') || undefined
        }
      }),
    [successfulServiceImages]
  )
  const imageHistoryStats = useMemo(() => {
    if (serviceImages.length === 0) {
      return null
    }

    const page = imagePagination.page > 0 ? imagePagination.page : 1
    const pageSize = imagePagination.pageSize > 0 ? imagePagination.pageSize : IMAGE_HISTORY_PAGE_SIZE
    const total = imagePagination.total > 0 ? imagePagination.total : serviceImages.length
    const totalPages = imagePagination.totalPages > 0 ? imagePagination.totalPages : Math.max(Math.ceil(total / pageSize), 1)
    const rawStart = (page - 1) * pageSize + 1
    const hasTotal = total > 0
    const start = hasTotal ? Math.min(rawStart, total) : 0
    const end = hasTotal ? Math.min(start + serviceImages.length - 1, total) : 0

    return { page, pageSize, total, totalPages, start, end }
  }, [imagePagination.page, imagePagination.pageSize, imagePagination.total, imagePagination.totalPages, serviceImages.length])
  const imageServicePickerValue = useMemo<ImageReferenceValue>(() => {
    if (!service || service.type !== ServiceType.IMAGE) {
      return { optionId: null, image: '', tag: undefined }
    }

    const editingImage = isEditing && typeof editedService.image === 'string' ? editedService.image : undefined
    const editingTag = isEditing && typeof editedService.tag === 'string' ? editedService.tag : undefined
    const currentImage = editingImage ?? service.image ?? ''
    const currentTag = editingTag ?? service.tag ?? ''

    return {
      optionId: null,
      image: currentImage,
      tag: currentTag || undefined
    }
  }, [editedService, isEditing, service])

  const projectIdentifier = project?.identifier?.trim()
  const domainSuffixText = projectIdentifier
    ? `${projectIdentifier}.${DEFAULT_DOMAIN_ROOT}`
    : `项目编号.${DEFAULT_DOMAIN_ROOT}`
  const derivedDefaultDomainSource = (() => {
    if (!service) return 'service'
    if (service.type === ServiceType.IMAGE) {
      const imageName = service.image ?? ''
      if (imageName) {
        const segments = imageName.split('/')
        const lastSegment = segments[segments.length - 1] || imageName
        const [name] = lastSegment.split(':')
        return name || lastSegment || service.name || 'service'
      }
    }
    return service.name || 'service'
  })()
  const defaultDomainPrefix = sanitizeDomainLabel(derivedDefaultDomainSource)

  const initializeNetworkState = useCallback((svc: Service) => {
    const config = svc.network_config as NetworkConfig | undefined

    if (config && isNetworkConfigV2(config) && config.ports.length > 0) {
      setNetworkServiceType(config.service_type ?? 'ClusterIP')
      setNetworkPorts(
        config.ports.map((port) => ({
          id: generatePortId(),
          containerPort: port.container_port ? String(port.container_port) : '',
          servicePort: port.service_port ? String(port.service_port) : '',
          protocol: port.protocol ?? 'TCP',
          nodePort: port.node_port ? String(port.node_port) : '',
          enableDomain: Boolean(port.domain?.enabled),
          domainPrefix: port.domain?.prefix ?? ''
        }))
      )
      return
    }

    if (config && !isNetworkConfigV2(config)) {
      const legacy = config
      setNetworkServiceType(legacy.service_type ?? 'ClusterIP')
      setNetworkPorts([
        {
          id: generatePortId(),
          containerPort: legacy.container_port ? String(legacy.container_port) : '',
          servicePort: legacy.service_port ? String(legacy.service_port) : '',
          protocol: legacy.protocol ?? 'TCP',
          nodePort: legacy.node_port ? String(legacy.node_port) : '',
          enableDomain: false,
          domainPrefix: ''
        }
      ])
      return
    }

    setNetworkServiceType('ClusterIP')
    setNetworkPorts([createEmptyPort()])
  }, [])

  const loadServiceImages = useCallback(
    async ({ showToast = false, page }: { showToast?: boolean; page?: number } = {}) => {
      if (!serviceId) return

      const targetPage = typeof page === 'number' && page > 0 ? page : 1
      const isApplicationService = (service?.type ?? '').toLowerCase() === ServiceType.APPLICATION

      try {
        setImagesLoading(true)
        setImagesError(null)

        const historyPromise = serviceSvc.getServiceImages(serviceId, {
          page: targetPage,
          pageSize: IMAGE_HISTORY_PAGE_SIZE
        })

        const successPromise = isApplicationService
          ? serviceSvc.getServiceImages(serviceId, {
            page: 1,
            pageSize: SUCCESS_IMAGE_OPTIONS_LIMIT,
            status: 'success'
          })
          : null

        const historyResponse = await historyPromise
        const successResponse = successPromise ? await successPromise : null

        if (
          historyResponse.items.length === 0 &&
          historyResponse.total > 0 &&
          historyResponse.totalPages > 0 &&
          historyResponse.page > historyResponse.totalPages
        ) {
          await loadServiceImages({ showToast, page: historyResponse.totalPages })
          return
        }

        setServiceImages(historyResponse.items)
        setImagePagination({
          total: historyResponse.total,
          totalPages: historyResponse.totalPages,
          page: historyResponse.page,
          pageSize: historyResponse.pageSize,
          hasNext: historyResponse.hasNext,
          hasPrevious: historyResponse.hasPrevious
        })

        if (isApplicationService) {
          const successItems: ServiceImageRecord[] = []
          const seen = new Set<string>()
          const append = (item?: ServiceImageRecord) => {
            if (!item) return
            const id = item.id ?? ''
            if (!id || seen.has(id)) return
            seen.add(id)
            successItems.push(item)
          }

          successResponse?.items.forEach((item) => append(item))
          historyResponse.items.forEach((item) => {
            if ((item.build_status ?? '').toLowerCase() === 'success') {
              append(item)
            }
          })

          if (selectedServiceImageId) {
            const selectedFromHistory = historyResponse.items.find((img) => img.id === selectedServiceImageId)
            if ((selectedFromHistory?.build_status ?? '').toLowerCase() === 'success') {
              append(selectedFromHistory)
            }
          }

          const activeFromHistory = historyResponse.items.find((img) => img.is_active)
          if ((activeFromHistory?.build_status ?? '').toLowerCase() === 'success') {
            append(activeFromHistory)
          }

          successItems.sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
            return bTime - aTime
          })

          setSuccessfulServiceImages(successItems)

          const selectedImage = selectedServiceImageId
            ? successItems.find((img) => img.id === selectedServiceImageId) ?? null
            : null

          if (selectedServiceImageId && !selectedImage) {
            setSelectedServiceImageId(null)
            imageSelectionManuallyChangedRef.current = false
            lastAppliedActiveImageRef.current = { id: null, fullImage: null }
          }

          let fallbackImage: ServiceImageRecord | null = selectedImage ?? null

          if (!fallbackImage) {
            const deploymentActive = deployments.find((item) => item.status === 'success')
            if (deploymentActive?.service_image_id) {
              fallbackImage = successItems.find((img) => img.id === deploymentActive.service_image_id) ?? null
            }
            if (!fallbackImage && deploymentActive?.image_tag) {
              fallbackImage = successItems.find((img) => img.full_image === deploymentActive.image_tag) ?? null
            }
          }

          if (!fallbackImage) {
            fallbackImage = successItems.find((img) => img.is_active) ?? null
          }

          if (!fallbackImage) {
            fallbackImage = successItems[0] ?? null
          }

          const parsed = parseImageReference(serviceType === 'application' ? (service as any)?.built_image : undefined)
          const nextValue: ImageReferenceValue = fallbackImage
            ? {
                optionId: fallbackImage.id ?? null,
                image: fallbackImage.image,
                tag: fallbackImage.tag
              }
            : {
                optionId: null,
                image: parsed.image,
                tag: parsed.tag
              }

          const fallbackFullImage = fallbackImage?.full_image ?? (nextValue.image ? formatImageReference(nextValue.image, nextValue.tag) : null)

          const shouldApplySelection =
            !selectedImage ||
            (!imageSelectionManuallyChangedRef.current &&
              (lastAppliedActiveImageRef.current.id !== (fallbackImage?.id ?? null) ||
                lastAppliedActiveImageRef.current.fullImage !== fallbackFullImage))

          if (shouldApplySelection) {
            setSelectedServiceImageId(fallbackImage?.id ?? null)
            setImagePickerValue(nextValue)
            imageSelectionManuallyChangedRef.current = false
            lastAppliedActiveImageRef.current = {
              id: fallbackImage?.id ?? null,
              fullImage: fallbackFullImage ?? null
            }
          } else if (selectedImage) {
            const selectedValue: ImageReferenceValue = {
              optionId: selectedImage.id ?? null,
              image: selectedImage.image,
              tag: selectedImage.tag
            }
            setImagePickerValue((prev) =>
              prev.optionId === selectedValue.optionId && isImageReferenceEqual(prev, selectedValue) ? prev : selectedValue
            )
          }
        } else {
          setSuccessfulServiceImages([])
        }
      } catch (error: any) {
        const message = error?.message || '加载镜像列表失败'
        setImagesError(message)
        if (showToast) {
          toast.error(message)
        }
      } finally {
        setImagesLoading(false)
      }
    },
    [deployments, selectedServiceImageId, service?.built_image, service?.type, serviceId]
  )

  // 加载服务详情
  const loadService = useCallback(async () => {
    if (!serviceId) return

    try {
      setLoading(true)
      const data = await serviceSvc.getServiceById(serviceId)

      if (!data) {
        toast.error('服务不存在')
        router.push(`/projects/${projectId}`)
        return
      }

      setService(data)
      setEditedService(data)
      initializeNetworkState(data)

      if (data.project_id) {
        try {
          const projectDetail = await projectSvc.getProjectById(data.project_id)
          setProject(projectDetail)
        } catch (projectError: any) {
          console.error('加载项目失败：', projectError)
        }
      } else {
        setProject(null)
      }

      // 初始化环境变量
      if (data.env_vars) {
        setEnvVars(Object.entries(data.env_vars).map(([key, value]) => ({ key, value: value as string })))
      } else {
        setEnvVars([])
      }

      // 初始化卷挂载
      if (data.volumes) {
        setVolumes(data.volumes as any)
      } else {
        setVolumes([])
      }

      // 初始化资源限制
      const cpuLimit = data.resource_limits?.cpu
      const memoryLimit = data.resource_limits?.memory
      const parsedCpu = parseResourceValue(cpuLimit, 'cpu')
      const parsedMemory = parseResourceValue(memoryLimit, 'memory')
      setCpuValue(parsedCpu.value)
      setCpuUnit(parsedCpu.unit as 'm' | 'core')
      setMemoryValue(parsedMemory.value)
      setMemoryUnit(parsedMemory.unit as 'Mi' | 'Gi')

      if ((data.type ?? '').toLowerCase() === ServiceType.APPLICATION) {
        const parsedBuiltImage = parseImageReference(data.built_image)
        setImagePickerValue({ optionId: null, image: parsedBuiltImage.image, tag: parsedBuiltImage.tag })
        setSelectedServiceImageId(null)
        // 直接调用 loadServiceImages 而不依赖它，避免循环依赖
        void loadServiceImages()
      } else {
        setServiceImages([])
        setSuccessfulServiceImages([])
        setImagePagination({
          total: 0,
          totalPages: 0,
          page: 1,
          pageSize: IMAGE_HISTORY_PAGE_SIZE,
          hasNext: false,
          hasPrevious: false
        })
        setImagesError(null)
        setSelectedServiceImageId(null)
        setImagesLoading(false)
        setImagePickerValue({ optionId: null, image: '', tag: undefined })
      }
    } catch (error: any) {
      toast.error('加载服务失败：' + error.message)
      router.push(`/projects/${projectId}`)
    } finally {
      setLoading(false)
    }
  }, [initializeNetworkState, loadServiceImages, projectId, router, serviceId])

  const fetchK8sStatus = useCallback(
    async (options: { showToast?: boolean } = {}) => {
      if (!serviceId) {
        return null
      }

      const { showToast = false } = options

      try {
        setK8sStatusLoading(true)
        setK8sStatusError(null)
        const data = await serviceSvc.getK8sServiceStatus(serviceId)
        setK8sStatusInfo(data)

        const inlineError =
          typeof data?.error === 'string' ? data.error.trim() : ''
        const effectiveInlineError = inlineError.length > 0 ? inlineError : null

        setK8sStatusError(effectiveInlineError)

        if (showToast && effectiveInlineError) {
          toast.warning(effectiveInlineError)
        }

        return data
      } catch (error: any) {
        const message = error?.message || '获取 Kubernetes 状态失败'
        setK8sStatusInfo(null)
        setK8sStatusError(message)

        if (showToast) {
          toast.error(message)
        }

        return null
      } finally {
        setK8sStatusLoading(false)
      }
    },
    [serviceId]
  )

  const loadDeployments = useCallback(async (showToast = false) => {
    if (!serviceId) return

    try {
      setDeploymentsLoading(true)
      setDeploymentsError(null)
      const data = await serviceSvc.getServiceDeployments(serviceId)
      setDeployments(data)
    } catch (error: any) {
      const message = error?.message || '加载部署历史失败'
      setDeploymentsError(message)
      if (showToast) {
        toast.error('加载部署历史失败：' + message)
      }
    } finally {
      setDeploymentsLoading(false)
    }
  }, [serviceId])

  const loadLogs = useCallback(async (showToast = false) => {
    if (!serviceId) return

    try {
      setLogsLoading(true)
      setLogsError(null)
      const result = await serviceSvc.getServiceLogs(serviceId, LOGS_LINE_COUNT)

      if (result.error) {
        setLogs('')
        setLogsError(result.error)
        if (showToast) {
          toast.error('加载日志失败：' + result.error)
        }
      } else {
        setLogs(result.logs || '')
        setLogsError(null)
      }
    } catch (error: any) {
      const message = error?.message || '加载日志失败'
      setLogs('')
      setLogsError(message)
      if (showToast) {
        toast.error('加载日志失败：' + message)
      }
    } finally {
      setLogsLoading(false)
      setHasLoadedLogs(true)
    }
  }, [serviceId])

  const loadYAML = useCallback(async (showToast = false) => {
    if (!serviceId) return

    try {
      setYamlLoading(true)
      setYamlError(null)
      const yaml = await serviceSvc.getServiceYAML(serviceId)
      setYamlContent(yaml)
      if (showToast) {
        toast.success('YAML 已刷新')
      }
    } catch (error: any) {
      const errorMsg = error.message || '未知错误'
      setYamlError(errorMsg)
      if (showToast) {
        toast.error(`YAML 加载失败：${errorMsg}`)
      }
    } finally {
      setYamlLoading(false)
    }
  }, [serviceId])

  useEffect(() => {
    setK8sStatusInfo(null)
    setK8sStatusError(null)
    void loadService()
    void fetchK8sStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId])

  useEffect(() => {
    if (service?.type === ServiceType.APPLICATION) {
      setBuildBranch((prev) => (prev.trim() ? prev : service?.git_branch || 'main'))
    } else {
      setBuildBranch('')
      setBuildTag('')
    }
  }, [service?.git_branch, service?.type])

  useEffect(() => {
    if (service?.type !== ServiceType.APPLICATION) {
      return
    }

    if (!normalizedBranchValue) {
      return
    }

    setBuildBranch((prev) => (prev.trim() ? prev : normalizedBranchValue))
  }, [normalizedBranchValue, service?.type])

  useEffect(() => {
    if (!serviceId) return
    setDeployments([])
    setDeploymentsError(null)
    setHasLoadedLogs(false)
    setLogs('')
    setLogsError(null)
    setDeploymentsLoading(true)
    void loadDeployments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId])

  useEffect(() => {
    if (activeTab === 'deployments') {
      void loadDeployments()
    }

    if (activeTab === 'logs' && !hasLoadedLogs) {
      void loadLogs()
    }

    if (activeTab === 'yaml' && !yamlContent) {
      void loadYAML()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, hasLoadedLogs, yamlContent])

  // 启动服务
  const handleStart = async () => {
    if (!serviceId) return
    try {
      // 调用真正的 K8s 启动API
      await serviceSvc.startService(serviceId)
      toast.success('服务启动成功')
      await loadService()
      await fetchK8sStatus({ showToast: true })
    } catch (error: any) {
      toast.error('启动失败：' + error.message)
    }
  }

  // 停止服务
  const handleStop = async () => {
    if (!serviceId) return
    try {
      // 调用真正的 K8s 停止API
      await serviceSvc.stopService(serviceId)
      toast.success('服务已停止')
      await loadService()
      await fetchK8sStatus({ showToast: true })
    } catch (error: any) {
      toast.error('停止失败：' + error.message)
    }
  }

  // 重启服务
  const handleRestart = async () => {
    if (!serviceId) return
    try {
      // 调用真正的 K8s 重启 API
      await serviceSvc.restartService(serviceId)
      toast.success('服务重启成功')
      await loadService()
      await fetchK8sStatus({ showToast: true })
    } catch (error: any) {
      toast.error('重启失败：' + error.message)
    }
  }

  // 删除服务
  const handleDelete = async () => {
    if (!serviceId || !confirm('确定要删除这个服务吗？')) return

    try {
      const result = await serviceSvc.deleteService(serviceId)
      toast.success(result.message || '服务删除成功')
      if (result.warning) {
        toast.warning(result.warning)
      }
      router.push(`/projects/${projectId}`)
    } catch (error: any) {
      toast.error('删除失败：' + error.message)
    }
  }

  // 部署服务（所有类型）
  const handleDeploy = async () => {
    if (!serviceId || !service) return

    // 如果是Application类型,弹出镜像选择对话框
    if (service.type === ServiceType.APPLICATION) {
      setDeployDialogOpen(true)
      setDeployImagePage(1)
      setSelectedDeployImageId(null)
      void loadDeployImages(1)
      return
    }

    // 其他类型直接部署
    const confirmMessage = service.type === ServiceType.DATABASE
      ? '确定要部署此数据库服务吗？'
      : '确定要部署此镜像服务吗？'

    if (!confirm(confirmMessage)) return

    try {
      setDeploying(true)
      const result = await serviceSvc.deployService(serviceId)
      toast.success(result?.message || '部署成功，服务正在启动')
      await loadService()
      await fetchK8sStatus({ showToast: true })
      await loadDeployments()
      if (activeTab === 'logs') {
        await loadLogs()
      } else {
        setHasLoadedLogs(false)
        setLogs('')
        setLogsError(null)
      }
    } catch (error: any) {
      toast.error('部署失败：' + (error.message || '未知错误'))
    } finally {
      setDeploying(false)
    }
  }

  // 加载部署对话框的镜像列表
  const loadDeployImages = async (page: number) => {
    if (!serviceId) return

    try {
      setDeployImageLoading(true)
      const result = await serviceSvc.getServiceImages(serviceId, {
        page,
        pageSize: DEPLOY_IMAGE_PAGE_SIZE,
        status: 'success'
      })

      setDeployImageList(result.items)
      setDeployImageTotal(result.total)
      setDeployImagePage(page)
    } catch (error: any) {
      toast.error('加载镜像列表失败：' + (error.message || '未知错误'))
    } finally {
      setDeployImageLoading(false)
    }
  }

  // 执行部署(从对话框)
  const handleConfirmDeploy = async () => {
    if (!serviceId || !selectedDeployImageId) {
      toast.error('请选择要部署的镜像版本')
      return
    }

    try {
      setDeploying(true)
      setDeployDialogOpen(false)
      imageSelectionManuallyChangedRef.current = false

      const result = await serviceSvc.deployService(serviceId, {
        serviceImageId: selectedDeployImageId
      })

      toast.success(result?.message || '部署成功，服务正在启动')
      await loadService()
      await fetchK8sStatus({ showToast: true })
      await loadServiceImages({ page: 1 })
      await loadDeployments()
      if (activeTab === 'logs') {
        await loadLogs()
      } else {
        setHasLoadedLogs(false)
        setLogs('')
        setLogsError(null)
      }
    } catch (error: any) {
      toast.error('部署失败：' + (error.message || '未知错误'))
    } finally {
      setDeploying(false)
    }
  }

  const handleImagePickerChange = (value: ImageReferenceValue) => {
    imageSelectionManuallyChangedRef.current = true
    setImagePickerValue(value)
    setSelectedServiceImageId(value.optionId ?? null)
  }

  const handleRefreshImages = () => {
    if (service?.type === ServiceType.APPLICATION) {
      const currentPage = imagePagination.page > 0 ? imagePagination.page : 1
      void loadServiceImages({ showToast: true, page: currentPage })
    }
  }

  const handleActivateImage = async () => {
    if (!serviceId) return

    if (!selectedServiceImageId) {
      toast.error('请选择需要部署的镜像版本。')
      return
    }

    if (selectedServiceImageId === activeServiceImageId) {
      toast.success('该镜像已是当前部署版本。')
      return
    }

    try {
      setActivateImageLoading(true)
      const result = await serviceSvc.activateServiceImage(serviceId, selectedServiceImageId)
      toast.success('部署镜像已更新')
      imageSelectionManuallyChangedRef.current = false
      if (result.service) {
        setService(result.service)
        setEditedService(result.service)
      }
      const currentPage = imagePagination.page > 0 ? imagePagination.page : 1
      await loadServiceImages({ page: currentPage })
    } catch (error: any) {
      toast.error('镜像选择失败：' + (error.message || '未知错误'))
    } finally {
      setActivateImageLoading(false)
    }
  }

  // 直接部署指定镜像
  const handleDeployImage = async (imageId: string | null) => {
    if (!serviceId || !imageId) return

    try {
      setDeploying(true)

      // 先激活镜像
      const activateResult = await serviceSvc.activateServiceImage(serviceId, imageId)
      imageSelectionManuallyChangedRef.current = false
      if (activateResult.service) {
        setService(activateResult.service)
        setEditedService(activateResult.service)
      }

      // 再执行部署
      const deployResult = await serviceSvc.deployService(serviceId, {
        serviceImageId: imageId
      })

      toast.success(deployResult?.message || '部署成功，服务正在启动')

      // 刷新所有状态
      await loadService()
      await fetchK8sStatus({ showToast: true })
      await loadServiceImages({ page: 1 })
      await loadDeployments()

      if (activeTab === 'logs') {
        await loadLogs()
      } else {
        setHasLoadedLogs(false)
        setLogs('')
        setLogsError(null)
      }
    } catch (error: any) {
      toast.error('部署失败：' + (error.message || '未知错误'))
    } finally {
      setDeploying(false)
    }
  }

  const generateImageTag = () => {
    const now = new Date()
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`

    switch (buildTagType) {
      case 'dev':
        return `dev-${timestamp}`
      case 'test':
        return `test-${timestamp}`
      case 'release':
        return `release-${timestamp}`
      default:
        return timestamp
    }
  }

  const handleBuildImage = async () => {
    if (!serviceId) return

    const payload: { branch?: string; tag?: string } = {}
    const branchValue = (service?.type === 'application' ? (service as any)?.git_branch?.trim() : '') || 'main'
    const tagValue = customBuildTag.trim()

    payload.branch = branchValue

    if (tagValue) {
      payload.tag = tagValue
    }

    try {
      setBuildingImage(true)
      setBuildDialogOpen(false)
      const result = await serviceSvc.buildApplicationService(serviceId, payload)
      const buildNumberText = result.build?.buildNumber ? ` #${result.build.buildNumber}` : ''
      toast.success(`Jenkins 构建任务已触发${buildNumberText}`)
      if (result.service) {
        setService(result.service)
        setEditedService(result.service)
      }
      setCustomBuildTag('')
      setBuildTagType('dev')
      await loadServiceImages({ showToast: true, page: 1 })
      setActiveTab((prev) => (prev === 'deployments' ? prev : 'deployments'))
    } catch (error: any) {
      toast.error('镜像构建失败：' + (error.message || '未知错误'))
    } finally {
      setBuildingImage(false)
    }
  }

  const handleOpenBuildDialog = () => {
    const generated = generateImageTag()
    setCustomBuildTag(generated)
    setBuildDialogOpen(true)
  }

  useEffect(() => {
    if (buildDialogOpen) {
      const generated = generateImageTag()
      setCustomBuildTag(generated)
    }
  }, [buildTagType, buildDialogOpen])

  // 保存配置
  const handleSave = async () => {
    if (!serviceId) return

    try {
      const previousNetworkConfigSerialized = JSON.stringify(service?.network_config ?? null)
      // 合并环境变量
      const envVarsObj: Record<string, string> = {}
      envVars.forEach(({ key, value }) => {
        if (key.trim()) {
          envVarsObj[key] = value
        }
      })

      const updateData: Record<string, unknown> = {
        ...editedService,
        env_vars: envVarsObj,
        volumes: volumes.filter((v) => v.container_path.trim())
      }

      // 组合资源限制
      const cpuLimit = combineResourceValue(cpuValue, cpuUnit)
      const memoryLimit = combineResourceValue(memoryValue, memoryUnit)
      if (cpuLimit || memoryLimit) {
        updateData.resource_limits = {
          ...(cpuLimit ? { cpu: cpuLimit } : {}),
          ...(memoryLimit ? { memory: memoryLimit } : {})
        }
      }

      const portsPayload: NetworkPortConfig[] = []
      let networkError: string | null = null

      for (const port of networkPorts) {
        const hasInput =
          port.containerPort.trim().length > 0 ||
          port.servicePort.trim().length > 0 ||
          port.nodePort.trim().length > 0 ||
          port.enableDomain

        const containerPortValue = parseInt(port.containerPort.trim(), 10)

        if (!Number.isInteger(containerPortValue) || containerPortValue <= 0) {
          if (hasInput) {
            networkError = '请为启用的网络配置填写有效的容器端口。'
            break
          }
          continue
        }

        const servicePortInput = port.servicePort.trim()
        const parsedServicePort = servicePortInput ? parseInt(servicePortInput, 10) : containerPortValue
        const servicePortNumber =
          Number.isInteger(parsedServicePort) && parsedServicePort > 0
            ? parsedServicePort
            : containerPortValue

        const portPayload: NetworkPortConfig = {
          container_port: containerPortValue,
          service_port: servicePortNumber,
          protocol: port.protocol ?? 'TCP'
        }

        if (networkServiceType === 'NodePort') {
          const nodePortInput = port.nodePort.trim()
          if (nodePortInput) {
            const parsedNodePort = parseInt(nodePortInput, 10)
            if (!Number.isInteger(parsedNodePort) || parsedNodePort <= 0) {
              networkError = 'NodePort 端口必须是正整数。'
              break
            }
            portPayload.node_port = parsedNodePort
          }
        }

        if (port.enableDomain) {
          if (!projectIdentifier) {
            networkError = '启用域名访问前，请先在项目中配置项目编号。'
            break
          }

          const effectivePrefix = sanitizeDomainLabel(port.domainPrefix || defaultDomainPrefix)
          if (!effectivePrefix) {
            networkError = '域名前缀不能为空，请使用小写字母、数字或中划线。'
            break
          }

          portPayload.domain = {
            enabled: true,
            prefix: effectivePrefix,
            host: `${effectivePrefix}.${domainSuffixText}`
          }
        }

        portsPayload.push(portPayload)
      }

      if (networkError) {
        toast.error(networkError)
        return
      }

      if (portsPayload.length > 0) {
        updateData.network_config = {
          service_type: networkServiceType,
          ports: portsPayload
        }
      } else {
        updateData.network_config = null
      }

      const nextNetworkConfigSerialized = JSON.stringify(updateData.network_config ?? null)
      const networkConfigChanged = previousNetworkConfigSerialized !== nextNetworkConfigSerialized

      if (service && service.type === ServiceType.DATABASE) {
        const originalDatabase = service as DatabaseService
        const rawType =
          typeof updateData.database_type === 'string'
            ? updateData.database_type.toLowerCase()
            : typeof originalDatabase.database_type === 'string'
              ? originalDatabase.database_type.toLowerCase()
              : ''

        const supportedType: SupportedDatabaseType | null =
          rawType === DatabaseType.MYSQL || rawType === DatabaseType.REDIS
            ? (rawType as SupportedDatabaseType)
            : null

        if (supportedType) {
          updateData.database_type = supportedType

          const hostValue =
            typeof updateData.internal_host === 'string' && updateData.internal_host.trim().length > 0
              ? updateData.internal_host.trim()
              : originalDatabase.internal_host ?? ''
          const portValue =
            typeof updateData.port === 'number'
              ? updateData.port
              : typeof originalDatabase.port === 'number'
                ? originalDatabase.port
                : DATABASE_TYPE_METADATA[supportedType].defaultPort
          let usernameValue =
            supportedType === DatabaseType.MYSQL
              ? (typeof updateData.username === 'string'
                  ? updateData.username
                  : originalDatabase.username ?? '')
              : ''
          let passwordValue =
            typeof updateData.password === 'string'
              ? updateData.password
              : originalDatabase.password ?? ''
          let databaseNameValue =
            supportedType === DatabaseType.MYSQL
              ? (typeof updateData.database_name === 'string'
                  ? updateData.database_name
                  : originalDatabase.database_name ?? '')
              : ''

          if (supportedType === DatabaseType.MYSQL) {
            usernameValue = usernameValue.trim()
            if (!usernameValue) {
              usernameValue = (originalDatabase.username ?? 'admin').trim()
            }
            updateData.username = usernameValue

            databaseNameValue = databaseNameValue.trim()
            if (!databaseNameValue) {
              databaseNameValue = (
                originalDatabase.database_name ??
                originalDatabase.name ??
                ''
              ).trim()
            }
            updateData.database_name = databaseNameValue

            if (typeof updateData.root_password === 'string') {
              updateData.root_password = updateData.root_password.trim()
            }
          } else {
            delete updateData.username
            delete updateData.database_name
            delete updateData.root_password
            usernameValue = ''
            databaseNameValue = ''
          }

          if (typeof updateData.password === 'string') {
            passwordValue = updateData.password.trim()
            updateData.password = passwordValue
          } else {
            passwordValue = passwordValue.trim()
          }

          const connectionUrl = buildDatabaseConnectionUrl(
            supportedType,
            hostValue,
            portValue,
            usernameValue,
            passwordValue,
            databaseNameValue
          )

          if (connectionUrl) {
            updateData.internal_connection_url = connectionUrl
          }

          if (hostValue) {
            updateData.internal_host = hostValue
          } else {
            delete updateData.internal_host
          }
        } else {
          delete updateData.database_type
        }
      }

      if (service && service.type === ServiceType.IMAGE) {
        const imageService = service as any
        const rawImage =
          typeof updateData.image === 'string'
            ? updateData.image
            : imageService.image

        const trimmedImage = rawImage?.trim()

        if (!trimmedImage) {
          toast.error('镜像名称不能为空')
          return
        }

        updateData.image = trimmedImage

        if (typeof updateData.tag === 'string') {
          const trimmedTag = updateData.tag.trim()
          updateData.tag = trimmedTag ? trimmedTag : null
        }
      }

      await serviceSvc.updateService(serviceId, updateData)
      toast.success('配置保存成功')

      if (networkConfigChanged) {
        markPendingNetworkDeploy()
        toast.info('网络配置已更新，需要重新部署后才能生效。')
      }

      setIsEditing(false)
      loadService()
    } catch (error: any) {
      toast.error('保存失败：' + error.message)
    }
  }

  const addNetworkPort = () => {
    setNetworkPorts((ports) => [...ports, createEmptyPort()])
  }

  const removeNetworkPort = (id: string) => {
    setNetworkPorts((ports) => (ports.length > 1 ? ports.filter((port) => port.id !== id) : ports))
  }

  const updatePortField = <K extends keyof NetworkPortFormState>(
    id: string,
    field: K,
    value: NetworkPortFormState[K]
  ) => {
    setNetworkPorts((ports) =>
      ports.map((port) => (port.id === id ? { ...port, [field]: value } : port))
    )
  }

  const handleDomainPrefixChange = (id: string, value: string) => {
    updatePortField(id, 'domainPrefix', sanitizeDomainLabel(value))
  }

  const handleToggleDomain = (id: string, enabled: boolean) => {
    updatePortField(id, 'enableDomain', enabled)
  }

  const handleToggleExternalAccess = useCallback(async () => {
    if (!service || !service.id) {
      toast.error('服务信息缺失，无法更新外部访问配置。')
      return
    }

    const targetEnabled = !externalAccessEnabled

    setExternalAccessUpdating(true)

    try {
      const result = await serviceSvc.toggleDatabaseExternalAccess(service.id, targetEnabled)
      await loadService()
      toast.success(result.message || (targetEnabled ? '外部访问已开启' : '已关闭外部访问'))
      setIsEditing(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新外部访问配置失败'
      toast.error(message)
    } finally {
      setExternalAccessUpdating(false)
    }
  }, [externalAccessEnabled, loadService, service, setIsEditing])

  // 添加环境变量
  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
  }

  // 删除环境变量
  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
  }

  // 更新环境变量
  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...envVars]
    newEnvVars[index][field] = value
    setEnvVars(newEnvVars)
  }

  // 应用卷挂载模板
  const applyVolumeTemplate = () => {
    if (!service || !project) return

    const imageName = service.type === ServiceType.IMAGE ? (service as any).image : ''
    const template = findVolumeTemplate(imageName)

    if (!template) {
      toast.error(`未找到 "${imageName}" 的预设模板`)
      return
    }

    const newVolumes = template.volumes.map(v => ({
      nfs_subpath: generateNFSSubpath(service.name, v.container_path),
      container_path: v.container_path,
      read_only: v.read_only || false
    }))

    setVolumes(newVolumes)
    toast.success(`已应用 ${template.displayName} 模板，共 ${newVolumes.length} 个挂载点`)
  }

  // 添加卷挂载
  const addVolume = () => {
    setVolumes([...volumes, { nfs_subpath: '', container_path: '', read_only: false }])
  }

  // 删除卷挂载
  const removeVolume = (index: number) => {
    setVolumes(volumes.filter((_, i) => i !== index))
  }

  // 更新卷挂载
  const updateVolume = (index: number, field: string, value: any) => {
    const newVolumes = [...volumes]
      ; (newVolumes[index] as any)[field] = value
    setVolumes(newVolumes)
  }

  if (loading || !service) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  const normalizedDbStatus = normalizeServiceStatus(k8sStatusInfo?.dbStatus ?? service.status)
  let normalizedK8sStatus: ServiceStatus | null = null

  if (typeof k8sStatusInfo?.status === 'string') {
    const trimmedStatus = k8sStatusInfo.status.trim()

    if (trimmedStatus) {
      normalizedK8sStatus = normalizeServiceStatus(trimmedStatus)
    }
  }

  const normalizedStatus = normalizedK8sStatus ?? normalizedDbStatus
  const statusColor = STATUS_COLORS[normalizedStatus] ?? 'bg-gray-500'
  const statusLabel = STATUS_LABELS[normalizedStatus] ?? normalizedStatus
  const dbStatusLabel = STATUS_LABELS[normalizedDbStatus] ?? normalizedDbStatus
  const statusSourceLabel = normalizedK8sStatus ? 'Kubernetes 实时状态' : '数据库状态'
  const statusMismatch = normalizedK8sStatus !== null && normalizedK8sStatus !== normalizedDbStatus
  const k8sStatusErrorMessage = typeof k8sStatusError === 'string' ? k8sStatusError.trim() : ''
  const hasK8sStatusError = k8sStatusErrorMessage.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/projects/${projectId}`)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回
              </Button>

              <div className="flex items-start gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{service.name}</h1>
                <Badge variant="outline">
                  {service.type === ServiceType.APPLICATION && 'Application'}
                  {service.type === ServiceType.DATABASE && 'Database'}
                  {service.type === ServiceType.IMAGE && 'Image'}
                </Badge>
                <div className="flex flex-col gap-1 self-start">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                    <span className="text-sm text-gray-700">{statusLabel}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="刷新 Kubernetes 状态"
                      aria-label="刷新 Kubernetes 状态"
                      onClick={() => void fetchK8sStatus({ showToast: true })}
                      disabled={k8sStatusLoading}
                    >
                      {k8sStatusLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    {/* 只在没有K8s状态时显示数据源标签 */}
                    {!normalizedK8sStatus && <span>{statusSourceLabel}</span>}
                    {statusMismatch ? (
                      <span className="text-amber-600">数据库状态与实际不同步（{dbStatusLabel}）</span>
                    ) : null}
                    {/* K8s Pod 状态信息 */}
                    {normalizedK8sStatus && k8sStatusInfo ? (
                      <>
                        {typeof k8sStatusInfo.replicas === 'number' && k8sStatusInfo.replicas > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="font-medium">副本 {k8sStatusInfo.replicas}</span>
                            {typeof k8sStatusInfo.readyReplicas === 'number' ? (
                              <span className={k8sStatusInfo.readyReplicas === k8sStatusInfo.replicas ? 'text-green-600' : 'text-amber-600'}>
                                (就绪 {k8sStatusInfo.readyReplicas})
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                    {k8sStatusLoading ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        刷新中…
                      </span>
                    ) : null}
                  </div>
                  {hasK8sStatusError ? (
                    <div className="text-xs text-red-500 max-w-xs">{k8sStatusErrorMessage}</div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleOpenBuildDialog}
                disabled={buildingImage}
                variant="outline"
                className="gap-2"
              >
                <Box className={`w-4 h-4 ${buildingImage ? 'animate-spin' : ''}`} />
                {buildingImage ? '构建中...' : '构建'}
              </Button>
              {/* 部署按钮 - 所有服务类型都支持 */}
              <Button
                onClick={handleDeploy}
                disabled={deploying || normalizedStatus === 'building'}
                className="gap-2"
              >
                <Rocket className="w-4 h-4" />
                {deploying ? '部署中...' : '部署'}
              </Button>

              {normalizedStatus === 'stopped' && (
                <Button onClick={handleStart} className="gap-2">
                  <Play className="w-4 h-4" />
                  启动
                </Button>
              )}
              {normalizedStatus === 'running' && (
                <Button onClick={handleStop} variant="outline" className="gap-2">
                  <Square className="w-4 h-4" />
                  停止
                </Button>
              )}
              <Button onClick={handleRestart} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                重启
              </Button>
              <Button onClick={handleDelete} variant="destructive" className="gap-2">
                <Trash2 className="w-4 h-4" />
                删除
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="w-4 h-4" />
              通用配置
            </TabsTrigger>
            <TabsTrigger value="environment" className="gap-2">
              <FileText className="w-4 h-4" />
              环境变量
            </TabsTrigger>
            <TabsTrigger value="volumes" className="gap-2">
              <HardDrive className="w-4 h-4" />
              卷挂载
            </TabsTrigger>
            <TabsTrigger value="network" className="gap-2">
              <Globe className="w-4 h-4" />
              网络配置
            </TabsTrigger>
            <TabsTrigger value="yaml" className="gap-2">
              <FileCode className="w-4 h-4" />
              YAML 配置
            </TabsTrigger>
            <TabsTrigger value="deployments" className="gap-2">
              <Activity className="w-4 h-4" />
              部署历史
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Terminal className="w-4 h-4" />
              日志
            </TabsTrigger>
          </TabsList>

          {/* 通用配置 */}
          <TabsContent value="general" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">配置详情</h2>
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} variant="outline" className="gap-2">
                  <Settings className="w-4 h-4" />
                  编辑配置
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={handleSave} className="gap-2">
                    <Save className="w-4 h-4" />
                    保存
                  </Button>
                  <Button onClick={() => {
                    setIsEditing(false)
                    setEditedService(service)
                  }} variant="outline">
                    取消
                  </Button>
                </div>
              )}
            </div>

            {/* Application 配置 */}
            {service.type === ServiceType.APPLICATION && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Git 配置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>仓库 URL</Label>
                        <Input value={service.git_repository || '-'} disabled />
                      </div>
                      <div className="space-y-2">

                        <Label>项目路径</Label>
                        <Input
                          value={isEditing ? (editedService.git_path || '/') : (service.git_path || '/')}
                          onChange={(e) => setEditedService({ ...editedService, git_path: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>分支</Label>
                        {branchSelectorAvailable ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => void fetchBranches(undefined, { useDefaultBranch: false })}
                            disabled={branchSelectorDisabled || branchLoading}
                          >
                            {branchLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            刷新
                          </Button>
                        ) : null}
                      </div>
                      {branchSelectorAvailable ? (
                        <>
                          <Combobox
                            data={branchComboboxData}
                            type="分支"
                            value={normalizedBranchValue}
                            onValueChange={(value) => {
                              if (!isEditing) {
                                return
                              }
                              const trimmed = value.trim()
                              gitBranchRef.current = trimmed
                              setEditedService((prev: any) => ({ ...prev, git_branch: trimmed }))
                              setBuildBranch((prev) => (prev.trim() ? prev : trimmed))
                              branchInitialLoadRef.current = true
                              setBranchSearch('')
                            }}
                            open={branchPickerOpen}
                            onOpenChange={(open) => {
                              if (branchSelectorDisabled) {
                                setBranchPickerOpen(false)
                                return
                              }

                              setBranchPickerOpen(open)

                              if (!open) {
                                setBranchSearch('')
                                return
                              }

                              if (!branchOptions.length) {
                                void fetchBranches(undefined, { useDefaultBranch: !branchInitialLoadRef.current })
                              }
                            }}
                          >
                            <ComboboxTrigger
                              className="w-full justify-between gap-3 px-3 py-2 h-auto min-h-[44px]"
                              disabled={branchSelectorDisabled}
                            >
                              <div className="flex w-full flex-col items-start gap-1 text-left">
                                <span className="w-full truncate text-sm font-medium text-gray-900">
                                  {branchDisplayLabel}
                                </span>
                                <span className="w-full truncate text-xs text-gray-500">
                                  {repositoryIdentifier ? branchDisplayDescription : '请先确认仓库 URL'}
                                </span>
                              </div>
                            </ComboboxTrigger>
                            <ComboboxContent
                              className="max-h-72"
                              popoverOptions={{ className: 'w-[320px] sm:w-[360px] max-h-72 p-0' }}
                            >
                              <ComboboxInput
                                placeholder="搜索分支..."
                                value={branchSearch}
                                disabled={branchSelectorDisabled}
                                onValueChange={(value) => setBranchSearch(value)}
                              />
                              <ComboboxList className="max-h-60 overflow-y-auto py-1">
                                {branchLoading ? (
                                  <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    正在加载分支...
                                  </div>
                                ) : (
                                  <>
                                    <ComboboxEmpty>未找到匹配的分支</ComboboxEmpty>
                                    <ComboboxGroup className="space-y-1">
                                      {branchOptions.map((option) => (
                                        <ComboboxItem
                                          key={option.value}
                                          value={option.value}
                                          className="flex flex-col items-start gap-1 px-3 py-2"
                                        >
                                          <span className="text-sm font-medium text-gray-900">
                                            {option.label}
                                            {option.isDefault ? (
                                              <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                                默认
                                              </span>
                                            ) : null}
                                          </span>
                                          {option.description ? (
                                            <span className="text-xs text-gray-500">{option.description}</span>
                                          ) : null}
                                        </ComboboxItem>
                                      ))}
                                    </ComboboxGroup>
                                  </>
                                )}
                              </ComboboxList>
                              <ComboboxCreateNew
                                onCreateNew={(value) => {
                                  if (!isEditing) {
                                    return
                                  }
                                  const trimmed = value.trim()
                                  if (!trimmed) {
                                    return
                                  }
                                  gitBranchRef.current = trimmed
                                  setEditedService((prev: any) => ({ ...prev, git_branch: trimmed }))
                                  setBuildBranch((prev) => (prev.trim() ? prev : trimmed))
                                  branchInitialLoadRef.current = true
                                  setBranchSearch('')
                                }}
                              >
                                {(value) => <span>使用自定义分支 “{value}”</span>}
                              </ComboboxCreateNew>
                            </ComboboxContent>
                          </Combobox>
                          {branchError ? (
                            <p className="text-xs text-red-500">{branchError}</p>
                          ) : (
                            <p className="text-xs text-gray-500">
                              {branchSelectorDisabled
                                ? '开启编辑后可选择分支。'
                                : '可搜索 GitLab 分支，或输入自定义分支名。'}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <Input
                            value={isEditing ? (editedService.git_branch || 'main') : (service?.git_branch || 'main')}
                            onChange={(e) =>
                              setEditedService((prev: any) => ({ ...prev, git_branch: e.target.value }))
                            }
                            disabled={!isEditing}
                            placeholder="main"
                          />
                          {isGitConfigLoading ? (
                            <p className="text-xs text-gray-500">正在加载 Git 配置...</p>
                          ) : showGitlabConfigWarning ? (
                            <p className="text-xs text-yellow-600">
                              GitLab 配置不可用，当前无法搜索分支，请手动输入分支名称。
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>构建配置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>构建方式</Label>
                        <Input value={service.build_type || 'dockerfile'} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Dockerfile 路径</Label>
                        <Input
                          value={isEditing ? (editedService.dockerfile_path || 'Dockerfile') : (service.dockerfile_path || 'Dockerfile')}
                          onChange={(e) => setEditedService({ ...editedService, dockerfile_path: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>

                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>镜像版本</CardTitle>
                      <CardDescription>查看当前部署的镜像和历史构建版本。</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleRefreshImages}
                        disabled={imagesLoading}
                        className="gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${imagesLoading ? 'animate-spin' : ''}`} />
                        刷新
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 当前部署镜像 */}
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-3">
                      <p className="text-xs font-medium text-emerald-600">当前 K8s 部署镜像</p>
                      {ongoingDeploymentInfo ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-amber-700">
                                {latestActiveDeploymentInProgress?.status === 'pending' ? '等待部署' : '部署中'}
                              </p>
                              <p className="text-sm font-semibold text-amber-900">{ongoingDeploymentInfo.display}</p>
                              {ongoingImageBranch ? (
                                <p className="text-xs text-amber-700">分支 {ongoingImageBranch}</p>
                              ) : null}
                              {(() => {
                                const progressParts: string[] = []
                                if (
                                  typeof k8sStatusInfo?.updatedReplicas === 'number' &&
                                  typeof k8sStatusInfo?.replicas === 'number' &&
                                  k8sStatusInfo.replicas > 0
                                ) {
                                  const updated = Math.min(k8sStatusInfo.updatedReplicas, k8sStatusInfo.replicas)
                                  progressParts.push(`已更新 ${updated}/${k8sStatusInfo.replicas}`)
                                }
                                if (
                                  typeof k8sStatusInfo?.readyReplicas === 'number' &&
                                  typeof k8sStatusInfo?.replicas === 'number' &&
                                  k8sStatusInfo.replicas > 0
                                ) {
                                  const ready = Math.min(k8sStatusInfo.readyReplicas, k8sStatusInfo.replicas)
                                  progressParts.push(`就绪 ${ready}/${k8sStatusInfo.replicas}`)
                                }
                                if (progressParts.length === 0 && latestActiveDeploymentInProgress?.status === 'pending') {
                                  progressParts.push('等待调度中…')
                                }
                                if (progressParts.length > 0) {
                                  return <p className="text-xs text-amber-700">{progressParts.join(' · ')}</p>
                                }
                                return null
                              })()}
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-medium text-white">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {latestActiveDeploymentInProgress?.status === 'pending' ? '排队中' : '部署中'}
                            </span>
                          </div>
                        </div>
                      ) : latestDeployment?.status === 'failed' ? (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-red-700">部署失败</p>
                              <p className="text-sm font-semibold text-red-900">
                                {(() => {
                                  if (latestDeployment?.image_tag) {
                                    const parsed = parseImageReference(latestDeployment.image_tag)
                                    const label = parsed.image
                                      ? formatImageReference(parsed.image, parsed.tag)
                                      : latestDeployment.image_tag
                                    return label
                                  }
                                  return '未知镜像'
                                })()}
                              </p>
                              {latestDeployment?.build_logs ? (
                                <p className="text-xs text-red-700 line-clamp-2">{latestDeployment.build_logs}</p>
                              ) : null}
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-medium text-white">
                              <X className="h-3 w-3" />
                              失败
                            </span>
                          </div>
                        </div>
                      ) : null}
                      {currentDeploymentInfo ? (
                        <div
                          className={cn(
                            'rounded-md border px-3 py-2 flex items-start justify-between gap-3',
                            ongoingDeploymentInfo ? 'border-emerald-300 bg-white' : 'border-emerald-200 bg-white'
                          )}
                        >
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-emerald-700">正在运行</p>
                            <p className="text-sm font-semibold text-emerald-900">{currentDeploymentInfo.display}</p>
                            {activeImageBranch ? (
                              <p className="text-xs text-emerald-700">分支 {activeImageBranch}</p>
                            ) : null}
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white">
                            <Check className="h-3 w-3" />
                            当前部署
                          </span>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">尚未部署任何镜像</p>
                          {builtImageDisplay ? (
                            <p className="mt-1 text-xs text-emerald-700">最近构建：{builtImageDisplay}</p>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* 历史镜像列表 */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">历史镜像</Label>
                      {imagesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                          <span className="ml-2 text-sm text-gray-500">加载中...</span>
                        </div>
                      ) : serviceImages.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center">
                          <p className="text-sm text-gray-500">暂无镜像记录，请先触发 Jenkins 构建。</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {serviceImages.map((image) => {
                            const status = (image.build_status ?? 'pending') as ServiceImageStatus
                            const meta = IMAGE_STATUS_META[status]
                            const matchesActiveById = activeServiceImageId && image.id === activeServiceImageId
                            const matchesActiveByFullImage =
                              activeServiceImageFullImage && image.full_image === activeServiceImageFullImage
                            const isActive = Boolean(matchesActiveById || matchesActiveByFullImage)
                            const isDeployable = status === 'success'
                            const isUpdating = Boolean(
                              ongoingDeploymentInfo &&
                                ((ongoingDeploymentInfo.id && image.id === ongoingDeploymentInfo.id) ||
                                  (ongoingDeploymentFullImage && image.full_image === ongoingDeploymentFullImage))
                            )
                            const metadata =
                              image.metadata && typeof image.metadata === 'object'
                                ? (image.metadata as Record<string, unknown>)
                                : null
                            const metadataBranch = metadata && typeof metadata['branch'] === 'string' ? (metadata['branch'] as string) : null
                            const metadataBuildUrl = metadata && typeof metadata['buildUrl'] === 'string' ? (metadata['buildUrl'] as string) : null

                            return (
                              <div
                                key={image.id}
                                className={cn(
                                  'rounded-lg border p-4 transition-all',
                                  isActive
                                    ? 'border-emerald-300 bg-emerald-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-semibold text-gray-900">
                                        {formatImageReference(image.image, image.tag)}
                                      </span>
                                      <span
                                        className={cn(
                                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                          meta.badgeClass
                                        )}
                                      >
                                        {meta.label}
                                      </span>
                                      {isActive ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white">
                                          <Check className="h-3 w-3" />
                                          当前部署
                                        </span>
                                      ) : null}
                                      {isUpdating && !isActive ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-medium text-white">
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          部署中
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                      {image.build_number ? <span>构建号 #{image.build_number}</span> : null}
                                      <span>创建于 {formatDateTime(image.created_at)}</span>
                                      {metadataBranch ? <span>分支 {metadataBranch}</span> : null}
                                      {metadataBuildUrl ? (
                                        <a
                                          href={metadataBuildUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                                        >
                                          <span>查看构建任务</span>
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      ) : null}
                                    </div>
                                    {image.build_logs && status === 'failed' ? (
                                      <p className="text-xs text-red-600 line-clamp-2 break-all overflow-hidden">{image.build_logs}</p>
                                    ) : null}
                                  </div>
                                  <div className="flex-shrink-0">
                                    {isActive ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled
                                        className="gap-2"
                                      >
                                        <Check className="h-4 w-4" />
                                        已部署
                                      </Button>
                                    ) : isDeployable ? (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => handleDeployImage(image.id ?? null)}
                                        disabled={deploying || isUpdating}
                                        className="gap-2"
                                      >
                                        <Rocket className={`h-4 w-4 ${deploying || isUpdating ? 'animate-spin' : ''}`} />
                                        {deploying || isUpdating ? '部署中...' : '部署'}
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled
                                      >
                                        不可用
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {imagesError ? (
                        <p className="text-sm text-red-600">{imagesError}</p>
                      ) : null}
                    </div>

                    {/* 分页 */}
                    {imagePagination.totalPages > 1 && (
                      <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-gray-500">
                          {imageHistoryStats ? (
                            <>
                              第 {imageHistoryStats.page} / {imageHistoryStats.totalPages} 页 · 显示第 {imageHistoryStats.start}-{imageHistoryStats.end} 条 · 共 {imageHistoryStats.total} 条
                            </>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void loadServiceImages({ page: Math.max((imageHistoryStats?.page ?? 1) - 1, 1) })
                            }
                            disabled={!imagePagination.hasPrevious || imagesLoading}
                          >
                            上一页
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void loadServiceImages({ page: (imageHistoryStats?.page ?? 1) + 1 })
                            }
                            disabled={!imagePagination.hasNext || imagesLoading}
                          >
                            下一页
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>部署与资源配置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>副本数</Label>
                        <Input
                          type="number"
                          value={isEditing ? (editedService.replicas || 1) : (service.replicas || 1)}
                          onChange={(e) => setEditedService({ ...editedService, replicas: parseInt(e.target.value) })}
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>自动部署</Label>
                        <Input value={service.auto_deploy ? '启用' : '禁用'} disabled />
                      </div>
                    </div>
                    {service.command && (
                      <div className="space-y-2">
                        <Label>启动命令</Label>
                        <Input
                          value={isEditing ? (editedService.command || '') : (service.command || '')}
                          onChange={(e) => setEditedService({ ...editedService, command: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">资源限制</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>CPU 限制</Label>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                placeholder="如: 1000"
                                value={cpuValue}
                                onChange={(e) => setCpuValue(e.target.value)}
                                className="flex-1"
                              />
                              <Select value={cpuUnit} onValueChange={(value: 'm' | 'core') => setCpuUnit(value)}>
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="m">m (millicores)</SelectItem>
                                  <SelectItem value="core">核 (cores)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <Input value={service.resource_limits?.cpu || '-'} disabled />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>内存限制</Label>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                placeholder="如: 512"
                                value={memoryValue}
                                onChange={(e) => setMemoryValue(e.target.value)}
                                className="flex-1"
                              />
                              <Select value={memoryUnit} onValueChange={(value: 'Mi' | 'Gi') => setMemoryUnit(value)}>
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Mi">Mi</SelectItem>
                                  <SelectItem value="Gi">Gi</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <Input value={service.resource_limits?.memory || '-'} disabled />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Database 配置 */}
            {service.type === ServiceType.DATABASE && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>数据库信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>数据库类型</Label>
                        <Input value={databaseTypeLabel} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>版本</Label>
                        <Input
                          value={
                            isEditing
                              ? editedDatabaseService?.version ?? databaseVersionValue
                              : databaseVersionValue
                          }
                          onChange={(e) => setEditedService({ ...editedService, version: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                    <div
                      className={`grid gap-4 grid-cols-1 ${isMysqlDatabase ? 'md:grid-cols-2' : ''}`}
                    >
                      {isMysqlDatabase && (
                        <div className="space-y-2">
                          <Label>数据库名</Label>
                          <Input
                            value={databaseNameInputValue}
                            onChange={(e) =>
                              setEditedService({ ...editedService, database_name: e.target.value })
                            }
                            disabled={!isEditing}
                            placeholder="与服务名相同"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>存储大小</Label>
                        <Input
                          value={databaseVolumeSizeInputValue}
                          onChange={(e) =>
                            setEditedService({ ...editedService, volume_size: e.target.value })
                          }
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {(isMysqlDatabase || isRedisDatabase) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>认证信息</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isMysqlDatabase && (
                        <>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>用户名</Label>
                              {isEditing ? (
                                <Input
                                  value={databaseUsernameValue}
                                  onChange={(e) =>
                                    setEditedService({ ...editedService, username: e.target.value })
                                  }
                                />
                              ) : (
                                <div className="flex gap-2">
                                  <Input value={databaseUsernameValue || '-'} disabled className="flex-1" />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!databaseUsernameValue}
                                    onClick={() => {
                                      const value = databaseUsernameValue
                                      if (!value) return
                                      navigator.clipboard.writeText(value)
                                      toast.success('已复制')
                                    }}
                                  >
                                    复制
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label>数据库密码</Label>
                              {isEditing ? (
                                <Input
                                  type="text"
                                  value={databasePasswordValue}
                                  onChange={(e) =>
                                    setEditedService({ ...editedService, password: e.target.value })
                                  }
                                />
                              ) : (
                                <div className="flex gap-2">
                                  <Input
                                    type="password"
                                    value={databasePasswordValue || '-'}
                                    disabled
                                    className="flex-1"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!databasePasswordValue}
                                    onClick={() => {
                                      const value = databasePasswordValue
                                      if (!value) return
                                      navigator.clipboard.writeText(value)
                                      toast.success('已复制')
                                    }}
                                  >
                                    复制
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Root 密码</Label>
                            {isEditing ? (
                              <Input
                                type="text"
                                value={databaseRootPasswordValue}
                                onChange={(e) =>
                                  setEditedService({ ...editedService, root_password: e.target.value })
                                }
                              />
                            ) : (
                              <div className="flex gap-2">
                                <Input
                                  type="password"
                                  value={databaseRootPasswordValue || '-'}
                                  disabled
                                  className="flex-1"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!databaseRootPasswordValue}
                                  onClick={() => {
                                    const value = databaseRootPasswordValue
                                    if (!value) return
                                    navigator.clipboard.writeText(value)
                                    toast.success('已复制')
                                  }}
                                >
                                  复制
                                </Button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      {isRedisDatabase && (
                        <div className="space-y-2">
                          <Label>访问密码</Label>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={databasePasswordValue}
                              onChange={(e) =>
                                setEditedService({ ...editedService, password: e.target.value })
                              }
                            />
                          ) : (
                            <div className="flex gap-2">
                              <Input
                                type="password"
                                value={databasePasswordValue || '-'}
                                disabled
                                className="flex-1"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!databasePasswordValue}
                                onClick={() => {
                                  const value = databasePasswordValue
                                  if (!value) return
                                  navigator.clipboard.writeText(value)
                                  toast.success('已复制')
                                }}
                              >
                                复制
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>连接信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>内部主机</Label>
                      <div className="flex gap-2">
                        <Input value={databaseService?.internal_host || '-'} disabled className="flex-1" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const value = databaseService?.internal_host ?? ''
                            if (!value) return
                            navigator.clipboard.writeText(value)
                            toast.success('已复制')
                          }}
                        >
                          复制
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>连接 URL</Label>
                      <div className="flex gap-2">
                        <Input
                          value={databaseService?.internal_connection_url || '-'}
                          disabled
                          className="flex-1"
                          type="password"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const value = databaseService?.internal_connection_url ?? ''
                            if (!value) return
                            navigator.clipboard.writeText(value)
                            toast.success('已复制')
                          }}
                        >
                          复制
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>内部端口</Label>
                        <Input value={databaseService?.port ?? '-'} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>外部访问</Label>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={externalAccessEnabled ? 'default' : 'secondary'}>
                                {externalAccessEnabled ? '已开启' : '未开启'}
                              </Badge>
                              {externalAccessEnabled && (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={databaseService?.external_port ?? '-'}
                                    disabled
                                    className="w-28"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!(databaseService?.external_port && databaseService.external_port > 0)}
                                    onClick={() => {
                                      const value = databaseService?.external_port
                                      if (!value) return
                                      navigator.clipboard.writeText(String(value))
                                      toast.success('已复制')
                                    }}
                                  >
                                    复制
                                  </Button>
                                </div>
                              )}
                            </div>
                            {!externalAccessEnabled && (
                              <span className="text-sm text-gray-500">当前未对外开放访问</span>
                            )}
                            {externalAccessEnabled && (
                              <span className="text-xs text-gray-500">
                                如需关闭，请点击下方按钮，Kubernetes 将释放分配的端口。
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant={externalAccessEnabled ? 'outline' : 'default'}
                            onClick={() => {
                              void handleToggleExternalAccess()
                            }}
                            disabled={externalAccessUpdating}
                            className="gap-2"
                          >
                            {externalAccessUpdating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Globe className="h-4 w-4" />
                            )}
                            {externalAccessUpdating
                              ? '处理中…'
                              : externalAccessEnabled
                                ? '关闭外部访问'
                                : '开启外部访问'}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                          开启后平台会自动创建 NodePort 服务并回填外部访问端口。
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* 镜像配置 */}
            {service.type === ServiceType.IMAGE && (
              <Card>
                <CardHeader>
                  <CardTitle>镜像配置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ImageReferencePicker
                    value={imageServicePickerValue}
                    onChange={(next) => {
                      if (!isEditing) return
                      setEditedService({
                        ...editedService,
                        image: next.image,
                        tag: next.tag
                      })
                    }}
                    disabled={!isEditing}
                    imagePlaceholder="例如：nginx"
                    tagPlaceholder="latest"
                  />
                  {service.command && (
                    <div className="space-y-2">
                      <Label>启动命令</Label>
                      <Input
                        value={isEditing ? (editedService.command || '') : (service.command || '')}
                        onChange={(e) => setEditedService({ ...editedService, command: e.target.value })}
                        disabled={!isEditing}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>副本数</Label>
                    <Input
                      type="number"
                      value={isEditing ? (editedService.replicas || 1) : (service.replicas || 1)}
                      onChange={(e) => setEditedService({ ...editedService, replicas: parseInt(e.target.value) })}
                      disabled={!isEditing}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

          </TabsContent>

          {/* 环境变量 */}
          <TabsContent value="environment" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>环境变量</CardTitle>
                    <CardDescription>管理服务的环境变量配置</CardDescription>
                  </div>
                  <Button onClick={addEnvVar} size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    添加变量
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {envVars.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无环境变量，点击上方按钮添加</p>
                ) : (
                  <div className="space-y-2">
                    {envVars.map((env, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <Input
                          placeholder="变量名"
                          value={env.key}
                          onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="变量值"
                          value={env.value}
                          onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEnvVar(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {envVars.length > 0 && (
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} className="gap-2">
                      <Save className="w-4 h-4" />
                      保存环境变量
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 卷挂载 */}
          <TabsContent value="volumes" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>卷挂载配置</CardTitle>
                    <CardDescription>配置服务的持久化存储</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {service.type === ServiceType.IMAGE && findVolumeTemplate((service as any).image) && (
                      <Button
                        onClick={applyVolumeTemplate}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                      >
                        <HardDrive className="w-4 h-4" />
                        应用模板
                      </Button>
                    )}
                    <Button onClick={addVolume} size="sm" className="gap-2">
                      <Plus className="w-4 h-4" />
                      添加卷
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {service.type === ServiceType.IMAGE && findVolumeTemplate((service as any).image) && (
                  <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm">
                    <p className="text-blue-900 font-medium mb-1">
                      💡 检测到 {findVolumeTemplate((service as any).image)?.displayName} 预设模板
                    </p>
                    <p className="text-blue-700 text-xs">
                      点击上方「应用模板」按钮即可自动配置常用挂载目录，无需手动填写。
                    </p>
                  </div>
                )}
                {volumes.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无卷挂载，点击上方按钮添加</p>
                ) : (
                  <div className="space-y-4">
                    {volumes.map((volume, index) => (
                      <Card key={index}>
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex gap-2 items-start">
                              <div className="flex-1 space-y-2">
                                <Label>NFS 子路径（可选）</Label>
                                <Input
                                  placeholder="默认为 {serviceName}/{containerPath}"
                                  value={volume.nfs_subpath || ''}
                                  onChange={(e) => updateVolume(index, 'nfs_subpath', e.target.value)}
                                />
                                <p className="text-xs text-gray-500">
                                  留空则自动生成，前缀一定是服务名
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeVolume(index)}
                                className="text-red-600 hover:text-red-700 mt-7"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="space-y-2">
                              <Label>容器路径 *</Label>
                              <Input
                                placeholder="/path/in/container"
                                value={volume.container_path}
                                onChange={(e) => updateVolume(index, 'container_path', e.target.value)}
                              />
                              {volume.container_path && (() => {
                                const imageName = service.type === ServiceType.IMAGE ? (service as any).image : ''
                                const template = findVolumeTemplate(imageName)
                                const volumeTemplate = template?.volumes.find(v => v.container_path === volume.container_path)
                                return volumeTemplate?.description ? (
                                  <p className="text-xs text-blue-600">📌 {volumeTemplate.description}</p>
                                ) : null
                              })()}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`readonly-${index}`}
                                checked={volume.read_only}
                                onChange={(e) => updateVolume(index, 'read_only', e.target.checked)}
                                className="w-4 h-4"
                              />
                              <Label htmlFor={`readonly-${index}`}>只读模式</Label>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {volumes.length > 0 && (
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} className="gap-2">
                      <Save className="w-4 h-4" />
                      保存卷配置
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 网络配置 */}
          <TabsContent value="network" className="space-y-6">
            {hasPendingNetworkDeploy ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  网络配置尚未部署到 Kubernetes
                </div>
                <p className="text-sm text-amber-900/80">
                  保存的网络配置会在执行部署后才会生效
                  {service?.type === ServiceType.APPLICATION ? '，应用服务需要先选择镜像版本' : ''}
                  ，点击下方按钮即可立即触发部署。
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="gap-2 w-fit"
                  onClick={handleDeploy}
                  disabled={deploying}
                >
                  <Rocket className="w-4 h-4" />
                  立即部署
                </Button>
              </div>
            ) : null}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>网络配置</CardTitle>
                    <CardDescription>配置服务的端口暴露和访问方式</CardDescription>
                  </div>
                  <Button onClick={addNetworkPort} size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    添加端口
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Service 类型</Label>
                  <Select
                    value={networkServiceType}
                    onValueChange={(value) =>
                      setNetworkServiceType(value as 'ClusterIP' | 'NodePort' | 'LoadBalancer')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ClusterIP">ClusterIP（集群内部）</SelectItem>
                      <SelectItem value="NodePort">NodePort（节点端口）</SelectItem>
                      <SelectItem value="LoadBalancer">LoadBalancer（负载均衡）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {networkPorts.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    暂无网络端口，点击右上方按钮添加
                  </p>
                ) : (
                  <div className="space-y-4">
                    {networkPorts.map((port, index) => {
                      const resolvedPrefix = port.domainPrefix
                        ? sanitizeDomainLabel(port.domainPrefix)
                        : defaultDomainPrefix
                      const previewDomain = `${resolvedPrefix}.${domainSuffixText}`
                      return (
                        <div
                          key={port.id}
                          className="space-y-4 rounded-lg border border-gray-200 bg-white p-4"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-900">
                              端口配置 {index + 1}
                            </h4>
                            {networkPorts.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeNetworkPort(port.id)}
                                className="gap-1 text-red-600 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                                移除
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700">
                                容器监听端口 *
                              </Label>
                              <Input
                                type="number"
                                placeholder="8080"
                                value={port.containerPort}
                                onChange={(e) => updatePortField(port.id, 'containerPort', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700">Service 端口</Label>
                              <Input
                                type="number"
                                placeholder="默认同容器端口"
                                value={port.servicePort}
                                onChange={(e) => updatePortField(port.id, 'servicePort', e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700">协议</Label>
                              <Select
                                value={port.protocol}
                                onValueChange={(value) =>
                                  updatePortField(port.id, 'protocol', value as 'TCP' | 'UDP')
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="TCP">TCP</SelectItem>
                                  <SelectItem value="UDP">UDP</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {networkServiceType === 'NodePort' && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">NodePort 端口</Label>
                                <Input
                                  type="number"
                                  placeholder="30000-32767"
                                  value={port.nodePort}
                                  onChange={(e) => updatePortField(port.id, 'nodePort', e.target.value)}
                                />
                                <p className="text-xs text-gray-500">
                                  可选，范围 30000-32767，不填写自动分配
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={port.enableDomain}
                                onChange={(e) => handleToggleDomain(port.id, e.target.checked)}
                              />
                              启用域名访问
                            </label>
                            <p className="text-xs text-gray-500">
                              启用后可通过{' '}
                              <span className="font-mono text-gray-700">{previewDomain}</span> 访问该端口
                            </p>
                            {port.enableDomain && (
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-gray-700">域名前缀</Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      placeholder={defaultDomainPrefix}
                                      value={port.domainPrefix}
                                      onChange={(e) => handleDomainPrefixChange(port.id, e.target.value)}
                                    />
                                    <span className="text-sm text-gray-500">.{domainSuffixText}</span>
                                  </div>
                                </div>
                                <div className="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-600">
                                  实际域名：
                                  <span className="ml-1 font-mono text-gray-900">{previewDomain}</span>
                                </div>
                                {!projectIdentifier && (
                                  <p className="text-xs text-amber-600">
                                    项目尚未设置编号，保存前请先在项目详情中配置项目编号。
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {networkPorts.length > 0 && (
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} className="gap-2">
                      <Save className="w-4 h-4" />
                      保存网络配置
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* YAML 配置预览 */}
          <TabsContent value="yaml" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Kubernetes YAML 配置</CardTitle>
                  <CardDescription>
                    查看服务的 Kubernetes 部署配置（仅供预览，实际部署以保存的配置为准）
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (yamlContent) {
                        navigator.clipboard.writeText(yamlContent)
                        toast.success('已复制到剪贴板')
                      }
                    }}
                    disabled={!yamlContent || yamlLoading}
                  >
                    <FileText className="w-4 h-4" />
                    复制
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => loadYAML(true)}
                    disabled={yamlLoading}
                  >
                    <RefreshCw className={`w-4 h-4 ${yamlLoading ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {yamlLoading ? (
                  <div className="text-center py-16 text-gray-500">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
                    <p>生成 YAML 配置中...</p>
                  </div>
                ) : yamlError ? (
                  <div className="text-center py-16 space-y-4">
                    <p className="text-red-500">生成失败：{yamlError}</p>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => loadYAML(true)}>
                      <RefreshCw className="w-4 h-4" />
                      重试
                    </Button>
                  </div>
                ) : yamlContent ? (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm space-y-2">
                      <p className="text-blue-900 font-medium">💡 使用提示</p>
                      <ul className="text-blue-700 text-xs space-y-1 list-disc list-inside">
                        <li>此 YAML 基于当前保存的服务配置自动生成</li>
                        <li>可复制此配置用于其他 Kubernetes 环境</li>
                        <li>包含 Deployment 和 Service（如有网络配置）资源定义</li>
                        <li>修改配置后需点击“刷新”重新生成 YAML</li>
                      </ul>
                    </div>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs min-h-[400px] max-h-[600px] overflow-auto">
                      <pre className="whitespace-pre">{yamlContent}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-500">
                    <FileCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p>暂无 YAML 配置</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 部署历史 */}
          <TabsContent value="deployments" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>部署历史</CardTitle>
                  <CardDescription>
                    {service.type === ServiceType.APPLICATION
                      ? '查看应用的构建和部署记录'
                      : '查看服务的部署记录'}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => loadDeployments(true)}
                  disabled={deploymentsLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${deploymentsLoading ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {deploymentsLoading ? (
                  <div className="text-center py-10 text-gray-500">加载中...</div>
                ) : deploymentsError ? (
                  <div className="text-center py-10 text-red-500 space-y-3">
                    <p>加载部署历史失败：{deploymentsError}</p>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => loadDeployments(true)}>
                      <RefreshCw className="w-4 h-4" />
                      重试
                    </Button>
                  </div>
                ) : deployments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p>暂无部署记录</p>
                    {service.type === ServiceType.APPLICATION && (
                      <p className="text-sm mt-2 text-gray-400">点击顶部“部署”按钮触发构建</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {deployments.map((deployment) => {
                      const meta = DEPLOYMENT_STATUS_META[deployment.status] || DEPLOYMENT_STATUS_META.pending
                      const key = deployment.id || `${deployment.service_id}-${deployment.created_at}`
                      return (
                        <div key={key} className="rounded-lg border border-gray-200 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
                              {meta.label}
                            </span>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                              <span>开始：{formatDateTime(deployment.created_at)}</span>
                              {deployment.completed_at && (
                                <span>完成：{formatDateTime(deployment.completed_at)}</span>
                              )}
                              {deployment.completed_at && (
                                <span>耗时：{formatDuration(deployment.created_at, deployment.completed_at)}</span>
                              )}
                            </div>
                          </div>
                          {deployment.image_tag && (
                            <div className="text-sm text-gray-600">
                              镜像/版本：
                              <span className="font-mono text-gray-800">{deployment.image_tag}</span>
                            </div>
                          )}
                          {deployment.build_logs && (
                            <pre className="bg-gray-900 text-gray-100 text-xs font-mono p-3 rounded-md whitespace-pre-wrap overflow-x-auto">
                              {deployment.build_logs}
                            </pre>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 日志 */}
          <TabsContent value="logs" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>服务日志</CardTitle>
                  <CardDescription>查看服务最近的运行日志</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => loadLogs(true)}
                  disabled={logsLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm min-h-[400px] max-h-[500px] overflow-y-auto">
                  {logsLoading ? (
                    <p className="text-gray-400">日志加载中...</p>
                  ) : logsError ? (
                    <p className="text-red-400 whitespace-pre-wrap">加载日志失败：{logsError}</p>
                  ) : logs ? (
                    <pre className="whitespace-pre-wrap">{logs}</pre>
                  ) : (
                    <p className="text-gray-400">暂无日志</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 构建对话框 */}
      <Dialog open={buildDialogOpen} onOpenChange={setBuildDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>触发镜像构建</DialogTitle>
            <DialogDescription>
              配置构建参数，平台将调用 Jenkins 构建新镜像。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">构建分支</Label>
              <Input
                value={(service?.type === 'application' ? (service as any)?.git_branch : '') || 'main'}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">使用当前配置的分支进行构建</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">镜像版本类型</Label>
              <Select
                value={buildTagType}
                onValueChange={(value: 'dev' | 'test' | 'release') => setBuildTagType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev">开发版 (dev-*)</SelectItem>
                  <SelectItem value="test">测试版 (test-*)</SelectItem>
                  <SelectItem value="release">发布版 (release-*)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {buildTagType === 'dev' && '用于开发环境的镜像版本'}
                {buildTagType === 'test' && '用于测试环境的镜像版本'}
                {buildTagType === 'release' && '用于生产环境的镜像版本'}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">镜像标签</Label>
              <Input
                value={customBuildTag}
                onChange={(e) => setCustomBuildTag(e.target.value)}
                placeholder="例如：dev-20241112120000"
              />
              <p className="text-xs text-gray-500">系统已自动生成标签，可根据需要修改</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setBuildDialogOpen(false)}
              disabled={buildingImage}
            >
              取消
            </Button>
            <Button
              onClick={handleBuildImage}
              disabled={buildingImage || !customBuildTag.trim()}
              className="gap-2"
            >
              <Box className={`w-4 h-4 ${buildingImage ? 'animate-spin' : ''}`} />
              {buildingImage ? '构建中...' : '开始构建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 部署对话框 */}
      <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>选择镜像版本</DialogTitle>
            <DialogDescription>
              请选择要部署的镜像版本，按构建时间倒序排列。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {deployImageLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">加载中...</span>
              </div>
            ) : deployImageList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center">
                <p className="text-sm text-gray-500">暂无构建成功的镜像，请先触发构建。</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {deployImageList.map((image) => {
                  const isSelected = selectedDeployImageId === image.id
                  const matchesActiveById = activeServiceImageId && image.id === activeServiceImageId
                  const matchesActiveByFullImage =
                    activeServiceImageFullImage && image.full_image === activeServiceImageFullImage
                  const isActive = Boolean(matchesActiveById || matchesActiveByFullImage)
                  const isUpdating = Boolean(
                    ongoingDeploymentInfo &&
                      ((ongoingDeploymentInfo.id && image.id === ongoingDeploymentInfo.id) ||
                        (ongoingDeploymentFullImage && image.full_image === ongoingDeploymentFullImage))
                  )
                  const metadata =
                    image.metadata && typeof image.metadata === 'object'
                      ? (image.metadata as Record<string, unknown>)
                      : null
                  const metadataBranch = metadata && typeof metadata['branch'] === 'string' ? (metadata['branch'] as string) : null

                  return (
                    <div
                      key={image.id}
                      onClick={() => setSelectedDeployImageId(image.id ?? null)}
                      className={cn(
                        'rounded-lg border p-4 cursor-pointer transition-all',
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatImageReference(image.image, image.tag)}
                            </span>
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                <Check className="h-3 w-3" />
                                当前部署
                              </span>
                            ) : null}
                            {isUpdating && !isActive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                部署中
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            {image.build_number ? <span>构建号 #{image.build_number}</span> : null}
                            <span>创建于 {formatDateTime(image.created_at)}</span>
                            {metadataBranch ? <span>分支 {metadataBranch}</span> : null}
                          </div>
                        </div>
                        {isSelected ? (
                          <div className="flex-shrink-0">
                            <div className="rounded-full bg-indigo-500 p-1">
                              <Check className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 分页 */}
            {deployImageTotal > DEPLOY_IMAGE_PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                <div className="text-xs text-gray-500">
                  第 {deployImagePage} / {Math.ceil(deployImageTotal / DEPLOY_IMAGE_PAGE_SIZE)} 页 · 共 {deployImageTotal} 条
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadDeployImages(deployImagePage - 1)}
                    disabled={deployImagePage <= 1 || deployImageLoading}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadDeployImages(deployImagePage + 1)}
                    disabled={deployImagePage >= Math.ceil(deployImageTotal / DEPLOY_IMAGE_PAGE_SIZE) || deployImageLoading}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeployDialogOpen(false)}
              disabled={deploying}
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmDeploy}
              disabled={deploying || !selectedDeployImageId || deployImageLoading}
              className="gap-2"
            >
              <Rocket className={`w-4 h-4 ${deploying ? 'animate-spin' : ''}`} />
              {deploying ? '部署中...' : '开始部署'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
