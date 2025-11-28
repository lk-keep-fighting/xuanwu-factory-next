'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { toast } from 'sonner'
import { ImageReferencePicker, type ImageReferenceValue } from '@/components/services/ImageReferencePicker'
import { serviceSvc } from '@/service/serviceSvc'
import { systemConfigSvc } from '@/service/systemConfigSvc'
import {
  ServiceType,
  DatabaseType,
  GitProvider,
  BuildType,
  Service,
  SUPPORTED_DATABASE_TYPES,
  DATABASE_TYPE_METADATA,
  type SupportedDatabaseType,
  type NetworkConfigV2
} from '@/types/project'
import type { GitProviderConfig, GitRepositoryInfo } from '@/types/system'
import { Database as DatabaseIcon, Plus, Trash2, Loader2, RefreshCcw } from 'lucide-react'
import { extractGitLabProjectPath } from '@/lib/gitlab'
import { DEFAULT_DOMAIN_ROOT, sanitizeDomainLabel } from '@/lib/network'

const extractImageBaseName = (image?: string) => {
  if (!image) return ''
  const segments = image.split('/')
  const lastSegment = segments[segments.length - 1] || image
  const [name] = lastSegment.split(':')
  return name || lastSegment
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

type ServiceNetworkType = Exclude<NonNullable<NetworkConfigV2['service_type']>, 'Headless'>

interface ServiceFormValues {
  name: string
  git_repository?: string
  git_branch?: string
  git_path?: string
  build_type?: string
  dockerfile_path?: string
  port?: string
  replicas?: string
  command?: string
  auto_deploy?: string
  version?: string
  username?: string
  password?: string
  root_password?: string
  database_name?: string
  volume_size?: string
  image?: string
  tag?: string
  cpu?: string
  memory?: string
  [key: string]: unknown
}

type ServicePayload = {
  project_id: string
  name: string
  type: ServiceType
  status: Service['status']
} & Record<string, unknown>

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

type GitRepositoryOption = {
  value: string
  label: string
  repo: GitRepositoryInfo
}

type GitBranchOption = {
  value: string
  label: string
  isDefault: boolean
  description?: string | null
}

const DATABASE_OPTIONS = SUPPORTED_DATABASE_TYPES.map(value => ({
  value,
  label: DATABASE_TYPE_METADATA[value].label
}))

interface ServiceCreateFormProps {
  projectId: string
  projectIdentifier?: string
  serviceType: ServiceType
  onSuccess: () => void
  onCancel: () => void
}

export default function ServiceCreateForm({
  projectId,
  projectIdentifier,
  serviceType,
  onSuccess,
  onCancel
}: ServiceCreateFormProps) {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, setValue, watch, unregister } = useForm<ServiceFormValues>({
    defaultValues: {
      git_branch: 'main',
      git_path: '.'
    }
  })
  const [selectedDatabaseType, setSelectedDatabaseType] = useState<SupportedDatabaseType>(DatabaseType.MYSQL)
  
  // 环境变量管理
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([{ key: '', value: '' }])
  
  // 网络配置（镜像服务）
  const [networkServiceType] = useState<ServiceNetworkType>('ClusterIP')
  const [networkPorts] = useState<NetworkPortFormState[]>([createEmptyPort()])
  const [imageReference, setImageReference] = useState<ImageReferenceValue>({ optionId: null, image: '', tag: 'latest' })

  const [gitProviderConfig, setGitProviderConfig] = useState<GitProviderConfig | null>(null)
  const [gitConfigLoaded, setGitConfigLoaded] = useState(false)
  const [repositoryOptions, setRepositoryOptions] = useState<GitRepositoryOption[]>([])
  const [repositorySearch, setRepositorySearch] = useState('')
  const [repositoryLoading, setRepositoryLoading] = useState(false)
  const [repositoryError, setRepositoryError] = useState<string | null>(null)
  const [repositoryPickerOpen, setRepositoryPickerOpen] = useState(false)
  const [selectedRepository, setSelectedRepository] = useState<GitRepositoryInfo | null>(null)
  const [branchOptions, setBranchOptions] = useState<GitBranchOption[]>([])
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchError, setBranchError] = useState<string | null>(null)
  const [branchPickerOpen, setBranchPickerOpen] = useState(false)
  const [branchSearch, setBranchSearch] = useState('')
  const branchInitialLoadRef = useRef(false)
  
  const imageValue = watch('image') as string | undefined
  const tagValue = watch('tag') as string | undefined
  const serviceNameValue = watch('name') as string | undefined
  const gitRepositoryValue = watch('git_repository') as string | undefined
  const gitBranchValue = watch('git_branch') as string | undefined
  const gitBranchRef = useRef(gitBranchValue)
  
  useEffect(() => {
    gitBranchRef.current = gitBranchValue
  }, [gitBranchValue])
  
  useEffect(() => {
    const loadGitProviderConfig = async () => {
      try {
        const config = await systemConfigSvc.getGitProviderConfig()

        if (config?.provider === GitProvider.GITLAB) {
          setGitProviderConfig(config)
        } else {
          setGitProviderConfig(null)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Git 提供商配置加载失败'
        toast.error(message)
      } finally {
        setGitConfigLoaded(true)
      }
    }

    void loadGitProviderConfig()
  }, [])
  
  useEffect(() => {
    if (serviceType !== ServiceType.IMAGE) {
      unregister('image')
      unregister('tag')
      return
    }

    register('image', { required: true })
    register('tag')

    return () => {
      unregister('image')
      unregister('tag')
    }
  }, [register, unregister, serviceType])
  
  const selectedRepositoryValue = selectedRepository?.httpUrlToRepo ?? ''

  const repositoryOptionMap = useMemo(() => {
    return new Map(repositoryOptions.map((option) => [option.value, option]))
  }, [repositoryOptions])

  const repositoryComboboxData = useMemo(() => {
    return repositoryOptions.map((option) => ({ value: option.value, label: option.label }))
  }, [repositoryOptions])

  const branchOptionMap = useMemo(() => {
    return new Map(branchOptions.map((option) => [option.value, option]))
  }, [branchOptions])

  const branchComboboxData = useMemo(() => {
    return branchOptions.map((option) => ({ value: option.value, label: option.label }))
  }, [branchOptions])

  const normalizedBranchValue = useMemo(() => (gitBranchValue ?? '').trim(), [gitBranchValue])
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

    return normalizedBranchValue ? '自定义分支' : '请选择分支'
  }, [normalizedBranchValue, selectedBranchOption])

  const manualRepositoryDisplay = useMemo(() => {
    const normalized = gitRepositoryValue?.trim()

    if (!normalized) {
      return null
    }

    if (selectedRepository && selectedRepository.httpUrlToRepo === normalized) {
      return null
    }

    return normalized
  }, [gitRepositoryValue, selectedRepository])

  const gitlabIntegrationReady = useMemo(() => {
    if (!gitProviderConfig) {
      return false
    }

    return gitProviderConfig.enabled && gitProviderConfig.hasToken
  }, [gitProviderConfig])

  const repositoryIdentifier = useMemo(() => {
    if (selectedRepository) {
      const path = selectedRepository.pathWithNamespace?.trim()
      if (path) {
        return path
      }

      if (typeof selectedRepository.id === 'number') {
        return String(selectedRepository.id)
      }

      if (selectedRepository.id) {
        return String(selectedRepository.id)
      }
    }

    const normalizedUrl = (gitRepositoryValue ?? '').trim()
    if (!normalizedUrl) {
      return null
    }

    const extracted = extractGitLabProjectPath(normalizedUrl, gitProviderConfig?.baseUrl ?? '')
    if (extracted) {
      return extracted
    }

    const fallback = normalizedUrl.replace(/\.git$/i, '')
    if (fallback.includes('://')) {
      return null
    }

    return fallback
  }, [gitProviderConfig?.baseUrl, gitRepositoryValue, selectedRepository])

  const canUseBranchSelector = useMemo(() => {
    return gitlabIntegrationReady && Boolean(repositoryIdentifier)
  }, [gitlabIntegrationReady, repositoryIdentifier])

  const fetchRepositories = useCallback(
    async (keyword?: string) => {
      if (!gitProviderConfig || !gitProviderConfig.enabled || !gitProviderConfig.hasToken) {
        setRepositoryOptions([])
        return
      }

      setRepositoryLoading(true)
      setRepositoryError(null)

      try {
        const result = await systemConfigSvc.searchGitRepositories({
          search: keyword?.trim() || undefined
        })

        const options = result.items.map<GitRepositoryOption>((repo) => ({
          value: repo.httpUrlToRepo,
          label: repo.fullName || repo.pathWithNamespace,
          repo
        }))

        if (selectedRepository) {
          const exists = options.some((option) => option.value === selectedRepository.httpUrlToRepo)
          if (!exists) {
            options.unshift({
              value: selectedRepository.httpUrlToRepo,
              label: selectedRepository.fullName || selectedRepository.pathWithNamespace,
              repo: selectedRepository
            })
          }
        }

        setRepositoryOptions(options)
      } catch (error) {
        const message = error instanceof Error ? error.message : '仓库搜索失败'
        setRepositoryError(message)
        setRepositoryOptions([])
      } finally {
        setRepositoryLoading(false)
      }
    },
    [gitProviderConfig, selectedRepository]
  )

  const fetchBranches = useCallback(
    async (
      keyword?: string,
      options: { useDefaultBranch?: boolean } = {}
    ) => {
      if (!gitlabIntegrationReady || !repositoryIdentifier) {
        setBranchOptions([])
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

        const currentBranch = (gitBranchRef.current ?? '').trim()
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
              setValue('git_branch', fallback.value, { shouldValidate: true, shouldDirty: false })
              gitBranchRef.current = fallback.value
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
    [gitBranchRef, gitlabIntegrationReady, repositoryIdentifier, setValue]
  )

  const handleRepositorySelect = useCallback(
    (value: string) => {
      const option = repositoryOptionMap.get(value)

      branchInitialLoadRef.current = false
      setBranchOptions([])
      setBranchError(null)
      setBranchSearch('')

      if (option) {
        setSelectedRepository(option.repo)
        setValue('git_repository', option.repo.httpUrlToRepo, { shouldValidate: true, shouldDirty: true })

        if (option.repo.defaultBranch) {
          setValue('git_branch', option.repo.defaultBranch, { shouldValidate: true, shouldDirty: false })
          gitBranchRef.current = option.repo.defaultBranch
        }
      } else {
        setSelectedRepository(null)
        setValue('git_repository', value, { shouldValidate: true, shouldDirty: true })
      }

      setRepositorySearch('')
    },
    [gitBranchRef, repositoryOptionMap, setValue]
  )
  
  useEffect(() => {
    if (!canUseBranchSelector) {
      branchInitialLoadRef.current = false
      setBranchPickerOpen(false)
      setBranchOptions([])
      setBranchError(null)
      setBranchSearch('')
      setBranchLoading(false)
      return
    }

    branchInitialLoadRef.current = false

    if (!repositoryIdentifier) {
      setBranchOptions([])
      setBranchError(null)
      return
    }

    void fetchBranches(undefined, { useDefaultBranch: true })
  }, [canUseBranchSelector, fetchBranches, repositoryIdentifier])
  
  useEffect(() => {
    if (!branchPickerOpen) {
      return
    }

    if (!repositoryIdentifier) {
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
  }, [branchPickerOpen, branchSearch, fetchBranches, repositoryIdentifier])
  
  useEffect(() => {
    if (!repositoryPickerOpen) {
      return
    }

    if (!gitlabIntegrationReady) {
      return
    }

    const handler = window.setTimeout(() => {
      void fetchRepositories(repositorySearch)
    }, 350)

    return () => {
      window.clearTimeout(handler)
    }
  }, [repositoryPickerOpen, repositorySearch, gitlabIntegrationReady, fetchRepositories])
  
  useEffect(() => {
    const normalized = (gitRepositoryValue ?? '').trim()

    if (!normalized) {
      if (selectedRepository) {
        setSelectedRepository(null)
      }
      branchInitialLoadRef.current = false
      setBranchOptions([])
      setBranchError(null)
      setBranchSearch('')
      return
    }

    if (selectedRepository && selectedRepository.httpUrlToRepo === normalized) {
      return
    }

    const matched = repositoryOptions.find((option) => option.value === normalized)
    if (matched) {
      setSelectedRepository(matched.repo)
    } else if (selectedRepository) {
      setSelectedRepository(null)
    }
  }, [gitRepositoryValue, repositoryOptions, selectedRepository])
  
  useEffect(() => {
    if (serviceType !== ServiceType.IMAGE) {
      return
    }

    const normalizedTag = tagValue === undefined ? 'latest' : tagValue
    const nextImage = imageValue ?? ''

    if (tagValue === undefined) {
      setValue('tag', 'latest')
    }
    if (imageValue === undefined) {
      setValue('image', nextImage)
    }

    setImageReference((prev) => {
      const nextTag = normalizedTag ?? ''
      if (prev.image === nextImage && (prev.tag ?? '') === (nextTag ?? '')) {
        return prev
      }
      return { optionId: null, image: nextImage, tag: nextTag }
    })
  }, [imageValue, tagValue, serviceType, setValue])

  const getDefaultDomainPrefix = () => {
    if (serviceType === ServiceType.IMAGE) {
      const fromImage = sanitizeDomainLabel(extractImageBaseName(imageValue))
      if (fromImage) {
        return fromImage
      }
    }

    const fromName = sanitizeDomainLabel(serviceNameValue || '')
    return fromName || 'service'
  }


  
  // 卷挂载管理
  const volumes = useMemo<Array<{ container_path: string; host_path: string; read_only: boolean }>>(
    () => [{ container_path: '', host_path: '', read_only: false }],
    []
  )
  
  // 构建参数管理
  const [buildArgs, setBuildArgs] = useState<Array<{ key: string; value: string }>>([{ key: '', value: '' }])

  // 生成随机密码
  const generatePassword = () => {
    return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12)
  }

  // 生成数据库连接 URL
  const generateConnectionUrl = (
    dbType: SupportedDatabaseType,
    host: string,
    port: number,
    username: string,
    password: string,
    database: string
  ) => {
    const normalizedHost = host.trim()
    const normalizedPort = Number.isFinite(port) ? port : Number(port)

    if (!normalizedHost || !Number.isFinite(normalizedPort) || normalizedPort <= 0) {
      return ''
    }

    if (dbType === DatabaseType.MYSQL) {
      const encodedUser = encodeURIComponent(username || 'root')
      const encodedPassword = encodeURIComponent(password || '')
      const encodedDatabase = database ? `/${encodeURIComponent(database)}` : ''
      return `mysql://${encodedUser}:${encodedPassword}@${normalizedHost}:${normalizedPort}${encodedDatabase}`
    }

    const encodedPassword = password ? encodeURIComponent(password) : ''
    return encodedPassword
      ? `redis://:${encodedPassword}@${normalizedHost}:${normalizedPort}`
      : `redis://${normalizedHost}:${normalizedPort}`
  }

  const handleImageReferenceChange = (next: ImageReferenceValue) => {
    setImageReference(next)
    setValue('image', next.image, { shouldValidate: true })
    setValue('tag', next.tag ?? '', { shouldValidate: true })
  }

  const onSubmit = async (data: ServiceFormValues) => {
    setLoading(true)
    
    try {
      const serviceData: ServicePayload = {
        project_id: projectId,
        name: data.name,
        type: serviceType,
        status: serviceType === ServiceType.APPLICATION ? 'pending' : 'pending'
      }

      // Application - 基于源码构建
      if (serviceType === ServiceType.APPLICATION) {
        serviceData.git_provider = GitProvider.GITLAB
        serviceData.git_repository = data.git_repository?.trim()
        serviceData.git_branch = data.git_branch?.trim() || 'main'
        serviceData.git_path = data.git_path?.trim() || '.'
        serviceData.build_type = data.build_type || BuildType.DOCKERFILE
        serviceData.dockerfile_path = data.dockerfile_path?.trim() || 'Dockerfile'
        serviceData.port = data.port ? parseInt(data.port) : 8080
        serviceData.replicas = data.replicas ? parseInt(data.replicas) : 1
        serviceData.command = data.command
        serviceData.auto_deploy = data.auto_deploy === 'true'
        
        // 构建参数
        const buildArgsObj: Record<string, string> = {}
        buildArgs.forEach(({ key, value }) => {
          if (key.trim()) buildArgsObj[key] = value
        })
        if (Object.keys(buildArgsObj).length > 0) {
          serviceData.build_args = buildArgsObj
        }
      }
      // Database - 内置数据库镜像
      else if (serviceType === ServiceType.DATABASE) {
        const metadata = DATABASE_TYPE_METADATA[selectedDatabaseType]
        const parsedPort = data.port ? Number.parseInt(data.port, 10) : NaN
        const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : metadata.defaultPort

        const version = (data.version ?? '').trim() || 'latest'
        const volumeSize = (data.volume_size ?? '').trim() || '10Gi'

        const internalHost =
          sanitizeDomainLabel(`service-${selectedDatabaseType}-${serviceData.name}`) ||
          `service-${selectedDatabaseType}`

        const isMysql = selectedDatabaseType === DatabaseType.MYSQL
        const username = isMysql ? (data.username ?? '').trim() || 'admin' : ''
        const databaseName = isMysql ? (data.database_name ?? '').trim() || serviceData.name : ''
        const password = (data.password ?? '').trim() || generatePassword()
        const rootPassword = isMysql ? (data.root_password ?? '').trim() || generatePassword() : undefined

        serviceData.database_type = selectedDatabaseType
        serviceData.version = version
        serviceData.port = port
        serviceData.password = password
        serviceData.volume_size = volumeSize
        serviceData.internal_host = internalHost
        serviceData.network_config = {
          service_type: 'NodePort',
          ports: [
            {
              container_port: port,
              service_port: port,
              protocol: 'TCP'
            }
          ]
        }

        if (isMysql) {
          serviceData.username = username
          serviceData.database_name = databaseName
          serviceData.root_password = rootPassword
        } else {
          delete serviceData.username
          delete serviceData.database_name
          delete serviceData.root_password
        }

        const connectionUrl = generateConnectionUrl(
          selectedDatabaseType,
          internalHost,
          port,
          username,
          password,
          databaseName
        )

        if (connectionUrl) {
          serviceData.internal_connection_url = connectionUrl
        } else {
          delete serviceData.internal_connection_url
        }
      }
      // 镜像服务 - 基于现有镜像
      else if (serviceType === ServiceType.IMAGE) {
        serviceData.image = data.image
        serviceData.tag = data.tag || 'latest'
        serviceData.command = data.command
        serviceData.replicas = data.replicas ? parseInt(data.replicas) : 1

        const portsPayload: Array<{
          container_port: number
          service_port: number
          protocol: 'TCP' | 'UDP'
          node_port?: number
          domain?: {
            enabled: boolean
            prefix: string
            host: string
          }
        }> = []
        let networkError: string | null = null
        const defaultPrefix = getDefaultDomainPrefix()

        for (const port of networkPorts) {
          const containerPort = parseInt(port.containerPort, 10)

          if (!Number.isInteger(containerPort) || containerPort <= 0) {
            if (
              port.enableDomain ||
              port.servicePort.trim().length > 0 ||
              port.nodePort.trim().length > 0
            ) {
              networkError = '请为启用域名访问的端口填写有效的容器端口。'
              break
            }
            continue
          }

          const servicePortValue = port.servicePort ? parseInt(port.servicePort, 10) : containerPort
          const servicePort =
            Number.isInteger(servicePortValue) && servicePortValue > 0 ? servicePortValue : containerPort

          const portPayload: {
            container_port: number
            service_port: number
            protocol: 'TCP' | 'UDP'
            node_port?: number
            domain?: {
              enabled: boolean
              prefix: string
              host: string
            }
          } = {
            container_port: containerPort,
            service_port: servicePort,
            protocol: port.protocol
          }

          if (networkServiceType === 'NodePort' && port.nodePort) {
            const nodePortValue = parseInt(port.nodePort, 10)
            if (Number.isInteger(nodePortValue) && nodePortValue > 0) {
              portPayload.node_port = nodePortValue
            }
          }

          if (port.enableDomain) {
            if (!projectIdentifier) {
              networkError = '启用域名访问前，请先配置项目编号。'
              break
            }

            const effectivePrefix = sanitizeDomainLabel(port.domainPrefix || defaultPrefix)
            if (!effectivePrefix) {
              networkError = '域名前缀不能为空，请使用小写字母、数字或中划线。'
              break
            }

            portPayload.domain = {
              enabled: true,
              prefix: effectivePrefix,
              host: `${effectivePrefix}.${projectIdentifier}.${DEFAULT_DOMAIN_ROOT}`
            }
          }

          portsPayload.push(portPayload)
        }

        if (networkError) {
          toast.error(networkError)
          setLoading(false)
          return
        }

        if (portsPayload.length > 0) {
          serviceData.network_config = {
            service_type: networkServiceType,
            ports: portsPayload
          }
        }
      }

      // 通用环境变量
      const envVarsObj: Record<string, string> = {}
      envVars.forEach(({ key, value }) => {
        if (key.trim()) envVarsObj[key] = value
      })
      if (Object.keys(envVarsObj).length > 0) {
        serviceData.env_vars = envVarsObj
      }


      // 卷挂载
      const validVolumes = volumes.filter(v => v.container_path.trim())
      if (validVolumes.length > 0) {
        serviceData.volumes = validVolumes
      }

      // 资源限制
      if (data.cpu || data.memory) {
        serviceData.resource_limits = {
          cpu: data.cpu,
          memory: data.memory
        }
      }

      await serviceSvc.createService(serviceData)
      toast.success('服务创建成功')
      onSuccess()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`创建服务失败：${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 基本信息 */}
      <div className="space-y-2">
        <Label htmlFor="name">服务名称 *</Label>
        <Input
          id="name"
          {...register('name', { required: true })}
          placeholder="输入服务名称"
        />
      </div>

      {/* Application - 基于源码构建 */}
      {serviceType === ServiceType.APPLICATION && (
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">代码源</TabsTrigger>
            <TabsTrigger value="build">构建</TabsTrigger>
            <TabsTrigger value="deploy">部署</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-3">
              {!gitConfigLoaded ? (
                <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载 GitLab 配置...
                </div>
              ) : null}
              {gitConfigLoaded && !gitProviderConfig ? (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
                  尚未配置 GitLab 全局信息，请前往系统配置页面完成设置。
                </div>
              ) : null}
              {gitConfigLoaded && gitProviderConfig && !gitProviderConfig.enabled ? (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
                  GitLab 全局配置已禁用，无法搜索仓库。
                </div>
              ) : null}
              {gitConfigLoaded && gitProviderConfig && gitProviderConfig.enabled && !gitProviderConfig.hasToken ? (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
                  GitLab 配置缺少 API Token，请前往系统配置页面添加。
                </div>
              ) : null}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>选择仓库</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => void fetchRepositories(repositorySearch)}
                    disabled={repositoryLoading || !gitlabIntegrationReady}
                  >
                    {repositoryLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-3.5 w-3.5" />
                    )}
                    刷新
                  </Button>
                </div>
                <Combobox
                  data={repositoryComboboxData}
                  type="仓库"
                  value={selectedRepositoryValue}
                  onValueChange={handleRepositorySelect}
                  open={repositoryPickerOpen}
                  onOpenChange={(open) => {
                    setRepositoryPickerOpen(open)
                    if (open) {
                      if (gitlabIntegrationReady && !repositoryLoading) {
                        void fetchRepositories(repositorySearch)
                      }
                    } else {
                      setRepositorySearch('')
                    }
                  }}
                >
                  <ComboboxTrigger className="w-full justify-between gap-3 px-3 py-2 h-auto min-h-[48px]">
                    <div className="flex w-full flex-col items-start gap-1 text-left">
                      <span className="w-full truncate text-sm font-semibold text-gray-900">
                        {selectedRepository
                          ? selectedRepository.fullName || selectedRepository.name
                          : manualRepositoryDisplay || '选择仓库'}
                      </span>
                      <div className="flex w-full items-center gap-2 text-xs text-gray-500">
                        <span className="truncate">
                          {selectedRepository
                            ? selectedRepository.pathWithNamespace
                            : '支持关键词搜索，或直接输入仓库 URL'}
                        </span>
                        {selectedRepository?.defaultBranch ? (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            默认 {selectedRepository.defaultBranch}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </ComboboxTrigger>
                  <ComboboxContent
                    className="max-h-80"
                    popoverOptions={{ className: 'w-[420px] max-h-80 p-0' }}
                  >
                    <ComboboxInput
                      placeholder="搜索或输入仓库 URL..."
                      value={repositorySearch}
                      onValueChange={(value) => setRepositorySearch(value)}
                    />
                    <ComboboxList className="max-h-72 overflow-y-auto py-1">
                      {repositoryLoading ? (
                        <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          正在搜索仓库...
                        </div>
                      ) : (
                        <>
                          <ComboboxEmpty>未找到匹配的仓库</ComboboxEmpty>
                          <ComboboxGroup className="space-y-1">
                            {repositoryOptions.map((option) => (
                              <ComboboxItem
                                key={option.value}
                                value={option.value}
                                className="flex flex-col gap-1 px-3 py-2"
                              >
                                <span className="text-sm font-medium text-gray-900">
                                  {option.repo.fullName || option.repo.name}
                                </span>
                                <span className="text-xs text-gray-500">{option.repo.pathWithNamespace}</span>
                                {option.repo.defaultBranch ? (
                                  <span className="text-[11px] text-gray-400">默认分支：{option.repo.defaultBranch}</span>
                                ) : null}
                              </ComboboxItem>
                            ))}
                          </ComboboxGroup>
                        </>
                      )}
                    </ComboboxList>
                    <ComboboxCreateNew
                      onCreateNew={(value) => {
                        const trimmed = value.trim()
                        if (!trimmed) {
                          return
                        }
                        branchInitialLoadRef.current = false
                        setSelectedRepository(null)
                        setBranchOptions([])
                        setBranchError(null)
                        setBranchSearch('')
                        setValue('git_repository', trimmed, { shouldValidate: true, shouldDirty: true })
                      }}
                    >
                      {(value) => <span>使用自定义仓库 “{value}”</span>}
                    </ComboboxCreateNew>
                  </ComboboxContent>
                </Combobox>
                <input type="hidden" {...register('git_repository', { required: true })} />
                {repositoryError ? (
                  <p className="text-xs text-red-500">{repositoryError}</p>
                ) : (
                  <p className="text-xs text-gray-500">
                    {gitlabIntegrationReady
                      ? ''
                      : 'GitLab 搜索不可用，可直接输入完整的仓库 URL。'}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="git_branch">分支</Label>
                  {canUseBranchSelector ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => void fetchBranches(undefined, { useDefaultBranch: false })}
                      disabled={!repositoryIdentifier || branchLoading}
                    >
                      {branchLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-3.5 w-3.5" />
                      )}
                      刷新
                    </Button>
                  ) : null}
                </div>
                {canUseBranchSelector ? (
                  <>
                    <Combobox
                      data={branchComboboxData}
                      type="分支"
                      value={normalizedBranchValue}
                      onValueChange={(value) => {
                        const trimmed = value.trim()
                        const current = (gitBranchRef.current ?? '').trim()
                        setValue('git_branch', trimmed, {
                          shouldDirty: trimmed !== current,
                          shouldValidate: true
                        })
                        gitBranchRef.current = trimmed
                        branchInitialLoadRef.current = true
                        setBranchSearch('')
                      }}
                      open={branchPickerOpen}
                      onOpenChange={(open) => {
                        setBranchPickerOpen(open)
                        if (!open) {
                          setBranchSearch('')
                        } else if (!branchOptions.length && repositoryIdentifier) {
                          void fetchBranches(undefined, { useDefaultBranch: !branchInitialLoadRef.current })
                        }
                      }}
                      disabled={!repositoryIdentifier}
                    >
                      <ComboboxTrigger
                        id="git_branch"
                        className="w-full justify-between gap-3 px-3 py-2 h-auto min-h-[44px]"
                        disabled={!repositoryIdentifier}
                      >
                        <div className="flex w-full flex-col items-start gap-1 text-left">
                          <span className="w-full truncate text-sm font-medium text-gray-900">
                            {branchDisplayLabel}
                          </span>
                          <span className="w-full truncate text-xs text-gray-500">
                            {repositoryIdentifier ? branchDisplayDescription : '请先选择仓库'}
                          </span>
                        </div>
                      </ComboboxTrigger>
                      <ComboboxContent
                        className="max-h-72"
                        popoverOptions={{ className: 'w-[320px] sm:w-[360px] max-h-72 p-0' }}
                      >
                        <ComboboxInput
                          placeholder={repositoryIdentifier ? '搜索分支...' : '请先选择仓库'}
                          value={branchSearch}
                          onValueChange={(value) => setBranchSearch(value)}
                          disabled={!repositoryIdentifier}
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
                                    className="flex flex-col gap-1 px-3 py-2"
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
                            const trimmed = value.trim()
                            if (!trimmed) {
                              return
                            }
                            const current = (gitBranchRef.current ?? '').trim()
                            setValue('git_branch', trimmed, {
                              shouldDirty: trimmed !== current,
                              shouldValidate: true
                            })
                            gitBranchRef.current = trimmed
                            branchInitialLoadRef.current = true
                            setBranchSearch('')
                          }}
                        >
                          {(value) => <span>使用自定义分支 “{value}”</span>}
                        </ComboboxCreateNew>
                      </ComboboxContent>
                    </Combobox>
                    <input type="hidden" {...register('git_branch', { required: true })} />
                    {branchError ? (
                      <p className="text-xs text-red-500">{branchError}</p>
                    ) : (
                      <p className="text-xs text-gray-500">选择仓库后可搜索并选择分支。</p>
                    )}
                  </>
                ) : (
                  <Input
                    id="git_branch"
                    {...register('git_branch', { required: true })}
                    placeholder="main"
                  />
                )}
              </div>
              {/* <div className="space-y-2">
                <Label htmlFor="git_path">项目路径</Label>
                <Input
                  id="git_path"
                  {...register('git_path')}
                  placeholder="."
                />
              </div> */}
            </div>
          </TabsContent>

          <TabsContent value="build" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="build_type">构建方式</Label>
              <Select onValueChange={(value) => setValue('build_type', value)} defaultValue={BuildType.DOCKERFILE}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BuildType.DOCKERFILE}>Dockerfile</SelectItem>
                  {/* <SelectItem value={BuildType.NIXPACKS}>Nixpacks</SelectItem> */}
                  {/* <SelectItem value={BuildType.BUILDPACKS}>Buildpacks</SelectItem> */}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dockerfile_path">Dockerfile 路径</Label>
              <Input
                id="dockerfile_path"
                {...register('dockerfile_path')}
                placeholder="Dockerfile"
                defaultValue="Dockerfile"
              />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>构建参数</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBuildArgs([...buildArgs, { key: '', value: '' }])}
                  className="gap-1"
                >
                  <Plus className="w-3 h-3" />
                  添加
                </Button>
              </div>
              <div className="space-y-2">
                {buildArgs.map((arg, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="变量名"
                      value={arg.key}
                      onChange={(e) => {
                        const newArgs = [...buildArgs]
                        newArgs[index].key = e.target.value
                        setBuildArgs(newArgs)
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="值"
                      value={arg.value}
                      onChange={(e) => {
                        const newArgs = [...buildArgs]
                        newArgs[index].value = e.target.value
                        setBuildArgs(newArgs)
                      }}
                      className="flex-1"
                    />
                    {buildArgs.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setBuildArgs(buildArgs.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deploy" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="port">容器端口</Label>
                <Input
                  id="port"
                  type="number"
                  {...register('port')}
                  placeholder="8080"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replicas">副本数</Label>
                <Input
                  id="replicas"
                  type="number"
                  {...register('replicas')}
                  placeholder="1"
                  defaultValue="1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="command">启动命令</Label>
              <Input
                id="command"
                {...register('command')}

                placeholder="npm start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto_deploy">自动部署</Label>
              <Select onValueChange={(value) => setValue('auto_deploy', value)} defaultValue="false">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">启用</SelectItem>
                  <SelectItem value="false">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

      )}

      {/* Database - 内置数据库镜像 */}
      {serviceType === ServiceType.DATABASE && (
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">基本配置</TabsTrigger>
            <TabsTrigger value="advanced">高级配置</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>数据库类型</Label>
              <div className="grid grid-cols-2 gap-2">
                {DATABASE_OPTIONS.map((db) => (
                  <Button
                    key={db.value}
                    type="button"
                    variant={selectedDatabaseType === db.value ? 'default' : 'outline'}
                    className="h-auto py-3"
                    onClick={() => setSelectedDatabaseType(db.value)}
                  >
                    <DatabaseIcon className="w-4 h-4 mr-2" />
                    {db.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="version">版本</Label>
              <Input
                id="version"
                {...register('version')}
                placeholder="latest"
                defaultValue="latest"
              />
            </div>

            <div
              className={`grid gap-4 grid-cols-1 ${
                selectedDatabaseType === DatabaseType.MYSQL ? 'md:grid-cols-2' : ''
              }`}
            >
              {selectedDatabaseType === DatabaseType.MYSQL && (
                <div className="space-y-2">
                  <Label htmlFor="database_name">数据库名</Label>
                  <Input
                    id="database_name"
                    {...register('database_name')}
                    placeholder="与服务名相同"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="volume_size">存储大小</Label>
                <Input
                  id="volume_size"
                  {...register('volume_size')}
                  placeholder="10Gi"
                  defaultValue="10Gi"
                />
              </div>
            </div>

            {selectedDatabaseType === DatabaseType.MYSQL ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    {...register('username')}
                    placeholder="admin"
                    defaultValue="admin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">数据库密码</Label>
                  <Input
                    id="password"
                    type="password"
                    {...register('password')}
                    placeholder="自动生成"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="password">访问密码</Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder="自动生成"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="port">内部端口</Label>
                <Input
                  id="port"
                  type="number"
                  {...register('port')}
                  placeholder="自动"
                />
              </div>
              <div className="space-y-2">
                <Label>外部访问</Label>
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-600">
                  服务创建后可在详情页开启外部访问，平台将自动分配端口并避免冲突。
                </div>
              </div>
            </div>

            {selectedDatabaseType === DatabaseType.MYSQL && (
              <div className="space-y-2">
                <Label htmlFor="root_password">Root 密码</Label>
                <Input
                  id="root_password"
                  type="password"
                  {...register('root_password')}
                  placeholder="自动生成"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* 镜像服务 - 基于现有镜像 */}
      {serviceType === ServiceType.IMAGE && (
        <div className="space-y-6">
          {/* 基本配置 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">基本配置</h3>
            
            <ImageReferencePicker
              value={imageReference}
              onChange={handleImageReferenceChange}
              label="镜像信息 *"
              description="输入镜像仓库与标签，例如 nginx:latest 或 registry.local/app:1.0.0"
              imagePlaceholder="nginx"
              tagPlaceholder="latest"
            />

            <div className="space-y-2">
              <Label htmlFor="command">启动命令（可选）</Label>
              <Input
                id="command"
                {...register('command')}
                placeholder="nginx -g 'daemon off;'"
              />
              <p className="text-xs text-gray-500">留空则使用镜像默认命令</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="replicas">副本数</Label>
              <Input
                id="replicas"
                type="number"
                {...register('replicas')}
                placeholder="1"
                defaultValue="1"
              />
            </div>
          </div>

          {/* 环境变量 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>环境变量（可选）</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}
                className="gap-1"
              >
                <Plus className="w-3 h-3" />
                添加
              </Button>
            </div>
            <div className="space-y-2">
              {envVars.map((env, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="变量名"
                    value={env.key}
                    onChange={(e) => {
                      const newEnvVars = [...envVars]
                      newEnvVars[index].key = e.target.value
                      setEnvVars(newEnvVars)
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="值"
                    value={env.value}
                    onChange={(e) => {
                      const newEnvVars = [...envVars]
                      newEnvVars[index].value = e.target.value
                      setEnvVars(newEnvVars)
                    }}
                    className="flex-1"
                  />
                  {envVars.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEnvVars(envVars.filter((_, i) => i !== index))}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              更多配置（网络、存储等）可在服务创建后进入编辑页面进行配置
            </p>
          </div>
        </div>
      )}

      {/* 通用环境变量 - 仅 Application 和 Database 类型显示 */}
      {(serviceType === ServiceType.APPLICATION || serviceType === ServiceType.DATABASE) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>环境变量（可选）</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}
              className="gap-1"
            >
              <Plus className="w-3 h-3" />
              添加
            </Button>
          </div>
          <div className="space-y-2">
            {envVars.map((env, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="变量名"
                  value={env.key}
                  onChange={(e) => {
                    const newEnvVars = [...envVars]
                    newEnvVars[index].key = e.target.value
                    setEnvVars(newEnvVars)
                  }}
                  className="flex-1"
                />
                <Input
                  placeholder="值"
                  value={env.value}
                  onChange={(e) => {
                    const newEnvVars = [...envVars]
                    newEnvVars[index].value = e.target.value
                    setEnvVars(newEnvVars)
                  }}
                  className="flex-1"
                />
                {envVars.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEnvVars(envVars.filter((_, i) => i !== index))}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          取消
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? '创建中...' : '创建服务'}
        </Button>
      </div>
    </form>
  )
}
