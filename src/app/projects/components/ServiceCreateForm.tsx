'use client'

import { useState } from 'react'
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
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { serviceSvc } from '@/service/serviceSvc'
import { ServiceType, DatabaseType, GitProvider, BuildType, Service } from '@/types/project'
import { Github, Gitlab, Box, Database as DatabaseIcon, Plus, Trash2 } from 'lucide-react'
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
  external_port?: string
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
  const { register, handleSubmit, setValue, watch } = useForm<ServiceFormValues>()
  const [selectedGitProvider, setSelectedGitProvider] = useState<GitProvider>(GitProvider.GITHUB)
  const [selectedDatabaseType, setSelectedDatabaseType] = useState<DatabaseType>(DatabaseType.MYSQL)
  
  // 环境变量管理
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([{ key: '', value: '' }])
  
  // 网络配置（镜像服务）
  const [networkServiceType, setNetworkServiceType] = useState<'ClusterIP' | 'NodePort' | 'LoadBalancer'>('ClusterIP')
  const [networkPorts, setNetworkPorts] = useState<NetworkPortFormState[]>([createEmptyPort()])
  
  const imageValue = watch('image') as string | undefined
  const serviceNameValue = watch('name') as string | undefined
  
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
  
  const domainSuffixText = projectIdentifier
    ? `${projectIdentifier}.${DEFAULT_DOMAIN_ROOT}`
    : `项目编号.${DEFAULT_DOMAIN_ROOT}`
  
  // 卷挂载管理
  const [volumes, setVolumes] = useState<Array<{ container_path: string; host_path: string; read_only: boolean }>>([{ container_path: '', host_path: '', read_only: false }])
  
  // 构建参数管理
  const [buildArgs, setBuildArgs] = useState<Array<{ key: string; value: string }>>([{ key: '', value: '' }])

  // 生成随机密码
  const generatePassword = () => {
    return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12)
  }

  // 生成数据库连接 URL
  const generateConnectionUrl = (
    dbType: DatabaseType,
    host: string,
    port: number,
    username: string,
    password: string,
    database: string
  ) => {
    switch (dbType) {
      case DatabaseType.MYSQL:
      case DatabaseType.MARIADB:
        return `mysql://${username}:${password}@${host}:${port}/${database}`
      case DatabaseType.POSTGRESQL:
        return `postgresql://${username}:${password}@${host}:${port}/${database}`
      case DatabaseType.MONGODB:
        return `mongodb://${username}:${password}@${host}:${port}/${database}`
      case DatabaseType.REDIS:
        return `redis://default:${password}@${host}:${port}`
      default:
        return ''
    }
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
        serviceData.git_provider = selectedGitProvider
        serviceData.git_repository = data.git_repository
        serviceData.git_branch = data.git_branch || 'main'
        serviceData.git_path = data.git_path || '/'
        serviceData.build_type = data.build_type || BuildType.DOCKERFILE
        serviceData.dockerfile_path = data.dockerfile_path || 'Dockerfile'
        serviceData.port = data.port ? parseInt(data.port) : 3000
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
        serviceData.database_type = selectedDatabaseType
        serviceData.version = data.version || 'latest'
        
        const defaultPorts: Record<DatabaseType, number> = {
          [DatabaseType.MYSQL]: 3306,
          [DatabaseType.POSTGRESQL]: 5432,
          [DatabaseType.MONGODB]: 27017,
          [DatabaseType.REDIS]: 6379,
          [DatabaseType.MARIADB]: 3306
        }
        serviceData.port = data.port ? parseInt(data.port) : defaultPorts[selectedDatabaseType]
        serviceData.external_port = data.external_port ? parseInt(data.external_port) : undefined
        
        serviceData.username = data.username || 'admin'
        serviceData.password = data.password || generatePassword()
        serviceData.root_password = data.root_password || generatePassword()
        serviceData.database_name = data.database_name || serviceData.name
        serviceData.volume_size = data.volume_size || '10Gi'
        
        serviceData.internal_host = `service-${serviceData.name}`
        serviceData.internal_connection_url = generateConnectionUrl(
          selectedDatabaseType,
          serviceData.internal_host,
          serviceData.port,
          serviceData.username,
          serviceData.password,
          serviceData.database_name
        )
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
            <div>
              <Label>Git 提供商</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[
                  { value: GitProvider.GITHUB, icon: Github, label: 'GitHub' },
                  { value: GitProvider.GITLAB, icon: Gitlab, label: 'GitLab' },
                  { value: GitProvider.BITBUCKET, icon: Box, label: 'Bitbucket' },
                  { value: GitProvider.GITEA, icon: Box, label: 'Gitea' }
                ].map((provider) => (
                  <Button
                    key={provider.value}
                    type="button"
                    variant={selectedGitProvider === provider.value ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-3"
                    onClick={() => setSelectedGitProvider(provider.value)}
                  >
                    <provider.icon className="w-5 h-5" />
                    <span className="text-xs">{provider.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="git_repository">仓库 URL *</Label>
              <Input
                id="git_repository"
                {...register('git_repository', { required: true })}
                placeholder="https://github.com/user/repo.git"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="git_branch">分支</Label>
                <Input
                  id="git_branch"
                  {...register('git_branch')}
                  placeholder="main"
                  defaultValue="main"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="git_path">项目路径</Label>
                <Input
                  id="git_path"
                  {...register('git_path')}
                  placeholder="/"
                  defaultValue="/"
                />
              </div>
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
                  <SelectItem value={BuildType.NIXPACKS}>Nixpacks</SelectItem>
                  <SelectItem value={BuildType.BUILDPACKS}>Buildpacks</SelectItem>
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
                  placeholder="3000"
                  defaultValue="3000"
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
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: DatabaseType.MYSQL, label: 'MySQL' },
                  { value: DatabaseType.POSTGRESQL, label: 'PostgreSQL' },
                  { value: DatabaseType.REDIS, label: 'Redis' },
                  { value: DatabaseType.MONGODB, label: 'MongoDB' },
                  { value: DatabaseType.MARIADB, label: 'MariaDB' }
                ].map((db) => (
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="database_name">数据库名</Label>
                <Input
                  id="database_name"
                  {...register('database_name')}
                  placeholder="与服务名相同"
                />
              </div>
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
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder="自动生成"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="external_port">外部端口</Label>
                <Input
                  id="external_port"
                  type="number"
                  {...register('external_port')}
                  placeholder="可选"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="root_password">Root 密码</Label>
              <Input
                id="root_password"
                type="password"
                {...register('root_password')}
                placeholder="自动生成"
              />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* 镜像服务 - 基于现有镜像 */}
      {serviceType === ServiceType.IMAGE && (
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">基本配置</TabsTrigger>
            <TabsTrigger value="network">网络</TabsTrigger>
            <TabsTrigger value="storage">存储</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="image">镜像名称 *</Label>
                <Input
                  id="image"
                  {...register('image', { required: true })}
                  placeholder="nginx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag">标签</Label>
                <Input
                  id="tag"
                  {...register('tag')}
                  placeholder="latest"
                  defaultValue="latest"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="command">启动命令</Label>
              <Input
                id="command"
                {...register('command')}
                placeholder="nginx -g 'daemon off;'"
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
          </TabsContent>

          <TabsContent value="network" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="text-sm text-gray-600">
                  配置服务的网络访问，将创建 Kubernetes Service 资源。
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Service 类型</Label>
                    <Select
                      value={networkServiceType}
                      onValueChange={(value: 'ClusterIP' | 'NodePort' | 'LoadBalancer') =>
                        setNetworkServiceType(value)
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

                  <div className="space-y-4">
                    {networkPorts.map((port, index) => {
                      const defaultPrefix = getDefaultDomainPrefix()
                      const activePrefix = port.domainPrefix || defaultPrefix
                      const previewDomain = `${activePrefix}.${domainSuffixText}`

                      return (
                        <div
                          key={port.id}
                          className="space-y-4 rounded-lg border border-gray-200 bg-white/80 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-900">端口配置 {index + 1}</h4>
                            {networkPorts.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeNetworkPort(port.id)}
                                className="gap-1 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                                移除
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700">容器监听端口 *</Label>
                              <Input
                                type="number"
                                placeholder="8080"
                                value={port.containerPort}
                                onChange={(e) => updatePortField(port.id, 'containerPort', e.target.value)}
                              />
                              <p className="text-xs text-gray-500">应用实际监听的端口</p>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700">Service 端口</Label>
                              <Input
                                type="number"
                                placeholder="默认同容器端口"
                                value={port.servicePort}
                                onChange={(e) => updatePortField(port.id, 'servicePort', e.target.value)}
                              />
                              <p className="text-xs text-gray-500">Kubernetes Service 暴露的端口</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700">协议</Label>
                              <Select
                                value={port.protocol}
                                onValueChange={(value: 'TCP' | 'UDP') =>
                                  updatePortField(port.id, 'protocol', value)
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
                                <p className="text-xs text-gray-500">可选，范围 30000-32767，不填写自动分配</p>
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
                              启用后可通过 <span className="font-mono text-gray-700">{previewDomain}</span> 访问该端口
                            </p>
                            {port.enableDomain && (
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-gray-700">域名前缀</Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      placeholder={defaultPrefix}
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
                                    项目尚未设置编号，保存前请先在项目信息中配置项目编号。
                                  </p>
                                )}
                                <p className="text-xs text-gray-500">
                                  默认使用镜像名作为前缀，仅可修改前缀部分
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={addNetworkPort}
                  >
                    <Plus className="h-4 w-4" />
                    添加端口
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="storage" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>卷挂载</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVolumes([...volumes, { container_path: '', host_path: '', read_only: false }])}
                  className="gap-1"
                >
                  <Plus className="w-3 h-3" />
                  添加卷
                </Button>
              </div>
              <div className="space-y-3">
                {volumes.map((volume, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">容器路径 *</Label>
                            <Input
                              placeholder="/app/data"
                              value={volume.container_path}
                              onChange={(e) => {
                                const newVolumes = [...volumes]
                                newVolumes[index].container_path = e.target.value
                                setVolumes(newVolumes)
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">主机路径</Label>
                            <Input
                              placeholder="/data"
                              value={volume.host_path}
                              onChange={(e) => {
                                const newVolumes = [...volumes]
                                newVolumes[index].host_path = e.target.value
                                setVolumes(newVolumes)
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`readonly-${index}`}
                              checked={volume.read_only}
                              onChange={(e) => {
                                const newVolumes = [...volumes]
                                newVolumes[index].read_only = e.target.checked
                                setVolumes(newVolumes)
                              }}
                              className="w-4 h-4"
                            />
                            <Label htmlFor={`readonly-${index}`} className="text-sm">只读模式</Label>
                          </div>
                          {volumes.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setVolumes(volumes.filter((_, i) => i !== index))}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* 通用配置 */}
      <div className="space-y-4 border-t pt-4">
        <h4 className="font-medium">通用配置</h4>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>环境变量</Label>
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
                  placeholder="变量名（如 NODE_ENV）"
                  value={env.key}
                  onChange={(e) => {
                    const newEnvVars = [...envVars]
                    newEnvVars[index].key = e.target.value
                    setEnvVars(newEnvVars)
                  }}
                  className="flex-1"
                />
                <Input
                  placeholder="值（如 production）"
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cpu">CPU 限制</Label>
            <Input
              id="cpu"
              {...register('cpu')}
              placeholder="500m"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memory">内存限制</Label>
            <Input
              id="memory"
              {...register('memory')}
              placeholder="512Mi"
            />
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2 pt-4 border-t">
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
