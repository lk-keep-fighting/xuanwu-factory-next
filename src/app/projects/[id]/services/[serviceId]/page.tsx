'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Play, Square, Trash2, RefreshCw, Settings, Terminal, FileText, Activity, Rocket, HardDrive, Save, Plus, X, Globe, FileCode, Check, Box } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ImageReferencePicker, type ImageReferenceValue } from '@/components/services/ImageReferencePicker'
import { serviceSvc } from '@/service/serviceSvc'
import { projectSvc } from '@/service/projectSvc'
import { DEFAULT_DOMAIN_ROOT, sanitizeDomainLabel } from '@/lib/network'
import { findVolumeTemplate, generateNFSSubpath, type VolumeTemplate } from '@/lib/volume-templates'
import { cn } from '@/lib/utils'
import { parseImageReference, formatImageReference } from '@/lib/service-image'
import { ServiceType } from '@/types/project'
import type { Service, Deployment, Project, NetworkConfig, NetworkConfigV2, NetworkPortConfig, ServiceImageRecord, ServiceImageStatus } from '@/types/project'

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

type NetworkPortFormState = {
  id: string
  containerPort: string
  servicePort: string
  protocol: 'TCP' | 'UDP'
  nodePort: string
  enableDomain: boolean
  domainPrefix: string
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
    } catch (error: any) {
      toast.error('加载服务失败：' + error.message)
      router.push(`/projects/${projectId}`)
    } finally {
      setLoading(false)
    }
  }, [initializeNetworkState, projectId, router, serviceId])

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
    loadService()
  }, [loadService])

  useEffect(() => {
    if (!serviceId) return
    setDeployments([])
    setDeploymentsError(null)
    setHasLoadedLogs(false)
    setLogs('')
    setLogsError(null)
    setDeploymentsLoading(true)
    loadDeployments()
  }, [loadDeployments, serviceId])

  useEffect(() => {
    if (activeTab === 'deployments') {
      loadDeployments()
    }

    if (activeTab === 'logs' && !hasLoadedLogs) {
      loadLogs()
    }
    
    if (activeTab === 'yaml' && !yamlContent) {
      loadYAML()
    }
  }, [activeTab, hasLoadedLogs, loadDeployments, loadLogs, loadYAML, yamlContent])

  // 启动服务
  const handleStart = async () => {
    if (!serviceId) return
    try {
      // 调用真正的 K8s 启动API
      await serviceSvc.startService(serviceId)
      toast.success('服务启动成功')
      loadService()
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
      loadService()
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
      loadService()
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
    
    const confirmMessage = service.type === ServiceType.APPLICATION 
      ? '确定要构建并部署此应用吗？'
      : `确定要部署此${service.type === ServiceType.DATABASE ? '数据库' : '镜像'}服务吗？`
    
    if (!confirm(confirmMessage)) return
    
    try {
      setDeploying(true)
      
      const result = await serviceSvc.deployService(serviceId)
      
      toast.success(result?.message || '部署成功，服务正在启动')
      await loadService()
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

  // 保存配置
  const handleSave = async () => {
    if (!serviceId) return
    
    try {
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
    ;(newVolumes[index] as any)[field] = value
    setVolumes(newVolumes)
  }

  if (loading || !service) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  const normalizedStatus = normalizeServiceStatus(service.status)
  const statusColor = STATUS_COLORS[normalizedStatus]
  const statusLabel = STATUS_LABELS[normalizedStatus]

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
              
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{service.name}</h1>
                <Badge variant="outline">
                  {service.type === ServiceType.APPLICATION && 'Application'}
                  {service.type === ServiceType.DATABASE && 'Database'}
                  {service.type === ServiceType.IMAGE && 'Image'}
                </Badge>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                  <span className="text-sm text-gray-600">{statusLabel}</span>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
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
                        <Label>Git 提供商</Label>
                        <Input value={service.git_provider || '-'} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>分支</Label>
                        <Input 
                          value={isEditing ? (editedService.git_branch || 'main') : (service.git_branch || 'main')}
                          onChange={(e) => setEditedService({ ...editedService, git_branch: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
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
                  <CardHeader>
                    <CardTitle>部署配置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>端口</Label>
                        <Input 
                          type="number"
                          value={isEditing ? (editedService.port || '') : (service.port || '-')}
                          onChange={(e) => setEditedService({ ...editedService, port: parseInt(e.target.value) })}
                          disabled={!isEditing}
                        />
                      </div>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>数据库类型</Label>
                        <Input value={service.database_type?.toUpperCase() || '-'} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>版本</Label>
                        <Input value={service.version || 'latest'} disabled />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>数据库名</Label>
                        <Input value={service.database_name || '-'} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>存储大小</Label>
                        <Input 
                          value={isEditing ? (editedService.volume_size || '10Gi') : (service.volume_size || '10Gi')}
                          onChange={(e) => setEditedService({ ...editedService, volume_size: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>连接信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>内部主机</Label>
                      <div className="flex gap-2">
                        <Input value={service.internal_host || '-'} disabled className="flex-1" />
                        <Button size="sm" variant="outline" onClick={() => {
                          navigator.clipboard.writeText(service.internal_host || '')
                          toast.success('已复制')
                        }}>
                          复制
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>连接 URL</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={service.internal_connection_url || '-'} 
                          disabled 
                          className="flex-1"
                          type="password"
                        />
                        <Button size="sm" variant="outline" onClick={() => {
                          navigator.clipboard.writeText(service.internal_connection_url || '')
                          toast.success('已复制')
                        }}>
                          复制
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>内部端口</Label>
                        <Input value={service.port || '-'} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>外部端口</Label>
                        <Input 
                          type="number"
                          value={isEditing ? (editedService.external_port || '') : (service.external_port || '-')}
                          onChange={(e) => setEditedService({ ...editedService, external_port: parseInt(e.target.value) })}
                          disabled={!isEditing}
                        />
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
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label>镜像</Label>
                      <Input
                        placeholder="例如：nginx"
                        value={
                          isEditing
                            ? (typeof editedService.image === 'string' ? editedService.image : '')
                            : service.image || '-'
                        }
                        onChange={(e) =>
                          setEditedService({
                            ...editedService,
                            image: e.target.value
                          })
                        }
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>标签</Label>
                      <Input
                        placeholder="例如：latest"
                        value={
                          isEditing
                            ? (typeof editedService.tag === 'string' ? editedService.tag : '')
                            : service.tag || 'latest'
                        }
                        onChange={(e) =>
                          setEditedService({
                            ...editedService,
                            tag: e.target.value
                          })
                        }
                        disabled={!isEditing}
                      />
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

            {/* 资源限制 */}
            <Card>
              <CardHeader>
                <CardTitle>资源限制</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CPU 限制</Label>
                    <Input 
                      placeholder="如: 1000m 或 1"
                      value={isEditing ? (editedService.resource_limits?.cpu || '') : (service.resource_limits?.cpu || '-')}
                      onChange={(e) => setEditedService({ 
                        ...editedService, 
                        resource_limits: { ...editedService.resource_limits, cpu: e.target.value }
                      })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>内存限制</Label>
                    <Input 
                      placeholder="如: 512Mi 或 1Gi"
                      value={isEditing ? (editedService.resource_limits?.memory || '') : (service.resource_limits?.memory || '-')}
                      onChange={(e) => setEditedService({ 
                        ...editedService, 
                        resource_limits: { ...editedService.resource_limits, memory: e.target.value }
                      })}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
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
                        <li>修改配置后需点击"刷新"重新生成 YAML</li>
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
    </div>
  )
}
