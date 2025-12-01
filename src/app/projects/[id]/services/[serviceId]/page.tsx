'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Play, Square, Trash2, RefreshCw, Settings, Terminal, FileText, Activity, Rocket, HardDrive, Save, Plus, X, Globe, FileCode, Check, Box, Loader2, ExternalLink, PencilLine, Folder, TrendingUp } from 'lucide-react'
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
import { ServiceFileManager } from '@/components/services/ServiceFileManager'
import { ResourceUsageChart } from '@/components/services/ResourceUsageChart'
import { LazyOverviewTab, LazyConfigurationTab, LazyDeploymentsTab, LazyEnvironmentTab, LazyNetworkTab } from '@/components/services/LazyTabComponents'
import { useMetricsHistory } from '@/hooks/useMetricsHistory'
import { serviceSvc } from '@/service/serviceSvc'
import { systemConfigSvc } from '@/service/systemConfigSvc'
import { projectSvc } from '@/service/projectSvc'
import { DEFAULT_DOMAIN_ROOT, sanitizeDomainLabel } from '@/lib/network'
import { findVolumeTemplate, generateNFSSubpath } from '@/lib/volume-templates'
import { cn } from '@/lib/utils'
import { parseImageReference, formatImageReference, isImageReferenceEqual } from '@/lib/service-image'
import { extractGitLabProjectPath } from '@/lib/gitlab'
import { ServiceType, GitProvider, DatabaseType, DATABASE_TYPE_METADATA } from '@/types/project'
import type { Service, Deployment, Project, NetworkConfig, NetworkConfigV2, NetworkPortConfig, LegacyNetworkConfig, ServiceImageRecord, ServiceImageStatus, DatabaseService, SupportedDatabaseType } from '@/types/project'
import type { K8sServiceStatus } from '@/types/k8s'
import type { GitProviderConfig } from '@/types/system'

// Import shared constants and types
import { 
  STATUS_COLORS, 
  STATUS_LABELS, 
  SERVICE_STATUSES, 
  normalizeServiceStatus as normalizeServiceStatusUtil,
  DEPLOYMENT_STATUS_META,
  IMAGE_STATUS_META,
  LOGS_LINE_COUNT,
  IMAGE_HISTORY_PAGE_SIZE,
  SUCCESS_IMAGE_OPTIONS_LIMIT,
  type ServiceStatus
} from '@/lib/service-constants'
import { TAB_VALUES, LEGACY_TAB_VALUES, type TabValue } from '@/types/service-tabs'
import { normalizeTabValue, getDefaultTab, getTabFromURL, updateURLWithTab } from '@/lib/service-tab-utils'
import { getVisibleTabs } from '@/lib/service-tab-config'
import { parseResourceValue, combineResourceValue } from '@/lib/resource-utils'
import { formatDateTime, formatDuration } from '@/lib/date-utils'
import { generatePortId, createEmptyPort, normalizePositivePortNumber, sanitizeDomainLabelInput } from '@/lib/network-port-utils'

// Import shared types
import type { NetworkPortFormState, ServiceNetworkType, DeploymentImageInfo, PodEvent } from '@/types/service-tabs'

type GitBranchOption = {
  value: string
  label: string
  isDefault: boolean
  description?: string | null
}

type DeleteMode = 'deployment-only' | 'full'

// Use the imported normalizeServiceStatus function
const normalizeServiceStatus = normalizeServiceStatusUtil

const isNetworkConfigV2 = (config: NetworkConfig): config is NetworkConfigV2 =>
  Boolean(config) && Array.isArray((config as NetworkConfigV2).ports)

const extractExternalNodePort = (config?: NetworkConfig | null): number | null => {
  if (!config) {
    return null
  }

  if (isNetworkConfigV2(config)) {
    for (const port of config.ports) {
      const nodePort = normalizePositivePortNumber(port?.node_port)
      if (nodePort !== null) {
        return nodePort
      }
    }
    return null
  }

  const legacyConfig = config as LegacyNetworkConfig
  return normalizePositivePortNumber(legacyConfig.node_port)
}

// Resource and date formatting functions are now imported from shared utilities

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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const serviceId = params.serviceId as string

  const [service, setService] = useState<Service | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Initialize activeTab from URL parameter, with fallback to default
  const [activeTab, setActiveTab] = useState<TabValue>(() => {
    return getTabFromURL(searchParams)
  })
  
  // Wrapper to handle tab changes with normalization and URL update
  const handleTabChange = useCallback((value: string) => {
    const normalizedTab = normalizeTabValue(value)
    setActiveTab(normalizedTab)
    updateURLWithTab(normalizedTab, router, pathname)
    
    // Lazy loading: Enable metrics when overview tab is activated for the first time
    if (normalizedTab === 'overview' && !activatedTabsRef.current.has('overview')) {
      activatedTabsRef.current.add('overview')
      setMetricsEnabled(true)
    }
    
    // Mark tab as activated for lazy loading
    if (!activatedTabsRef.current.has(normalizedTab)) {
      activatedTabsRef.current.add(normalizedTab)
    }
  }, [router, pathname])
  const [isEditing, setIsEditing] = useState(false)
  const [editedService, setEditedService] = useState<any>({})
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([])
  const [volumes, setVolumes] = useState<Array<{ nfs_subpath?: string; container_path: string; read_only: boolean }>>([])
  // 资源限制状态
  const [cpuValue, setCpuValue] = useState('')
  const [cpuUnit, setCpuUnit] = useState<'m' | 'core'>('core')
  const [memoryValue, setMemoryValue] = useState('')
  const [memoryUnit, setMemoryUnit] = useState<'Mi' | 'Gi'>('Gi')
  // 资源请求状态
  const [cpuRequestValue, setCpuRequestValue] = useState('')
  const [cpuRequestUnit, setCpuRequestUnit] = useState<'m' | 'core'>('core')
  const [memoryRequestValue, setMemoryRequestValue] = useState('')
  const [memoryRequestUnit, setMemoryRequestUnit] = useState<'Mi' | 'Gi'>('Gi')
  const [networkServiceType, setNetworkServiceType] = useState<ServiceNetworkType>('ClusterIP')
  const [networkPorts, setNetworkPorts] = useState<NetworkPortFormState[]>([createEmptyPort()])
  const [headlessServiceEnabled, setHeadlessServiceEnabled] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [deploymentsLoading, setDeploymentsLoading] = useState(false)
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteActionLoading, setDeleteActionLoading] = useState<DeleteMode | null>(null)
  const [externalAccessUpdating, setExternalAccessUpdating] = useState(false)
  const [selectedDeployImageId, setSelectedDeployImageId] = useState<string | null>(null)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
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
  const [podEvents, setPodEvents] = useState<PodEvent[]>([])
  const [podEventsLoading, setPodEventsLoading] = useState(false)
  const [podEventsError, setPodEventsError] = useState<string | null>(null)
  // Initialize metricsEnabled based on initial tab
  const [metricsEnabled, setMetricsEnabled] = useState(() => {
    const initialTab = getTabFromURL(searchParams)
    return initialTab === 'overview'
  })
  const [metricsTimeRange, setMetricsTimeRange] = useState('1h')

  // 使用 Prometheus 历史数据 hook
  const { dataPoints: metricsHistory, isLoading: metricsLoading, error: metricsError, refresh: refreshMetrics } = useMetricsHistory({
    serviceId: serviceId || '',
    timeRange: metricsTimeRange, // 查询时间范围
    refreshInterval: 60000, // 每60秒刷新一次
    enabled: metricsEnabled && Boolean(serviceId), // 通过状态控制是否启用
    mode: 'prometheus' // 使用 Prometheus 模式
  })

  // 稳定的回调函数，用于 OverviewTab
  const handleRefreshMetrics = useCallback((timeRange?: string) => {
    const rangeToUse = timeRange || metricsTimeRange
    console.log('[ServiceDetail] handleRefreshMetrics 调用，timeRange:', rangeToUse)
    refreshMetrics(rangeToUse)
  }, [refreshMetrics, metricsTimeRange])

  const handleChangeTimeRange = useCallback((range: string) => {
    console.log('[ServiceDetail] handleChangeTimeRange 调用，range:', range, '当前 metricsTimeRange:', metricsTimeRange)
    setMetricsTimeRange(range)
    // 不需要手动调用 refreshMetrics，hook 的 useEffect 会自动处理
  }, [metricsTimeRange])

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
  // Track which tabs have been activated for lazy loading
  const activatedTabsRef = useRef<Set<TabValue>>(new Set())
  const serviceType = service?.type
  const isApplicationService = serviceType === ServiceType.APPLICATION

  // Enable metrics if the initial tab is overview
  useEffect(() => {
    if (activeTab === 'overview' && !activatedTabsRef.current.has('overview')) {
      activatedTabsRef.current.add('overview')
      setMetricsEnabled(true)
    }
  }, [activeTab])

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
  const resolvedExternalPort = useMemo(() => {
    if (!databaseService) {
      return null
    }
    const directPort = normalizePositivePortNumber(databaseService.external_port)
    if (directPort !== null) {
      return directPort
    }
    return extractExternalNodePort(databaseService.network_config as NetworkConfig | null)
  }, [databaseService])
  const externalAccessEnabled = useMemo(() => {
    if (!databaseService) {
      return false
    }
    const normalized = databaseNetworkServiceType.trim().toLowerCase()
    if (normalized === 'nodeport') {
      return true
    }
    return resolvedExternalPort !== null
  }, [databaseNetworkServiceType, resolvedExternalPort, databaseService?.id])
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

  const sanitizeDomainLabelInput = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 63)

  const initializeNetworkState = useCallback((svc: Service) => {
    const config = svc.network_config as NetworkConfig | undefined

    const resolveHeadlessEnabled = (candidate?: NetworkConfig): boolean => {
      if (!candidate) {
        return false
      }

      const record = candidate as Record<string, unknown>
      const flagKeys: unknown[] = [
        record['headless_service_enabled'],
        record['headlessServiceEnabled'],
        record['enable_headless_service'],
        record['enableHeadlessService']
      ]

      for (const value of flagKeys) {
        if (typeof value === 'boolean') {
          if (value) return true
        } else if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase()
          if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
            return true
          }
        }
      }

      const nested = record['headless_service']
      if (
        nested &&
        typeof nested === 'object' &&
        typeof (nested as { enabled?: unknown }).enabled === 'boolean'
      ) {
        return Boolean((nested as { enabled?: boolean }).enabled)
      }

      if (isNetworkConfigV2(candidate)) {
        const rawType = (candidate.service_type ?? '').toLowerCase()
        return rawType === 'headless'
      }

      const legacyType = (record['service_type'] as string | undefined)?.toLowerCase()
      return legacyType === 'headless'
    }

    const headlessEnabled = resolveHeadlessEnabled(config)
    setHeadlessServiceEnabled(headlessEnabled)

    if (config && isNetworkConfigV2(config) && config.ports.length > 0) {
      const rawType = config.service_type ?? 'ClusterIP'
      const normalizedType = rawType === 'Headless' ? 'ClusterIP' : rawType
      setNetworkServiceType((normalizedType ?? 'ClusterIP') as ServiceNetworkType)
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
      const rawType = legacy.service_type ?? 'ClusterIP'
      const normalizedType = rawType === 'Headless' ? 'ClusterIP' : rawType
      setNetworkServiceType((normalizedType ?? 'ClusterIP') as ServiceNetworkType)
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

      // 初始化资源请求
      const cpuRequest = data.resource_requests?.cpu
      const memoryRequest = data.resource_requests?.memory
      const parsedCpuRequest = parseResourceValue(cpuRequest, 'cpu')
      const parsedMemoryRequest = parseResourceValue(memoryRequest, 'memory')
      setCpuRequestValue(parsedCpuRequest.value)
      setCpuRequestUnit(parsedCpuRequest.unit as 'm' | 'core')
      setMemoryRequestValue(parsedMemoryRequest.value)
      setMemoryRequestUnit(parsedMemoryRequest.unit as 'Mi' | 'Gi')

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
      console.log('[loadDeployments] Loaded deployments:', data?.length || 0, 'items')
      setDeployments(data)
    } catch (error: any) {
      const message = error?.message || '加载部署历史失败'
      console.error('[loadDeployments] Error:', message)
      setDeploymentsError(message)
      if (showToast) {
        toast.error('加载部署历史失败：' + message)
      }
    } finally {
      setDeploymentsLoading(false)
    }
  }, [serviceId])

  const logsContainerRef = useRef<HTMLDivElement>(null)

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
      // 日志加载完成后自动滚动到底部
      setTimeout(() => {
        if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
        }
      }, 100)
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

  const loadPodEvents = useCallback(async (showToast = false) => {
    if (!serviceId) return

    try {
      setPodEventsLoading(true)
      setPodEventsError(null)
      const response = await fetch(`/api/services/${serviceId}/events`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '获取事件失败')
      }

      if (data.error) {
        setPodEvents([])
        setPodEventsError(data.error)
        if (showToast) {
          toast.error('加载事件失败：' + data.error)
        }
      } else {
        setPodEvents(data.events || [])
        setPodEventsError(null)
      }
    } catch (error: any) {
      const message = error?.message || '加载事件失败'
      setPodEvents([])
      setPodEventsError(message)
      if (showToast) {
        toast.error('加载事件失败：' + message)
      }
    } finally {
      setPodEventsLoading(false)
    }
  }, [serviceId])

  // Sync activeTab with URL parameter changes (e.g., browser back/forward)
  useEffect(() => {
    const tabFromURL = getTabFromURL(searchParams)
    if (tabFromURL !== activeTab) {
      setActiveTab(tabFromURL)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    setK8sStatusInfo(null)
    setK8sStatusError(null)
    void loadService()
    void fetchK8sStatus()
    void loadPodEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId])

  // 根据服务状态控制 metrics 采集
  useEffect(() => {
    if (!k8sStatusInfo) {
      return // Don't disable metrics if k8sStatus is not loaded yet
    }

    // 只在服务运行时且 overview tab 已激活时启用 metrics 采集
    const status = k8sStatusInfo.status?.toLowerCase()
    const isOverviewActivated = activatedTabsRef.current.has('overview')
    
    // Only enable metrics if both conditions are met
    // But don't disable if overview is activated (let it stay enabled)
    if (status === 'running' && isOverviewActivated) {
      setMetricsEnabled(true)
    } else if (status !== 'running') {
      // Disable metrics if service is not running
      setMetricsEnabled(false)
    }
  }, [k8sStatusInfo])

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
    // Reset state when service changes
    setDeployments([])
    setDeploymentsError(null)
    setHasLoadedLogs(false)
    setLogs('')
    setLogsError(null)
    setYamlContent('')
    setYamlError(null)
    // Reset activated tabs to enable lazy loading for new service
    activatedTabsRef.current.clear()
    // Don't load deployments here - let lazy loading handle it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId])

  // Lazy loading for tabs - load data only on first activation
  useEffect(() => {
    // Don't load data if service is not loaded yet
    if (!service) {
      return
    }
    
    const isFirstActivation = !activatedTabsRef.current.has(activeTab)
    
    // Special handling for logs tab - always load on activation
    if (activeTab === 'logs') {
      void loadLogs(false) // Load logs every time the tab is activated
      if (isFirstActivation) {
        activatedTabsRef.current.add(activeTab)
      }
      return
    }
    
    // Special handling for deployments tab - always load on activation
    if (activeTab === 'deployments') {
      console.log('[Lazy Loading] Activating deployments tab, loading data...')
      void loadDeployments(false) // Load deployments every time the tab is activated
      if (service?.type === ServiceType.APPLICATION) {
        console.log('[Lazy Loading] Service is Application type, loading images...')
        void loadServiceImages({ page: 1 })
      }
      if (isFirstActivation) {
        activatedTabsRef.current.add(activeTab)
      }
      return
    }
    
    if (isFirstActivation) {
      activatedTabsRef.current.add(activeTab)
      
      // Load data based on which tab is being activated for the first time
      switch (activeTab) {
        case 'overview':
          // Enable metrics collection for overview tab
          // k8sStatus and podEvents are already loaded on mount
          if (k8sStatusInfo?.status?.toLowerCase() === 'running') {
            setMetricsEnabled(true)
          }
          // Load deployments for deployment info card
          console.log('[Lazy Loading] Loading deployments for overview tab...')
          void loadDeployments(false)
          break
          
        case 'configuration':
          // Configuration uses existing service data, no additional loading needed
          break
          
        case 'files':
          // Files tab uses ServiceFileManager which handles its own loading
          break
          
        case 'yaml':
          void loadYAML()
          break
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, service])

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
  const handleDelete = async (mode: DeleteMode) => {
    if (!serviceId) return

    setDeleteActionLoading(mode)

    try {
      const result = await serviceSvc.deleteService(
        serviceId,
        mode === 'deployment-only' ? { mode } : undefined
      )
      const fallbackMessage =
        mode === 'deployment-only' ? '部署删除成功，服务配置已保留。' : '服务删除成功'

      toast.success(result.message || fallbackMessage)
      if (result.warning) {
        toast.warning(result.warning)
      }

      if (mode === 'deployment-only') {
        await loadService()
        await fetchK8sStatus({ showToast: true })
        await loadDeployments()
        setDeleteDialogOpen(false)
      } else {
        setDeleteDialogOpen(false)
        router.push(`/projects/${projectId}`)
      }
    } catch (error: any) {
      const message = error?.message || '未知错误'
      toast.error('删除失败：' + message)
    } finally {
      setDeleteActionLoading((current) => (current === mode ? null : current))
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
    const shortYear = String(now.getFullYear() % 100).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const timestamp = `${shortYear}${month}${day}-${hours}${minutes}${seconds}`

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
    if (!isApplicationService) {
      return
    }
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

  useEffect(() => {
    if (!isApplicationService && buildDialogOpen) {
      setBuildDialogOpen(false)
    }
  }, [isApplicationService, buildDialogOpen])

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

      // 组合资源请求
      const cpuRequest = combineResourceValue(cpuRequestValue, cpuRequestUnit)
      const memoryRequest = combineResourceValue(memoryRequestValue, memoryRequestUnit)
      if (cpuRequest || memoryRequest) {
        updateData.resource_requests = {
          ...(cpuRequest ? { cpu: cpuRequest } : {}),
          ...(memoryRequest ? { memory: memoryRequest } : {})
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

      if (headlessServiceEnabled && portsPayload.length === 0) {
        toast.error('启用 Headless Service 前请至少配置一个端口。')
        return
      }

      if (portsPayload.length > 0) {
        updateData.network_config = {
          service_type: networkServiceType,
          ports: portsPayload,
          headless_service_enabled: headlessServiceEnabled
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

  const handleNetworkServiceTypeChange = (value: ServiceNetworkType) => {
    setNetworkServiceType(value)
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
    updatePortField(id, 'domainPrefix', sanitizeDomainLabelInput(value))
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

  const handleOpenRenameDialog = () => {
    if (!service) {
      return
    }
    setRenameValue(service.name ?? '')
    setRenameDialogOpen(true)
  }

  const handleConfirmRename = async () => {
    if (!serviceId || !service) {
      return
    }

    const nextName = renameValue.trim()
    if (!nextName) {
      toast.error('服务名称不能为空')
      return
    }

    const currentName = (service.name || '').trim()
    if (nextName === currentName) {
      toast.info('名称未发生变化')
      setRenameDialogOpen(false)
      return
    }

    try {
      setRenameLoading(true)
      await serviceSvc.updateService(serviceId, { name: nextName })
      toast.success('服务名称已更新')
      setRenameDialogOpen(false)
      await loadService()
    } catch (error: any) {
      toast.error('重命名失败：' + (error?.message || '未知错误'))
    } finally {
      setRenameLoading(false)
    }
  }

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
  const hasSuccessfulDeployment = deployments.some((deployment) => deployment.status === 'success')
  const renameDisabledReason = (() => {
    if (normalizedDbStatus !== 'pending') {
      return '仅未部署的服务可以重命名。'
    }
    if (hasSuccessfulDeployment) {
      return '服务已有成功部署记录，无法重命名。'
    }
    return ''
  })()
  const canRenameService = renameDisabledReason === ''
  const renameInputTrimmed = renameValue.trim()
  const renameConfirmDisabled = renameLoading || !renameInputTrimmed || renameInputTrimmed === (service.name ?? '')

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

              <div className="flex flex-wrap items-start gap-3">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">{service.name}</h1>
                  {canRenameService && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-sm text-gray-600"
                      onClick={handleOpenRenameDialog}
                    >
                      <PencilLine className="h-4 w-4" />
                      重命名
                    </Button>
                  )}
                </div>
                <Badge variant="outline">
                  {service.type === ServiceType.APPLICATION && 'Application'}
                  {service.type === ServiceType.DATABASE && 'Database'}
                  {service.type === ServiceType.IMAGE && 'Image'}
                </Badge>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                  <span className="text-sm text-gray-700">{statusLabel}</span>
                  {k8sStatusLoading && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              {isApplicationService && (
                <Button
                  onClick={handleOpenBuildDialog}
                  disabled={buildingImage}
                  variant="outline"
                  className="gap-2"
                >
                  <Box className={`w-4 h-4 ${buildingImage ? 'animate-spin' : ''}`} />
                  {buildingImage ? '构建中...' : '构建'}
                </Button>
              )}
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
              {normalizedStatus === 'running' && (
                <Button
                  onClick={() => window.open(`/projects/${projectId}/services/${serviceId}/terminal`, '_blank')}
                  variant="outline"
                  className="gap-2"
                >
                  <Terminal className="w-4 h-4" />
                  命令行
                </Button>
              )}
              <Button
                onClick={() => setDeleteDialogOpen(true)}
                variant="destructive"
                className="gap-2"
                disabled={Boolean(deleteActionLoading)}
              >
                <Trash2 className="w-4 h-4" />
                删除
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-white" aria-label="服务详情导航标签">
            {/* Dynamic tabs based on service type - all service types show 6 common tabs */}
            {getVisibleTabs(service).map((tabConfig) => {
              const IconComponent = tabConfig.icon
              return (
                <TabsTrigger 
                  key={tabConfig.value} 
                  value={tabConfig.value} 
                  className="gap-2"
                  aria-label={`${tabConfig.label}标签页`}
                >
                  <IconComponent className="w-4 h-4" aria-hidden="true" />
                  {tabConfig.label}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {/* 概览 - Overview Tab */}
          <TabsContent value="overview" className="space-y-6" role="tabpanel" aria-label="服务概览">
            <LazyOverviewTab
              service={service}
              k8sStatus={k8sStatusInfo}
              k8sStatusLoading={k8sStatusLoading}
              k8sStatusError={k8sStatusError}
              metricsHistory={metricsHistory}
              metricsLoading={metricsLoading}
              metricsError={metricsError}
              metricsTimeRange={metricsTimeRange}
              podEvents={podEvents}
              podEventsLoading={podEventsLoading}
              podEventsError={podEventsError}
              currentDeployment={currentDeploymentInfo}
              ongoingDeployment={ongoingDeploymentInfo}
              onRefreshStatus={async () => { await fetchK8sStatus({ showToast: true }) }}
              onRefreshMetrics={handleRefreshMetrics}
              onRefreshEvents={() => loadPodEvents(true)}
              onChangeTimeRange={handleChangeTimeRange}
            />
          </TabsContent>

          {/* 通用配置 */}

          {/* 配置 - New Configuration Tab */}
          <TabsContent value="configuration" className="space-y-6">
            <LazyConfigurationTab
              service={service}
              project={project}
              isEditing={isEditing}
              editedService={editedService}
              envVars={envVars}
              volumes={volumes}
              networkServiceType={networkServiceType}
              networkPorts={networkPorts}
              headlessServiceEnabled={headlessServiceEnabled}
              cpuValue={cpuValue}
              cpuUnit={cpuUnit}
              memoryValue={memoryValue}
              memoryUnit={memoryUnit}
              cpuRequestValue={cpuRequestValue}
              cpuRequestUnit={cpuRequestUnit}
              memoryRequestValue={memoryRequestValue}
              memoryRequestUnit={memoryRequestUnit}
              hasPendingNetworkDeploy={hasPendingNetworkDeploy}
              onStartEdit={() => setIsEditing(true)}
              onSave={handleSave}
              onCancel={() => {
                setIsEditing(false)
                setEditedService(service)
              }}
              onUpdateService={(updates) => setEditedService({ ...editedService, ...updates })}
              onUpdateEnvVars={setEnvVars}
              onUpdateVolumes={setVolumes}
              onUpdateNetwork={(config) => {
                setNetworkServiceType(config.serviceType)
                setNetworkPorts(config.ports.map(p => ({
                  id: generatePortId(),
                  containerPort: String(p.containerPort),
                  servicePort: String(p.servicePort ?? p.containerPort),
                  protocol: p.protocol ?? 'TCP',
                  nodePort: p.nodePort ? String(p.nodePort) : '',
                  enableDomain: p.domain?.enabled ?? false,
                  domainPrefix: p.domain?.prefix ?? ''
                })))
                setHeadlessServiceEnabled(config.headlessServiceEnabled)
              }}
              onUpdateResources={(limits, requests) => {
                if (limits.cpu || limits.memory) {
                  const parsed = parseResourceValue(limits.cpu, 'cpu')
                  setCpuValue(parsed.value)
                  setCpuUnit(parsed.unit as 'm' | 'core')
                  const parsedMem = parseResourceValue(limits.memory, 'memory')
                  setMemoryValue(parsedMem.value)
                  setMemoryUnit(parsedMem.unit as 'Mi' | 'Gi')
                }
                if (requests.cpu || requests.memory) {
                  const parsed = parseResourceValue(requests.cpu, 'cpu')
                  setCpuRequestValue(parsed.value)
                  setCpuRequestUnit(parsed.unit as 'm' | 'core')
                  const parsedMem = parseResourceValue(requests.memory, 'memory')
                  setMemoryRequestValue(parsedMem.value)
                  setMemoryRequestUnit(parsedMem.unit as 'Mi' | 'Gi')
                }
              }}
            />
          </TabsContent>

          {/* 环境变量 */}
          <TabsContent value="environment" className="space-y-6">
            <LazyEnvironmentTab
              isEditing={isEditing}
              envVars={envVars}
              onStartEdit={() => setIsEditing(true)}
              onSave={handleSave}
              onCancel={() => {
                setIsEditing(false)
                setEditedService(service)
              }}
              onUpdateEnvVars={setEnvVars}
            />
          </TabsContent>

          {/* 网络配置 */}
          <TabsContent value="network" className="space-y-6">
            <LazyNetworkTab
              isEditing={isEditing}
              networkServiceType={networkServiceType}
              networkPorts={networkPorts}
              headlessServiceEnabled={headlessServiceEnabled}
              project={project}
              hasPendingNetworkDeploy={hasPendingNetworkDeploy}
              onStartEdit={() => setIsEditing(true)}
              onSave={handleSave}
              onCancel={() => {
                setIsEditing(false)
                setEditedService(service)
              }}
              onUpdateNetwork={(config) => {
                setNetworkServiceType(config.serviceType)
                setNetworkPorts(config.ports.map(p => ({
                  id: generatePortId(),
                  containerPort: String(p.containerPort),
                  servicePort: String(p.servicePort ?? p.containerPort),
                  protocol: p.protocol ?? 'TCP',
                  nodePort: p.nodePort ? String(p.nodePort) : '',
                  enableDomain: p.domain?.enabled ?? false,
                  domainPrefix: p.domain?.prefix ?? ''
                })))
                setHeadlessServiceEnabled(config.headlessServiceEnabled)
              }}
            />
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
                      <pre className="whitespace-pre" style={{
                        color: '#e5e7eb',
                        lineHeight: '1.6'
                      }}>{yamlContent}</pre>
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
            <LazyDeploymentsTab
              service={service}
              deployments={deployments}
              deploymentsLoading={deploymentsLoading}
              deploymentsError={deploymentsError}
              serviceImages={serviceImages}
              imagesLoading={imagesLoading}
              imagesError={imagesError}
              imagePagination={imagePagination}
              currentDeployment={currentDeploymentInfo}
              ongoingDeployment={ongoingDeploymentInfo}
              onRefreshDeployments={() => loadDeployments(true)}
              onRefreshImages={() => loadServiceImages({ showToast: true })}
              onDeploy={async (imageId) => {
                if (imageId) {
                  await handleDeployImage(imageId)
                } else {
                  await handleDeploy()
                }
              }}
              onBuild={async (branch, tag) => {
                setBuildBranch(branch)
                setCustomBuildTag(tag)
                await handleBuildImage()
              }}
              onActivateImage={async (imageId) => {
                setSelectedServiceImageId(imageId)
                await handleActivateImage()
              }}
              onPageChange={(page) => loadServiceImages({ page })}
            />
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
                <div ref={logsContainerRef} className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm min-h-[400px] max-h-[500px] overflow-y-auto">
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

          {/* 文件管理 */}
          <TabsContent value="files">
            <ServiceFileManager serviceId={serviceId} active={activeTab === 'files'} />
          </TabsContent>
        </Tabs>
      </div>

      {/* 重命名服务 */}
      <Dialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          if (renameLoading) return
          setRenameDialogOpen(open)
          if (open) {
            setRenameValue(service.name ?? '')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名服务</DialogTitle>
            <DialogDescription>仅支持尚未部署的服务，重命名前请确认新名称符合命名规范。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-input">新的服务名称</Label>
              <Input
                id="rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="输入新的服务名称"
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-500">重命名后需重新使用此名称进行部署和后续管理。</p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              disabled={renameLoading}
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmRename}
              disabled={renameConfirmDisabled}
              className="gap-2"
            >
              {renameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {renameLoading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 构建对话框 */}
      {isApplicationService && (
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
      )}

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

      {/* 删除服务对话框 */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (deleteActionLoading) return
          setDeleteDialogOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>删除服务</DialogTitle>
            <DialogDescription>请选择删除方式，操作不可逆，请谨慎执行。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-gray-200 p-2 text-gray-700">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900">删除部署，保留配置</p>
                  <p className="text-sm text-gray-500">
                    仅删除 Kubernetes 集群中的部署与服务资源，保留数据库中的服务配置，稍后可以重新部署。
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full justify-center gap-2"
                onClick={() => void handleDelete('deployment-only')}
                disabled={Boolean(deleteActionLoading)}
              >
                {deleteActionLoading === 'deployment-only' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在删除部署...
                  </>
                ) : (
                  <>
                    <HardDrive className="h-4 w-4" />
                    删除部署
                  </>
                )}
              </Button>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50/80 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-red-100 p-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-700">完全删除</p>
                  <p className="text-sm text-red-600">
                    删除 Kubernetes 资源并移除数据库中的服务配置，操作完成后无法恢复。
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                className="w-full justify-center gap-2"
                onClick={() => void handleDelete('full')}
                disabled={Boolean(deleteActionLoading)}
              >
                {deleteActionLoading === 'full' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在完全删除...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    完全删除
                  </>
                )}
              </Button>
            </div>
          </div>
          <DialogFooter className="justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={Boolean(deleteActionLoading)}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
