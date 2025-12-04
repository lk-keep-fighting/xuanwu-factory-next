import * as k8s from '@kubernetes/client-node'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import https from 'node:https'
import path from 'node:path'
import { Readable, Writable } from 'node:stream'
import {
  type Service,
  type ApplicationService,
  type DatabaseService,
  type ImageService,
  type CreateServiceRequest,
  ServiceType,
  type NetworkConfigV2,
  DATABASE_TYPE_METADATA,
  type SupportedDatabaseType,
  type DebugConfig,
  type MultiDebugConfig
} from '@/types/project'
import {
  normalizeDebugConfig,
  generateDebugInitContainers,
  generateDebugVolumes
} from '@/lib/debug-tools-utils'
import type {
  K8sImportCandidate,
  K8sWorkloadKind,
  K8sImportVolumeInfo,
  K8sFileEntry,
  K8sFileListResult
} from '@/types/k8s'
import * as yaml from 'js-yaml'

type NormalizedPortDomain = {
  host: string
  prefix?: string
}

type NormalizedPortConfig = {
  containerPort: number
  servicePort: number
  protocol: 'TCP' | 'UDP'
  nodePort?: number
  domain?: NormalizedPortDomain
}

type NormalizedNetworkConfig = {
  serviceType: 'ClusterIP' | 'NodePort' | 'LoadBalancer'
  ports: NormalizedPortConfig[]
  headlessServiceEnabled: boolean
}

type IngressRuleConfig = {
  host: string
  servicePort: number
}

type ImageInfo = {
  repository: string
  tag: string
}

const DATABASE_DATA_PATHS: Partial<Record<SupportedDatabaseType, string>> = {
  mysql: '/var/lib/mysql',
  redis: '/data'
}

// 向后兼容：重新导出 FileSystemError 为 K8sFileError
export { FileSystemError as K8sFileError } from '@/lib/filesystem'

class K8sService {
  private kc: k8s.KubeConfig
  private appsApi: k8s.AppsV1Api
  // 公开以供文件管理服务使用
  readonly coreApi: k8s.CoreV1Api
  private networkingApi: k8s.NetworkingV1Api
  private rbacApi: k8s.RbacAuthorizationV1Api
  private execClient: k8s.Exec
  private namespaceAccessCache = new Set<string>()
  private clusterAccessCache = new Set<string>()
  private serviceAccountIdentity?: { namespace: string; name: string } | null
  private podExecLocks = new Map<string, Promise<unknown>>()

  constructor() {
    this.kc = new k8s.KubeConfig()

    this.initializeKubeConfig()

    // 配置 HTTPS Agent 以支持自签名证书
    this.configureHttpsAgent()

    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api)
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api)
    this.networkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api)
    this.rbacApi = this.kc.makeApiClient(k8s.RbacAuthorizationV1Api)
    this.execClient = new k8s.Exec(this.kc)
  }

  private initializeKubeConfig(): void {
    try {
      const kubeconfigData = process.env.KUBECONFIG_DATA?.trim()
      const apiServer = process.env.K8S_API_SERVER?.trim()
      const bearerToken = process.env.K8S_BEARER_TOKEN?.trim()
      const isVerbose = process.env.K8S_VERBOSE === 'true'

      if (kubeconfigData) {
        const configValue = this.decodeConfigInput(kubeconfigData)
        if (isVerbose) console.log('[K8s] 使用 KUBECONFIG_DATA 环境变量加载配置')
        this.kc.loadFromString(configValue)
      } else if (apiServer && bearerToken) {
        if (isVerbose) console.log('[K8s] 使用 K8S_API_SERVER + K8S_BEARER_TOKEN 环境变量加载配置')
        this.loadFromTokenEnv()
      } else if (process.env.KUBECONFIG) {
        if (isVerbose) console.log('[K8s] 使用 KUBECONFIG 路径加载配置:', process.env.KUBECONFIG)
        this.kc.loadFromFile(process.env.KUBECONFIG)
      } else {
        if (isVerbose) console.log('[K8s] 使用默认配置加载 (~/.kube/config)')
        this.kc.loadFromDefault()
      }

      const currentCluster = this.kc.getCurrentCluster()
      const currentContext = this.kc.getCurrentContext()

      if (currentCluster) {
        if (isVerbose) {
          console.log('[K8s] ✅ 配置加载成功')
          console.log('[K8s]    集群:', currentCluster.name)
          console.log('[K8s]    API Server:', currentCluster.server)
          console.log('[K8s]    上下文:', currentContext)
          console.log('[K8s]    TLS验证:', currentCluster.skipTLSVerify ? '已禁用 ⚠️' : '已启用')
        }
      } else {
        console.warn('[K8s] ⚠️  配置加载但未找到当前集群')
      }
    } catch (error: unknown) {
      const message = this.getErrorMessage(error)
      console.error('[K8s] ❌ 配置加载失败:', message)
      console.error('[K8s] ⚠️  所有 K8s 操作将会失败！')
      console.error('[K8s] 💡 解决方案:')
      console.error('[K8s]    1. 本地开发：确保 ~/.kube/config 存在且有效')
      console.error('[K8s]    2. 测试连接：运行 kubectl cluster-info')
      console.error('[K8s]    3. 生产环境：设置 KUBECONFIG_DATA 或 K8S_API_SERVER/K8S_BEARER_TOKEN 环境变量')
      console.error('[K8s] 原始错误对象:', error)
    }
  }

  /**
   * 配置 HTTPS Agent 以支持自签名证书
   */
  private configureHttpsAgent(): void {
    const currentCluster = this.kc.getCurrentCluster()
    const isVerbose = process.env.K8S_VERBOSE === 'true'
    
    // 如果集群配置了 skipTLSVerify 或没有提供 CA 证书，则禁用证书验证
    if (currentCluster?.skipTLSVerify || !currentCluster?.caData) {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false
      })
      
      // 为 KubeConfig 设置自定义的 HTTPS Agent
      // @ts-expect-error - KubeConfig 内部支持但未在类型定义中暴露
      this.kc.requestOptions = {
        httpsAgent
      }
      
      if (isVerbose) console.log('[K8s] 🔓 已配置 HTTPS Agent：禁用证书验证（适用于自签名证书）')
    } else {
      if (isVerbose) console.log('[K8s] 🔒 使用默认 HTTPS Agent：启用证书验证')
    }
  }

  private loadFromTokenEnv(): void {
    const server = process.env.K8S_API_SERVER?.trim()
    const token = process.env.K8S_BEARER_TOKEN?.trim()

    if (!server || !token) {
      throw new Error('K8S_API_SERVER 和 K8S_BEARER_TOKEN 环境变量不能为空')
    }

    const clusterName = process.env.K8S_CLUSTER_NAME?.trim() || 'xuanwu-factory-cluster'
    const contextName = process.env.K8S_CONTEXT_NAME?.trim() || `${clusterName}-context`
    const userName = process.env.K8S_CLUSTER_USER?.trim() || 'xuanwu-factory-admin'

    const caDataRaw = process.env.K8S_CA_CERT_DATA?.trim()
    const skipTls = this.parseBooleanEnv(process.env.K8S_SKIP_TLS_VERIFY)

    const caData = caDataRaw ? this.normalizeCaData(caDataRaw) : undefined
    let effectiveSkipTls = skipTls

    if (effectiveSkipTls === undefined && !caData) {
      console.warn('[K8s] ⚠️ 未提供 K8S_CA_CERT_DATA，将跳过 TLS 证书校验')
      effectiveSkipTls = true
    }

    const cluster: k8s.Cluster = {
      name: clusterName,
      server,
      ...(caData ? { caData } : {}),
      skipTLSVerify: effectiveSkipTls ?? false
    }

    const user: k8s.User = {
      name: userName,
      token
    }

    const context: k8s.Context = {
      name: contextName,
      user: userName,
      cluster: clusterName
    }

    this.kc.loadFromOptions({
      clusters: [cluster],
      users: [user],
      contexts: [context],
      currentContext: context.name
    })
  }

  private decodeConfigInput(rawValue: string): string {
    const trimmed = rawValue.trim()
    if (!trimmed) {
      return trimmed
    }

    const sanitized = trimmed.replace(/\s+/g, '')
    const base64Pattern = /^[A-Za-z0-9+/=]+$/
    const isLikelyBase64 = sanitized.length >= 16 && base64Pattern.test(sanitized)

    if (!isLikelyBase64) {
      return rawValue
    }

    try {
      const padding = sanitized.length % 4 === 0 ? '' : '='.repeat(4 - (sanitized.length % 4))
      const decoded = Buffer.from(`${sanitized}${padding}`, 'base64').toString('utf8')
      const normalizedDecoded = decoded.trim()

      if (!normalizedDecoded) {
        return rawValue
      }

      if (
        normalizedDecoded.includes('apiVersion:') ||
        normalizedDecoded.includes('clusters:') ||
        normalizedDecoded.startsWith('{')
      ) {
        return decoded
      }
    } catch (error) {
      console.warn('[K8s] ⚠️ KUBECONFIG_DATA 看起来不是 Base64，使用原始值', error)
    }

    return rawValue
  }

  private normalizeCaData(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) {
      return trimmed
    }

    if (trimmed.includes('-----BEGIN CERTIFICATE-----')) {
      return Buffer.from(trimmed).toString('base64')
    }

    const sanitized = trimmed.replace(/\s+/g, '')
    const base64Pattern = /^[A-Za-z0-9+/=]+$/

    if (base64Pattern.test(sanitized)) {
      return sanitized
    }

    console.warn('[K8s] ⚠️ K8S_CA_CERT_DATA 不是有效的 Base64，将保留原始值')
    return trimmed
  }

  private parseBooleanEnv(value?: string | null): boolean | undefined {
    if (value === undefined || value === null) {
      return undefined
    }

    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return undefined
    }

    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
      return true
    }
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
      return false
    }

    return undefined
  }

  /**
   * 部署服务到 Kubernetes
   */
  async deployService(service: Service, namespace: string) {
    const targetNamespace = namespace?.trim() || 'default'

    await this.ensureNamespace(targetNamespace)

    // 获取replicas值，根据不同类型处理
    let replicas = 1
    if (service.type === ServiceType.APPLICATION || service.type === ServiceType.IMAGE) {
      replicas = (service as ApplicationService | ImageService).replicas || 1
    }

    const normalizedNetwork = this.normalizeNetworkConfig(service.network_config)
    const effectiveNetwork =
      normalizedNetwork ??
      (service.type === ServiceType.DATABASE
        ? this.buildDefaultDatabaseNetworkConfig(service as DatabaseService)
        : null)

    if (service.type === ServiceType.DATABASE) {
      await this.deployDatabaseStatefulSet(service as DatabaseService, targetNamespace, effectiveNetwork)
    } else {
      const commandConfig = this.parseCommand((service as ApplicationService | ImageService).command)
      
      // 规范化调试配置（支持旧格式自动转换）
      const normalizedDebugConfig = normalizeDebugConfig(service.debug_config)
      
      // 构建基础卷和卷挂载
      const baseVolumes = this.buildVolumes(service.volumes) || []
      const baseVolumeMounts = this.buildVolumeMounts(service.volumes, service.name) || []
      
      // 生成调试工具的 Init Containers 和 Volumes
      const debugInitContainers = generateDebugInitContainers(normalizedDebugConfig)
      const debugVolumes = generateDebugVolumes(normalizedDebugConfig)
      
      // 为每个调试工具添加卷挂载到主容器
      const debugVolumeMounts = normalizedDebugConfig?.enabled && normalizedDebugConfig.tools
        ? normalizedDebugConfig.tools.map(tool => ({
            name: `debug-tools-${tool.toolset}`,
            mountPath: tool.mountPath
          }))
        : []
      
      // 合并所有卷和卷挂载
      const volumes = [...baseVolumes, ...debugVolumes]
      const volumeMounts = [...baseVolumeMounts, ...debugVolumeMounts]
      
      const deployment: k8s.V1Deployment = {
        metadata: {
          name: service.name,
          labels: { app: service.name },
          namespace: targetNamespace
        },
        spec: {
          replicas,
          selector: {
            matchLabels: { app: service.name }
          },
          template: {
            metadata: {
              labels: { app: service.name }
            },
            spec: {
              // 添加 Init Containers（如果有调试工具）
              ...(debugInitContainers.length > 0 && {
                initContainers: debugInitContainers
              }),
              containers: [{
                name: service.name,
                image: this.getImage(service),
                ...(commandConfig.command && { command: commandConfig.command }),
                ...(commandConfig.args && { args: commandConfig.args }),
                ports: effectiveNetwork
                  ? effectiveNetwork.ports.map((port, index) => ({
                      containerPort: port.containerPort,
                      protocol: port.protocol,
                      name: `port-${port.containerPort}-${index}`
                    }))
                  : undefined,
                env: this.buildEnvVars(service),
                resources: this.buildResources(service.resource_limits, service.resource_requests),
                volumeMounts: volumeMounts.length ? volumeMounts : undefined
              }],
              volumes: volumes.length ? volumes : undefined
            }
          }
        }
      }

      try {
        await this.appsApi.createNamespacedDeployment({ namespace: targetNamespace, body: deployment })
      } catch (error: unknown) {
        if (this.getStatusCode(error) === 409) {
          await this.appsApi.replaceNamespacedDeployment({
            name: service.name,
            namespace: targetNamespace,
            body: deployment
          })
        } else {
          throw error
        }
      }
    }

    // 使用 network_config 创建 K8s Service
    if (effectiveNetwork) {
      await this.createServiceFromConfig(service, targetNamespace, effectiveNetwork)
    }

    return { success: true }
  }

  private buildDefaultDatabaseNetworkConfig(service: DatabaseService): NormalizedNetworkConfig {
    const port = this.resolveDatabasePort(service)
    const nodePort = typeof service.external_port === 'number' && service.external_port > 0
      ? service.external_port
      : undefined

    return {
      serviceType: 'NodePort',
      headlessServiceEnabled: false,
      ports: [
        {
          containerPort: port,
          servicePort: port,
          protocol: 'TCP',
          ...(nodePort ? { nodePort } : {})
        }
      ]
    }
  }

  private resolveDatabasePort(service: DatabaseService): number {
    if (typeof service.port === 'number' && Number.isInteger(service.port) && service.port > 0) {
      return service.port
    }

    const parsedPort = Number(service.port)
    if (Number.isInteger(parsedPort) && parsedPort > 0) {
      return parsedPort
    }

    const rawType = (service.database_type ?? '').toLowerCase()
    const metadata = DATABASE_TYPE_METADATA[rawType as SupportedDatabaseType]

    if (metadata) {
      return metadata.defaultPort
    }

    return 3306
  }

  private getDatabaseDataMountPath(service: DatabaseService): string | null {
    const rawType = (service.database_type ?? '').toLowerCase()
    if (!rawType) {
      return null
    }

    return DATABASE_DATA_PATHS[rawType as SupportedDatabaseType] ?? null
  }

  /**
   * 创建 MySQL ConfigMap
   */
  private async createMySQLConfigMap(
    service: DatabaseService,
    namespace: string
  ): Promise<void> {
    const serviceName = service.name?.trim()
    if (!serviceName || !service.mysql_config) {
      console.log('[K8s][MySQL] Skipping ConfigMap creation:', {
        serviceName,
        hasMysqlConfig: !!service.mysql_config
      })
      return
    }

    console.log('[K8s][MySQL] Creating ConfigMap with config:', service.mysql_config)
    const { generateMyCnfContent } = await import('@/lib/mysql-config-templates')
    const myCnfContent = generateMyCnfContent(service.mysql_config)
    console.log('[K8s][MySQL] Generated my.cnf content:', myCnfContent)

    const configMap: k8s.V1ConfigMap = {
      metadata: {
        name: `${serviceName}-config`,
        namespace,
        labels: {
          app: serviceName,
          'managed-by': 'xuanwu-platform',
          'config-type': 'mysql'
        }
      },
      data: {
        'my.cnf': myCnfContent
      }
    }

    try {
      await this.coreApi.createNamespacedConfigMap({ namespace, body: configMap })
    } catch (error: unknown) {
      if (this.getStatusCode(error) === 409) {
        // ConfigMap 已存在，更新它
        const existing = await this.coreApi.readNamespacedConfigMap({
          name: `${serviceName}-config`,
          namespace
        })
        const resourceVersion = existing.metadata?.resourceVersion
        const updatedConfigMap: k8s.V1ConfigMap = {
          ...configMap,
          metadata: {
            ...configMap.metadata,
            resourceVersion
          }
        }
        await this.coreApi.replaceNamespacedConfigMap({
          name: `${serviceName}-config`,
          namespace,
          body: updatedConfigMap
        })
      } else {
        throw error
      }
    }
  }

  /**
   * 更新 MySQL ConfigMap
   */
  async updateMySQLConfigMap(
    service: DatabaseService,
    namespace: string
  ): Promise<void> {
    await this.createMySQLConfigMap(service, namespace)
  }

  /**
   * 重启 StatefulSet（通过添加注解触发滚动更新）
   */
  async restartStatefulSet(serviceName: string, namespace: string): Promise<void> {
    const targetNamespace = namespace?.trim() || 'default'
    
    try {
      const statefulSet = await this.appsApi.readNamespacedStatefulSet({
        name: serviceName,
        namespace: targetNamespace
      })

      const now = new Date().toISOString()
      const updatedStatefulSet: k8s.V1StatefulSet = {
        ...statefulSet,
        spec: {
          ...statefulSet.spec,
          template: {
            ...statefulSet.spec?.template,
            metadata: {
              ...statefulSet.spec?.template?.metadata,
              annotations: {
                ...statefulSet.spec?.template?.metadata?.annotations,
                'kubectl.kubernetes.io/restartedAt': now
              }
            }
          }
        }
      }

      await this.appsApi.replaceNamespacedStatefulSet({
        name: serviceName,
        namespace: targetNamespace,
        body: updatedStatefulSet
      })
    } catch (error: unknown) {
      console.error('Failed to restart StatefulSet:', error)
      throw new Error(`重启 StatefulSet 失败: ${this.getErrorMessage(error)}`)
    }
  }

  private async deployDatabaseStatefulSet(
    service: DatabaseService,
    namespace: string,
    networkConfig: NormalizedNetworkConfig | null
  ): Promise<void> {
    const serviceName = service.name?.trim()

    if (!serviceName) {
      throw new Error('数据库服务名称缺失，无法部署。')
    }

    // 为 MySQL 创建 ConfigMap
    if (service.database_type === 'mysql' && service.mysql_config) {
      await this.createMySQLConfigMap(service, namespace)
    }

    const containerPorts = networkConfig
      ? networkConfig.ports.map((port, index) => ({
          containerPort: port.containerPort,
          protocol: port.protocol,
          name: `port-${port.containerPort}-${index}`
        }))
      : undefined

    const rawReplicas = (service as { replicas?: number | null }).replicas
    const replicas = typeof rawReplicas === 'number' && Number.isInteger(rawReplicas) && rawReplicas > 0
      ? rawReplicas
      : 1

    const baseVolumeMounts = this.buildVolumeMounts(service.volumes, serviceName) ?? []
    const volumeMounts = [...baseVolumeMounts]

    const volumeSize = typeof service.volume_size === 'string' ? service.volume_size.trim() : ''
    const dataMountPath = this.getDatabaseDataMountPath(service)
    
    // 为 Redis 数据库自动注入密码命令
    let effectiveCommand = (service as DatabaseService & { command?: string }).command
    if (service.database_type === 'redis' && service.password && !effectiveCommand) {
      effectiveCommand = `redis-server --requirepass ${service.password}`
    }
    
    const commandConfig = this.parseCommand(effectiveCommand)

    let volumeClaimTemplates: k8s.V1PersistentVolumeClaim[] | undefined

    if (volumeSize && dataMountPath) {
      volumeClaimTemplates = [
        {
          metadata: {
            name: 'data',
            labels: {
              app: serviceName,
              'managed-by': 'xuanwu-platform'
            }
          },
          spec: {
            accessModes: ['ReadWriteOnce'],
            resources: {
              requests: {
                storage: volumeSize
              }
            }
          }
        }
      ]

      const hasDataMount = volumeMounts.some((mount) => mount.name === 'data' || mount.mountPath === dataMountPath)
      if (!hasDataMount) {
        volumeMounts.push({
          name: 'data',
          mountPath: dataMountPath
        })
      }
    }

    // 为 MySQL 挂载配置文件
    const volumes = this.buildVolumes(service.volumes) || []
    if (service.database_type === 'mysql' && service.mysql_config) {
      volumes.push({
        name: 'mysql-config',
        configMap: {
          name: `${serviceName}-config`
        }
      })
      
      volumeMounts.push({
        name: 'mysql-config',
        mountPath: '/etc/mysql/conf.d/my.cnf',
        subPath: 'my.cnf'
      })
    }

    // 规范化调试配置（支持旧格式自动转换）
    const normalizedDebugConfig = normalizeDebugConfig(service.debug_config)
    
    // 生成调试工具的 Init Containers 和 Volumes
    const debugInitContainers = generateDebugInitContainers(normalizedDebugConfig)
    const debugVolumes = generateDebugVolumes(normalizedDebugConfig)
    
    // 为每个调试工具添加卷挂载到主容器
    const debugVolumeMounts = normalizedDebugConfig?.enabled && normalizedDebugConfig.tools
      ? normalizedDebugConfig.tools.map(tool => ({
          name: `debug-tools-${tool.toolset}`,
          mountPath: tool.mountPath
        }))
      : []
    
    // 合并调试工具卷和卷挂载
    volumes.push(...debugVolumes)
    volumeMounts.push(...debugVolumeMounts)

    const statefulSet: k8s.V1StatefulSet = {
      metadata: {
        name: serviceName,
        namespace,
        labels: {
          app: serviceName,
          'managed-by': 'xuanwu-platform'
        }
      },
      spec: {
        serviceName: serviceName,
        replicas,
        selector: {
          matchLabels: { app: serviceName }
        },
        template: {
          metadata: {
            labels: { app: serviceName }
          },
          spec: {
            // 添加 Init Containers（如果有调试工具）
            ...(debugInitContainers.length > 0 && {
              initContainers: debugInitContainers
            }),
            containers: [
              {
                name: serviceName,
                image: this.getImage(service),
                ...(commandConfig.command && { command: commandConfig.command }),
                ...(commandConfig.args && { args: commandConfig.args }),
                ports: containerPorts,
                env: this.buildEnvVars(service),
                resources: this.buildResources(service.resource_limits, service.resource_requests),
                volumeMounts: volumeMounts.length ? volumeMounts : undefined
              }
            ],
            volumes: volumes.length ? volumes : undefined
          }
        },
        ...(volumeClaimTemplates ? { volumeClaimTemplates } : {})
      }
    }

    try {
      await this.appsApi.createNamespacedStatefulSet({ namespace, body: statefulSet })
    } catch (error: unknown) {
      if (this.getStatusCode(error) === 409) {
        const existing = await this.appsApi.readNamespacedStatefulSet({ name: serviceName, namespace })
        const resourceVersion = existing.metadata?.resourceVersion
        const updatedStatefulSet: k8s.V1StatefulSet = {
          ...statefulSet,
          metadata: {
            ...statefulSet.metadata,
            resourceVersion
          }
        }

        await this.appsApi.replaceNamespacedStatefulSet({
          name: serviceName,
          namespace,
          body: updatedStatefulSet
        })
      } else {
        throw error
      }
    }
  }

  /**
   * 停止服务（将副本数设为 0）
   */
  async stopService(serviceName: string, namespace: string) {
    const targetNamespace = namespace?.trim() || 'default'

    try {
      const deployment = await this.appsApi.readNamespacedDeployment({ name: serviceName, namespace: targetNamespace })
      const originalReplicas = deployment.spec?.replicas || 1

      const updatedDeployment = {
        ...deployment,
        metadata: {
          ...deployment.metadata,
          annotations: {
            ...deployment.metadata?.annotations,
            'xuanwu.io/original-replicas': String(originalReplicas)
          }
        },
        spec: {
          ...deployment.spec,
          replicas: 0
        }
      }

      await this.appsApi.replaceNamespacedDeployment({
        name: serviceName,
        namespace: targetNamespace,
        body: updatedDeployment as k8s.V1Deployment
      })

      return { success: true, message: '服务已停止' }
    } catch (deploymentError: unknown) {
      if (this.getStatusCode(deploymentError) !== 404) {
        console.error('Failed to stop service:', deploymentError)
        throw new Error(`停止服务失败: ${this.getErrorMessage(deploymentError)}`)
      }
    }

    try {
      const statefulSet = await this.appsApi.readNamespacedStatefulSet({ name: serviceName, namespace: targetNamespace })
      const originalReplicas = statefulSet.spec?.replicas || 1

      const updatedStatefulSet = {
        ...statefulSet,
        metadata: {
          ...statefulSet.metadata,
          annotations: {
            ...statefulSet.metadata?.annotations,
            'xuanwu.io/original-replicas': String(originalReplicas)
          }
        },
        spec: {
          ...statefulSet.spec,
          replicas: 0
        }
      }

      await this.appsApi.replaceNamespacedStatefulSet({
        name: serviceName,
        namespace: targetNamespace,
        body: updatedStatefulSet as k8s.V1StatefulSet
      })

      return { success: true, message: '服务已停止' }
    } catch (statefulError: unknown) {
      console.error('Failed to stop service:', statefulError)
      throw new Error(`停止服务失败: ${this.getErrorMessage(statefulError)}`)
    }
  }

  /**
   * 启动服务（恢复副本数）
   */
  async startService(serviceName: string, namespace: string) {
    const targetNamespace = namespace?.trim() || 'default'

    try {
      const deployment = await this.appsApi.readNamespacedDeployment({ name: serviceName, namespace: targetNamespace })
      const originalReplicas = parseInt(
        deployment.metadata?.annotations?.['xuanwu.io/original-replicas'] || '1'
      )

      const updatedDeployment = {
        ...deployment,
        spec: {
          ...deployment.spec,
          replicas: Number.isInteger(originalReplicas) && originalReplicas > 0 ? originalReplicas : 1
        }
      }

      await this.appsApi.replaceNamespacedDeployment({
        name: serviceName,
        namespace: targetNamespace,
        body: updatedDeployment as k8s.V1Deployment
      })

      return { success: true, message: '服务已启动' }
    } catch (deploymentError: unknown) {
      if (this.getStatusCode(deploymentError) !== 404) {
        console.error('Failed to start service:', deploymentError)
        throw new Error(`启动服务失败: ${this.getErrorMessage(deploymentError)}`)
      }
    }

    try {
      const statefulSet = await this.appsApi.readNamespacedStatefulSet({ name: serviceName, namespace: targetNamespace })
      const annotationValue = statefulSet.metadata?.annotations?.['xuanwu.io/original-replicas'] || '1'
      const parsedAnnotation = Number.parseInt(annotationValue, 10)
      const originalReplicas = Number.isInteger(parsedAnnotation) && parsedAnnotation > 0
        ? parsedAnnotation
        : 1

      const updatedStatefulSet = {
        ...statefulSet,
        spec: {
          ...statefulSet.spec,
          replicas: originalReplicas
        }
      }

      await this.appsApi.replaceNamespacedStatefulSet({
        name: serviceName,
        namespace: targetNamespace,
        body: updatedStatefulSet as k8s.V1StatefulSet
      })

      return { success: true, message: '服务已启动' }
    } catch (statefulError: unknown) {
      console.error('Failed to start service:', statefulError)
      throw new Error(`启动服务失败: ${this.getErrorMessage(statefulError)}`)
    }
  }

  /**
   * 重启服务（重建所有 Pod）
   */
  async restartService(serviceName: string, namespace: string) {
    const targetNamespace = namespace?.trim() || 'default'

    try {
      console.log(`[K8s] 尝试重启服务: ${serviceName}`)

      const deployment = await this.appsApi.readNamespacedDeployment({ name: serviceName, namespace: targetNamespace })

      console.log(`[K8s] 读取到 Deployment: ${serviceName}, 当前副本数: ${deployment.spec?.replicas}`)

      const updatedDeployment = {
        ...deployment,
        spec: {
          ...deployment.spec,
          template: {
            ...deployment.spec?.template,
            metadata: {
              ...deployment.spec?.template?.metadata,
              annotations: {
                ...deployment.spec?.template?.metadata?.annotations,
                'xuanwu.io/restartedAt': new Date().toISOString()
              }
            }
          }
        }
      }

      await this.appsApi.replaceNamespacedDeployment({
        name: serviceName,
        namespace: targetNamespace,
        body: updatedDeployment as k8s.V1Deployment
      })

      console.log(`[K8s] ✅ 服务 ${serviceName} 重启成功`)
      return { success: true, message: '服务正在重启' }
    } catch (deploymentError: unknown) {
      if (this.getStatusCode(deploymentError) !== 404) {
        console.error(`[K8s] ❌ 重启服务失败: ${serviceName}`, deploymentError)

        const rawMessage = this.getErrorMessage(deploymentError)
        let errorMessage = rawMessage

        if (rawMessage.includes('HTTP protocol is not allowed')) {
          errorMessage = 'Kubernetes 配置错误：API Server 地址不可访问。请检查 kubeconfig 中的 server 地址是否正确。'
        } else if (rawMessage.includes('ENOTFOUND') || rawMessage.includes('ECONNREFUSED')) {
          errorMessage = '无法连接到 Kubernetes 集群。请确保集群运行中且网络可访问。'
        } else if (rawMessage.includes('404') || rawMessage.includes('not found')) {
          errorMessage = `服务 "${serviceName}" 在 Kubernetes 集群中不存在。请先部署服务。`
        }

        throw new Error(errorMessage)
      }
    }

    try {
      console.log(`[K8s] 尝试以 StatefulSet 方式重启服务: ${serviceName}`)

      const statefulSet = await this.appsApi.readNamespacedStatefulSet({ name: serviceName, namespace: targetNamespace })

      const updatedStatefulSet = {
        ...statefulSet,
        spec: {
          ...statefulSet.spec,
          template: {
            ...statefulSet.spec?.template,
            metadata: {
              ...statefulSet.spec?.template?.metadata,
              annotations: {
                ...statefulSet.spec?.template?.metadata?.annotations,
                'xuanwu.io/restartedAt': new Date().toISOString()
              }
            }
          }
        }
      }

      await this.appsApi.replaceNamespacedStatefulSet({
        name: serviceName,
        namespace: targetNamespace,
        body: updatedStatefulSet as k8s.V1StatefulSet
      })

      console.log(`[K8s] ✅ StatefulSet 服务 ${serviceName} 重启成功`)
      return { success: true, message: '服务正在重启' }
    } catch (statefulError: unknown) {
      console.error(`[K8s] ❌ StatefulSet 重启服务失败: ${serviceName}`, statefulError)

      const rawMessage = this.getErrorMessage(statefulError)
      let errorMessage = rawMessage

      if (rawMessage.includes('HTTP protocol is not allowed')) {
        errorMessage = 'Kubernetes 配置错误：API Server 地址不可访问。请检查 kubeconfig 中的 server 地址是否正确。'
      } else if (rawMessage.includes('ENOTFOUND') || rawMessage.includes('ECONNREFUSED')) {
        errorMessage = '无法连接到 Kubernetes 集群。请确保集群运行中且网络可访问。'
      } else if (rawMessage.includes('404') || rawMessage.includes('not found')) {
        errorMessage = `服务 "${serviceName}" 在 Kubernetes 集群中不存在。请先部署服务。`
      }

      throw new Error(errorMessage)
    }
  }

  /**
   * 扩缩容服务
   */
  async scaleService(serviceName: string, replicas: number, namespace: string) {
    const targetNamespace = namespace?.trim() || 'default'

    try {
      const deployment = await this.appsApi.readNamespacedDeployment({ name: serviceName, namespace: targetNamespace })

      const updatedDeployment = {
        ...deployment,
        spec: {
          ...deployment.spec,
          replicas
        }
      }

      await this.appsApi.replaceNamespacedDeployment({
        name: serviceName,
        namespace: targetNamespace,
        body: updatedDeployment as k8s.V1Deployment
      })

      return { success: true, message: `服务已扩缩至 ${replicas} 个副本` }
    } catch (deploymentError: unknown) {
      if (this.getStatusCode(deploymentError) !== 404) {
        console.error('Failed to scale service:', deploymentError)
        throw new Error(`扩缩容失败: ${this.getErrorMessage(deploymentError)}`)
      }
    }

    try {
      const statefulSet = await this.appsApi.readNamespacedStatefulSet({ name: serviceName, namespace: targetNamespace })

      const updatedStatefulSet = {
        ...statefulSet,
        spec: {
          ...statefulSet.spec,
          replicas
        }
      }

      await this.appsApi.replaceNamespacedStatefulSet({
        name: serviceName,
        namespace: targetNamespace,
        body: updatedStatefulSet as k8s.V1StatefulSet
      })

      return { success: true, message: `服务已扩缩至 ${replicas} 个副本` }
    } catch (statefulError: unknown) {
      console.error('Failed to scale service:', statefulError)
      throw new Error(`扩缩容失败: ${this.getErrorMessage(statefulError)}`)
    }
  }

  /**
   * 删除服务
   */
  async deleteService(serviceName: string, namespace: string) {
    const targetNamespace = namespace?.trim() || 'default'

    try {
      await this.appsApi.deleteNamespacedDeployment({ name: serviceName, namespace: targetNamespace })
    } catch (error: unknown) {
      if (this.getStatusCode(error) !== 404) {
        console.error('Failed to delete deployment:', error)
        throw new Error(`删除服务失败: ${this.getErrorMessage(error)}`)
      }
    }

    try {
      await this.appsApi.deleteNamespacedStatefulSet({ name: serviceName, namespace: targetNamespace })
    } catch (error: unknown) {
      if (this.getStatusCode(error) !== 404) {
        console.error('Failed to delete statefulset:', error)
        throw new Error(`删除服务失败: ${this.getErrorMessage(error)}`)
      }
    }

    try {
      await this.coreApi.deleteNamespacedService({ name: serviceName, namespace: targetNamespace })
    } catch (error: unknown) {
      if (this.getStatusCode(error) !== 404) {
        console.error('Failed to delete service resource:', error)
        throw new Error(`删除服务失败: ${this.getErrorMessage(error)}`)
      }
    }

    await this.deleteK8sServiceIfExists(this.getHeadlessServiceName(serviceName), targetNamespace)

    return { success: true, message: '服务已删除' }
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus(serviceName: string, namespace: string) {
    const targetNamespace = namespace?.trim() || 'default'

    try {
      // 获取 Deployment 信息
      const deployment = await this.appsApi.readNamespacedDeployment({ name: serviceName, namespace: targetNamespace })
      const replicas = deployment.spec?.replicas || 0
      const availableReplicas = deployment.status?.availableReplicas || 0
      const readyReplicas = deployment.status?.readyReplicas || 0
      const updatedReplicas = deployment.status?.updatedReplicas || 0
      const conditions = deployment.status?.conditions || []

      let status: 'running' | 'pending' | 'stopped' | 'error' = 'pending'

      // 检查是否有失败的 conditions
      const hasFailedCondition = conditions.some((condition: any) => {
        const type = condition.type?.toString() || ''
        const status = condition.status?.toString() || ''
        const reason = condition.reason?.toString() || ''
        
        // 检查关键错误条件
        if (type === 'Progressing' && status === 'False') {
          return true
        }
        if (type === 'Available' && status === 'False' && replicas > 0) {
          return true
        }
        if (type === 'ReplicaFailure' && status === 'True') {
          return true
        }
        if (reason === 'ProgressDeadlineExceeded') {
          return true
        }
        
        return false
      })

      // 获取 Pod 信息以检查镜像拉取状态
      let podStatusInfo: { imagePullFailed?: boolean; imagePullError?: string; containerStatuses?: any[] } | null = null
      try {
        const pods = await this.coreApi.listNamespacedPod({
          namespace: targetNamespace,
          labelSelector: `app=${serviceName}`
        })

        // 检查 Pod 中的容器状态（只取第一个 Pod 的主容器状态，避免重复显示）
        const containerStatuses: any[] = []
        let imagePullFailed = false
        let imagePullError = ''
        
        // 只取第一个 Pod 的容器状态用于显示
        const firstPod = pods.items[0]
        if (firstPod) {
          const podContainerStatuses = firstPod.status?.containerStatuses || []
          console.log(`[K8s][Deployment] Service ${serviceName} has ${podContainerStatuses.length} containers:`, 
            podContainerStatuses.map((c: any) => c.name))
          
          // 过滤掉调试工具容器和其他辅助容器，只保留主应用容器
          const mainContainers = podContainerStatuses.filter((status: any) => {
            const name = status.name || ''
            // 排除常见的 sidecar 和辅助容器
            return !name.includes('debug-tools') && 
                   !name.includes('sidecar') && 
                   !name.includes('proxy') &&
                   !name.includes('exporter') &&
                   !name.includes('agent')
          })
          
          // 如果过滤后没有容器，则显示所有容器
          const containersToShow = mainContainers.length > 0 ? mainContainers : podContainerStatuses
          containerStatuses.push(...containersToShow)
        }
        
        // 检查所有 Pod 是否有镜像拉取失败
        for (const pod of pods.items) {
          const podContainerStatuses = pod.status?.containerStatuses || []
          
          // 检查是否有镜像拉取失败
          for (const containerStatus of podContainerStatuses) {
            const waitingState = containerStatus.state?.waiting
            if (waitingState) {
              const reason = waitingState.reason || ''
              if (reason === 'ErrImagePull' || reason === 'ImagePullBackOff') {
                imagePullFailed = true
                imagePullError = waitingState.message || `镜像拉取失败: ${reason}`
                break
              }
            }
            
            const terminatedState = containerStatus.state?.terminated
            if (terminatedState) {
              const reason = terminatedState.reason || ''
              if (reason === 'ErrImagePull') {
                imagePullFailed = true
                imagePullError = terminatedState.message || `镜像拉取失败: ${reason}`
                break
              }
            }
          }
          
          if (imagePullFailed) break
        }
        
        podStatusInfo = {
          imagePullFailed,
          imagePullError: imagePullError || undefined,
          containerStatuses
        }
      } catch (podError) {
        console.warn('Failed to get pod status:', podError)
      }

      // 根据 Pod 状态和 Deployment 条件确定最终状态
      if (replicas === 0) {
        status = 'stopped'
      } else if (podStatusInfo?.imagePullFailed) {
        // 镜像拉取失败，标记为 error
        status = 'error'
      } else if (hasFailedCondition) {
        // 如果有失败条件，标记为 error
        status = 'error'
      } else if (availableReplicas === replicas && readyReplicas === replicas) {
        status = 'running'
      } else if (availableReplicas === 0 && readyReplicas === 0) {
        status = 'error'
      } else {
        // 部分就绪，可能正在滚动更新或启动中
        status = 'pending'
      }

      return {
        status,
        replicas,
        availableReplicas,
        readyReplicas,
        updatedReplicas,
        conditions,
        podStatus: podStatusInfo
      }
    } catch (deploymentError: unknown) {
      if (this.getStatusCode(deploymentError) !== 404) {
        return { status: 'error' as const, error: this.getErrorMessage(deploymentError) }
      }
    }

    try {
      const statefulSet = await this.appsApi.readNamespacedStatefulSet({ name: serviceName, namespace: targetNamespace })
      const replicas = statefulSet.spec?.replicas || 0
      const readyReplicas = statefulSet.status?.readyReplicas || 0
      const currentReplicas = statefulSet.status?.currentReplicas || readyReplicas
      const updatedReplicas = statefulSet.status?.updatedReplicas || readyReplicas
      const conditions = statefulSet.status?.conditions || []

      let status: 'running' | 'pending' | 'stopped' | 'error' = 'pending'

      // 检查 StatefulSet 的失败条件
      const hasFailedCondition = conditions.some((condition: any) => {
        const type = condition.type?.toString() || ''
        const status = condition.status?.toString() || ''
        
        if (type === 'Available' && status === 'False' && replicas > 0) {
          return true
        }
        
        return false
      })

      // 获取 Pod 信息以检查镜像拉取状态
      let podStatusInfo: { imagePullFailed?: boolean; imagePullError?: string; containerStatuses?: any[] } | null = null
      try {
        const pods = await this.coreApi.listNamespacedPod({
          namespace: targetNamespace,
          labelSelector: `app=${serviceName}`
        })

        // 检查 Pod 中的容器状态（只取第一个 Pod 的主容器状态，避免重复显示）
        const containerStatuses: any[] = []
        let imagePullFailed = false
        let imagePullError = ''
        
        // 只取第一个 Pod 的容器状态用于显示
        const firstPod = pods.items[0]
        if (firstPod) {
          const podContainerStatuses = firstPod.status?.containerStatuses || []
          console.log(`[K8s][StatefulSet] Service ${serviceName} has ${podContainerStatuses.length} containers:`, 
            podContainerStatuses.map((c: any) => c.name))
          
          // 过滤掉调试工具容器和其他辅助容器，只保留主应用容器
          const mainContainers = podContainerStatuses.filter((status: any) => {
            const name = status.name || ''
            // 排除常见的 sidecar 和辅助容器
            return !name.includes('debug-tools') && 
                   !name.includes('sidecar') && 
                   !name.includes('proxy') &&
                   !name.includes('exporter') &&
                   !name.includes('agent')
          })
          
          // 如果过滤后没有容器，则显示所有容器
          const containersToShow = mainContainers.length > 0 ? mainContainers : podContainerStatuses
          containerStatuses.push(...containersToShow)
        }
        
        // 检查所有 Pod 是否有镜像拉取失败
        for (const pod of pods.items) {
          const podContainerStatuses = pod.status?.containerStatuses || []
          
          // 检查是否有镜像拉取失败
          for (const containerStatus of podContainerStatuses) {
            const waitingState = containerStatus.state?.waiting
            if (waitingState) {
              const reason = waitingState.reason || ''
              if (reason === 'ErrImagePull' || reason === 'ImagePullBackOff') {
                imagePullFailed = true
                imagePullError = waitingState.message || `镜像拉取失败: ${reason}`
                break
              }
            }
            
            const terminatedState = containerStatus.state?.terminated
            if (terminatedState) {
              const reason = terminatedState.reason || ''
              if (reason === 'ErrImagePull') {
                imagePullFailed = true
                imagePullError = terminatedState.message || `镜像拉取失败: ${reason}`
                break
              }
            }
          }
          
          if (imagePullFailed) break
        }
        
        podStatusInfo = {
          imagePullFailed,
          imagePullError: imagePullError || undefined,
          containerStatuses
        }
      } catch (podError) {
        console.warn('Failed to get pod status:', podError)
      }

      // 根据 Pod 状态和 StatefulSet 条件确定最终状态
      if (replicas === 0) {
        status = 'stopped'
      } else if (podStatusInfo?.imagePullFailed) {
        // 镜像拉取失败，标记为 error
        status = 'error'
      } else if (hasFailedCondition) {
        status = 'error'
      } else if (readyReplicas === replicas && currentReplicas === replicas) {
        status = 'running'
      } else if (readyReplicas === 0 && currentReplicas === 0) {
        status = 'error'
      } else {
        status = 'pending'
      }

      return {
        status,
        replicas,
        availableReplicas: currentReplicas,
        readyReplicas,
        updatedReplicas,
        conditions,
        podStatus: podStatusInfo
      }
    } catch (statefulError: unknown) {
      if (this.getStatusCode(statefulError) === 404) {
        return { status: 'error' as const, error: '服务不存在' }
      }
      return { status: 'error' as const, error: this.getErrorMessage(statefulError) }
    }
  }

  /**
   * 获取服务的 CPU 和内存使用指标
   * 依赖 Kubernetes Metrics Server
   */
  async getServiceMetrics(serviceName: string, namespace: string) {
    const targetNamespace = namespace?.trim() || 'default'

    try {
      // Step 1: 获取服务的 Pod 列表
      const pods = await this.coreApi.listNamespacedPod({
        namespace: targetNamespace,
        labelSelector: `app=${serviceName}`
      })

      if (!pods.items.length) {
        console.warn(`[K8s][Metrics] 未找到 Pod: namespace=${targetNamespace}, app=${serviceName}`)
        return null
      }

      // Step 2: 找到第一个 Running 状态的 Pod
      const runningPod = pods.items.find((p) => p.status?.phase === 'Running')
      if (!runningPod) {
        console.warn(`[K8s][Metrics] 未找到 Running 状态的 Pod: namespace=${targetNamespace}, app=${serviceName}`)
        return null
      }

      const podName = runningPod.metadata?.name
      if (!podName) {
        console.warn(`[K8s][Metrics] Pod 名称缺失`)
        return null
      }

      console.log(`[K8s][Metrics] 正在获取 Pod metrics: ${podName}`)

      // Step 3: 使用 Kubernetes API 调用 Metrics
      const metricsPath = `/apis/metrics.k8s.io/v1beta1/namespaces/${targetNamespace}/pods/${podName}`
      
      // 使用 makeApiRequest 方法（更安全的方式）
      const cluster = this.kc.getCurrentCluster()
      if (!cluster) {
        console.warn('[K8s][Metrics] 无法获取当前集群信息')
        return null
      }

      const opts: https.RequestOptions = {
        method: 'GET',
        path: metricsPath
      }

      // 应用认证配置
      await this.kc.applyToHTTPSOptions(opts)

      const url = new URL(cluster.server)
      opts.hostname = url.hostname
      opts.port = url.port || '443'

      // 使用 Promise 包装 https.request
      const data = await new Promise<any>((resolve, reject) => {
        const req = https.request(opts, (res) => {
          let body = ''
          res.on('data', (chunk) => {
            body += chunk
          })
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(JSON.parse(body))
              } catch (err) {
                reject(new Error(`解析 JSON 失败: ${err}`))
              }
            } else {
              // 特殊处理 404 错误（Metrics Server 未安装）
              if (res.statusCode === 404) {
                reject(new Error('Metrics Server 未安装或不可用'))
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${body}`))
              }
            }
          })
        })

        req.on('error', (err) => {
          reject(err)
        })

        req.end()
      })

      if (!data || !data.containers?.length) {
        console.warn('[K8s][Metrics] Metrics API 返回数据为空或无容器数据')
        return null
      }

      // Step 4: 聚合所有容器的 metrics（使用第一个主容器）
      const container = data.containers[0]
      const cpuUsed = container.usage?.cpu || '0'
      const memoryUsed = container.usage?.memory || '0'

      // Step 5: 从 Pod spec 中获取资源限制
      const mainContainer = runningPod.spec?.containers?.[0]
      const cpuLimit = mainContainer?.resources?.limits?.cpu
      const memoryLimit = mainContainer?.resources?.limits?.memory

      // Step 6: 计算百分比
      const cpuUsagePercent = cpuLimit ? this.calculateCpuPercent(cpuUsed, cpuLimit) : undefined
      const memoryUsagePercent = memoryLimit ? this.calculateMemoryPercent(memoryUsed, memoryLimit) : undefined

      console.log(`[K8s][Metrics] ✅ 成功获取 metrics: CPU=${cpuUsed}, Memory=${memoryUsed}`)

      return {
        cpu: {
          used: cpuUsed,
          limit: cpuLimit,
          usagePercent: cpuUsagePercent
        },
        memory: {
          used: memoryUsed,
          limit: memoryLimit,
          usagePercent: memoryUsagePercent
        },
        timestamp: new Date().toISOString()
      }
    } catch (error: any) {
      // Metrics Server 未安装或 Pod 无 metrics，静默失败
      const errorMessage = error.message || '未知错误'
      if (errorMessage.includes('Metrics Server')) {
        console.warn(`[K8s][Metrics] ⚠️  ${errorMessage}`)
      } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        console.warn(`[K8s][Metrics] ⚠️  Metrics API 不可用 (404)`)
      } else {
        console.warn(`[K8s][Metrics] ⚠️  获取失败: ${errorMessage}`)
      }
      return null
    }
  }

  /**
   * 计算 CPU 使用百分比
   */
  private calculateCpuPercent(used: string, limit: string): number {
    const usedMillicores = this.parseCpuToMillicores(used)
    const limitMillicores = this.parseCpuToMillicores(limit)
    return limitMillicores > 0 ? Math.round((usedMillicores / limitMillicores) * 100 * 10) / 10 : 0
  }

  /**
   * 计算内存使用百分比
   */
  private calculateMemoryPercent(used: string, limit: string): number {
    const usedBytes = this.parseMemoryToBytes(used)
    const limitBytes = this.parseMemoryToBytes(limit)
    return limitBytes > 0 ? Math.round((usedBytes / limitBytes) * 100 * 10) / 10 : 0
  }

  /**
   * 解析 CPU 字符串为 millicores
   * 例如："250m" -> 250, "1" -> 1000
   */
  private parseCpuToMillicores(cpu: string): number {
    if (!cpu) return 0
    if (cpu.endsWith('m')) {
      return parseInt(cpu.slice(0, -1), 10) || 0
    }
    return (parseFloat(cpu) || 0) * 1000
  }

  /**
   * 解析内存字符串为 bytes
   * 例如："512Mi" -> bytes, "1Gi" -> bytes
   */
  private parseMemoryToBytes(memory: string): number {
    if (!memory) return 0

    const units: Record<string, number> = {
      Ki: 1024,
      Mi: 1024 * 1024,
      Gi: 1024 * 1024 * 1024,
      Ti: 1024 * 1024 * 1024 * 1024,
      K: 1000,
      M: 1000 * 1000,
      G: 1000 * 1000 * 1000,
      T: 1000 * 1000 * 1000 * 1000
    }

    for (const [suffix, multiplier] of Object.entries(units)) {
      if (memory.endsWith(suffix)) {
        return (parseFloat(memory.slice(0, -suffix.length)) || 0) * multiplier
      }
    }

    // 如果没有单位，假设为 bytes
    return parseFloat(memory) || 0
  }

  /**
   * 列出命名空间下的 Deployments（简化对象）
   */
  async listNamespaceDeployments(namespace: string) {
    const targetNamespace = namespace?.trim() || 'default'
    const result = await this.appsApi.listNamespacedDeployment({ namespace: targetNamespace })
    // 仅返回必要字段，减少传输与内存
    return (result.items || []).map((d) => ({
      metadata: { name: d.metadata?.name },
      spec: { replicas: d.spec?.replicas },
      status: {
        availableReplicas: d.status?.availableReplicas,
        readyReplicas: d.status?.readyReplicas,
        updatedReplicas: d.status?.updatedReplicas,
        conditions: d.status?.conditions || []
      }
    }))
  }

  /**
   * 列出命名空间下的 StatefulSets（简化对象）
   */
  async listNamespaceStatefulSets(namespace: string) {
    const targetNamespace = namespace?.trim() || 'default'
    const result = await this.appsApi.listNamespacedStatefulSet({ namespace: targetNamespace })
    return (result.items || []).map((s) => ({
      metadata: { name: s.metadata?.name },
      spec: { replicas: s.spec?.replicas },
      status: {
        readyReplicas: s.status?.readyReplicas,
        currentReplicas: s.status?.currentReplicas,
        updatedReplicas: s.status?.updatedReplicas,
        conditions: s.status?.conditions || []
      }
    }))
  }

  /**
   * 列出命名空间下的 Pods（简化对象）
   */
  async listNamespacePods(namespace: string) {
    const targetNamespace = namespace?.trim() || 'default'
    const result = await this.coreApi.listNamespacedPod({ namespace: targetNamespace })
    return (result.items || []).map((p) => ({
      metadata: {
        name: p.metadata?.name,
        labels: p.metadata?.labels || {}
      },
      status: {
        containerStatuses: p.status?.containerStatuses || []
      }
    }))
  }

  /**
   * 执行命令
   */
  async execCommand(serviceName: string, namespace: string, command: string) {
    const targetNamespace = namespace?.trim() || 'default'

    try {
      const podInfo = await this.getPrimaryPodInfo(serviceName, targetNamespace)
      
      // 执行命令
      const result = await this.execInPod(
        podInfo.namespace,
        podInfo.podName,
        podInfo.containerName,
        ['sh', '-c', command]
      )

      return {
        stdout: result.stdout.toString('utf8'),
        stderr: result.stderr.toString('utf8'),
        exitCode: result.exitCode || 0
      }
    } catch (error: unknown) {
      console.error('Failed to exec command:', error)
      throw new Error(`命令执行失败: ${this.getErrorMessage(error)}`)
    }
  }

  /**
   * 获取服务日志
   */
  async getServiceLogs(serviceName: string, lines: number = 100, namespace: string = 'default') {
    const targetNamespace = namespace?.trim() || 'default'

    try {
      await this.ensureNamespaceAccess(targetNamespace)

      const pods = await this.coreApi.listNamespacedPod({
        namespace: targetNamespace,
        labelSelector: `app=${serviceName}`
      })

      if (pods.items.length === 0) {
        return { logs: '', error: '未找到运行的 Pod' }
      }

      const podName = pods.items[0].metadata?.name
      if (!podName) {
        return { logs: '', error: 'Pod 名称无效' }
      }

      const logs = await this.coreApi.readNamespacedPodLog({
        name: podName,
        namespace: targetNamespace,
        tailLines: lines
      })

      return { logs }
    } catch (error: unknown) {
      console.error('Failed to get service logs:', error)
      return { logs: '', error: this.getErrorMessage(error) }
    }
  }


  /**
   * 获取服务事件（包括 Deployment、ReplicaSet 和 Pod 事件）
   */
  async getServiceEvents(serviceName: string, namespace: string = 'default', limit: number = 50) {
    const targetNamespace = namespace?.trim() || 'default'

    try {
      await this.ensureNamespaceAccess(targetNamespace)

      console.log(`[K8s] 获取服务事件: service=${serviceName}, namespace=${targetNamespace}`)

      // 获取所有事件
      const events = await this.coreApi.listNamespacedEvent({
        namespace: targetNamespace
      })

      console.log(`[K8s] 命名空间 ${targetNamespace} 共有 ${events.items.length} 条事件`)

      // 筛选与服务相关的事件（Deployment、ReplicaSet、Pod）
      const relevantEvents = events.items.filter(event => {
        const involvedName = event.involvedObject?.name || ''
        const involvedKind = event.involvedObject?.kind || ''
        
        // 直接匹配服务名（Deployment/Service）
        if (involvedName === serviceName) {
          return true
        }
        
        // 匹配 Pod（格式：serviceName-xxx-yyy）
        if (involvedKind === 'Pod' && involvedName.startsWith(`${serviceName}-`)) {
          return true
        }
        
        // 匹配 ReplicaSet（格式：serviceName-xxx）
        if (involvedKind === 'ReplicaSet' && involvedName.startsWith(`${serviceName}-`)) {
          return true
        }
        
        return false
      })

      console.log(`[K8s] 筛选后剩余 ${relevantEvents.length} 条相关事件`)

      // 按时间倒序排序
      const sortedEvents = relevantEvents.sort((a, b) => {
        const timeA = a.lastTimestamp || a.firstTimestamp
        const timeB = b.lastTimestamp || b.firstTimestamp
        
        if (!timeA && !timeB) return 0
        if (!timeA) return 1
        if (!timeB) return -1
        
        const dateA = new Date(timeA).getTime()
        const dateB = new Date(timeB).getTime()
        
        return dateB - dateA
      })

      // 限制返回数量
      const limitedEvents = sortedEvents.slice(0, limit)

      return {
        events: limitedEvents.map(event => ({
          type: event.type || 'Normal',
          reason: event.reason || '',
          message: event.message || '',
          timestamp: event.lastTimestamp || event.firstTimestamp,
          count: event.count || 1,
          involvedObject: {
            kind: event.involvedObject?.kind || '',
            name: event.involvedObject?.name || ''
          }
        }))
      }
    } catch (error: unknown) {
      console.error('Failed to get service events:', error)
      return { events: [], error: this.getErrorMessage(error) }
    }
  }

  /**
   * 生成服务的 Kubernetes YAML 配置
   */
  generateServiceYAML(service: Service, namespace: string = 'default'): string {
    const targetNamespace = namespace?.trim() || 'default'

    // 获取replicas值
    let replicas = 1
    if (service.type === ServiceType.APPLICATION || service.type === ServiceType.IMAGE) {
      replicas = (service as ApplicationService | ImageService).replicas || 1
    }

    const normalizedNetwork = this.normalizeNetworkConfig(service.network_config)
    
    // 为 Redis 自动注入密码命令
    let effectiveCommand: string | undefined
    if (service.type === ServiceType.DATABASE) {
      const dbService = service as DatabaseService
      effectiveCommand = (dbService as DatabaseService & { command?: string }).command
      if (dbService.database_type === 'redis' && dbService.password && !effectiveCommand) {
        effectiveCommand = `redis-server --requirepass ${dbService.password}`
      }
    } else {
      effectiveCommand = (service as ApplicationService | ImageService).command
    }
    
    const commandConfig = this.parseCommand(effectiveCommand)

    // 构建 Deployment 对象
    const deployment: k8s.V1Deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: service.name,
        namespace: targetNamespace,
        labels: { 
          app: service.name,
          'managed-by': 'xuanwu-platform'
        }
      },
      spec: {
        replicas,
        selector: {
          matchLabels: { app: service.name }
        },
        template: {
          metadata: {
            labels: { app: service.name }
          },
          spec: {
            containers: [{
              name: service.name,
              image: this.getImage(service),
              ...(commandConfig.command && { command: commandConfig.command }),
              ...(commandConfig.args && { args: commandConfig.args }),
              ports: normalizedNetwork
                ? normalizedNetwork.ports.map((port, index) => ({
                    containerPort: port.containerPort,
                    protocol: port.protocol,
                    name: `port-${port.containerPort}-${index}`
                  }))
                : undefined,
              env: this.buildEnvVars(service),
              resources: this.buildResources(service.resource_limits, service.resource_requests),
              volumeMounts: this.buildVolumeMounts(service.volumes, service.name)
            }],
            volumes: this.buildVolumes(service.volumes)
          }
        }
      }
    }

    const yamlDocs: string[] = []

    // 添加 Deployment YAML
    yamlDocs.push(yaml.dump(deployment, { indent: 2, lineWidth: -1 }))

    // 如果有网络配置，添加 Service YAML
    if (normalizedNetwork) {
      const k8sService: k8s.V1Service = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: service.name,
          namespace: targetNamespace,
          labels: { 
            app: service.name,
            'managed-by': 'xuanwu-platform'
          }
        },
        spec: {
          selector: { app: service.name },
          type: normalizedNetwork.serviceType,
          ports: normalizedNetwork.ports.map((port, index) => ({
            name: `port-${index}`,
            port: port.servicePort,
            targetPort: port.containerPort,
            protocol: port.protocol,
            ...(port.nodePort && { nodePort: port.nodePort })
          }))
        }
      }

      yamlDocs.push(yaml.dump(k8sService, { indent: 2, lineWidth: -1 }))

      const ingressRules = this.getIngressRules(normalizedNetwork)

      if (ingressRules.length) {
        const ingress: k8s.V1Ingress = {
          apiVersion: 'networking.k8s.io/v1',
          kind: 'Ingress',
          metadata: {
            name: `${service.name}-ingress`,
            namespace: targetNamespace,
            labels: {
              app: service.name,
              'managed-by': 'xuanwu-platform'
            }
          },
          spec: {
            rules: ingressRules.map(({ host, servicePort }) => ({
              host,
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: {
                        name: service.name,
                        port: { number: servicePort }
                      }
                    }
                  }
                ]
              }
            }))
          }
        }

        yamlDocs.push(yaml.dump(ingress, { indent: 2, lineWidth: -1 }))
      }
    }

    // 使用 --- 分隔符连接多个 YAML 文档
    return yamlDocs.join('\n---\n\n')
  }

  private async ensureNamespace(namespace: string): Promise<void> {
    const normalized = namespace.trim()

    if (!normalized || normalized === 'default') {
      return
    }

    console.log(`[K8s] Ensuring namespace ${normalized} exists...`)

    let namespaceReady = false

    try {
      await this.coreApi.readNamespace({ name: normalized })
      console.log(`[K8s] ✅ Namespace ${normalized} already exists`)
      namespaceReady = true
    } catch (error: unknown) {
      const statusCode = this.getStatusCode(error)
      console.log(`[K8s] Read namespace error - Status Code: ${statusCode}, Error:`, error)

      if (statusCode === 404) {
        console.log(`[K8s] Namespace ${normalized} not found, creating...`)

        const body: k8s.V1Namespace = {
          metadata: {
            name: normalized,
            labels: {
              'managed-by': 'xuanwu-platform'
            }
          }
        }

        try {
          await this.coreApi.createNamespace({ body })
          console.log(`[K8s] ✅ Successfully created namespace ${normalized}`)

          // 验证 namespace 是否真的创建成功
          await this.coreApi.readNamespace({ name: normalized })
          console.log(`[K8s] ✅ Verified namespace ${normalized} is accessible`)
          namespaceReady = true
        } catch (createError: unknown) {
          const statusCode = this.getStatusCode(createError)
          if (statusCode === 409) {
            console.log(`[K8s] Namespace ${normalized} already exists (concurrent creation)`)
            // 即使 409，也要验证一下是否真的存在
            try {
              await this.coreApi.readNamespace({ name: normalized })
              console.log(`[K8s] ✅ Verified namespace ${normalized} exists after 409`)
              namespaceReady = true
            } catch (verifyError: unknown) {
              console.error(`[K8s] ❌ Namespace ${normalized} returned 409 but still not accessible:`, verifyError)
              throw verifyError
            }
          } else {
            console.error(`[K8s] ❌ Failed to create namespace ${normalized}:`, createError)
            throw createError
          }
        }
      } else if (statusCode === 403 || statusCode === 401) {
        console.warn(
          `[K8s] ⚠️ Insufficient permissions to verify namespace ${normalized}. Assuming it exists.`
        )
        namespaceReady = true
      } else {
        console.error(`[K8s] ❌ Error reading namespace ${normalized}:`, error)
        throw error
      }
    }

    if (!namespaceReady) {
      return
    }

    await this.ensureNamespaceAccess(normalized)
  }

  // 公开以供文件管理服务使用
  async ensureNamespaceAccess(namespace: string): Promise<void> {
    const normalized = namespace.trim()

    if (!normalized || normalized === 'default') {
      return
    }

    if (this.namespaceAccessCache.has(normalized)) {
      return
    }

    const serviceAccount = this.getServiceAccountIdentity()
    if (!serviceAccount) {
      console.warn(
        `[K8s] ⚠️ Skipping RBAC setup for namespace ${normalized}: unable to determine service account identity`
      )
      this.namespaceAccessCache.add(normalized)
      return
    }

    await this.ensureClusterAccess(serviceAccount)

    const { roleName, roleBindingName } = this.buildNamespaceRoleNames(serviceAccount)

    const desiredRole: k8s.V1Role = {
      metadata: {
        name: roleName,
        namespace: normalized,
        labels: {
          'managed-by': 'xuanwu-platform'
        }
      },
      rules: this.buildNamespaceRoleRules()
    }

    const roleEnsured = await this.ensureNamespaceRole(normalized, desiredRole)
    if (!roleEnsured) {
      return
    }

    const roleBindingEnsured = await this.ensureNamespaceRoleBinding(
      normalized,
      roleBindingName,
      roleName,
      serviceAccount
    )

    if (roleBindingEnsured) {
      this.namespaceAccessCache.add(normalized)
    }
  }

  private async ensureClusterAccess(serviceAccount: { namespace: string; name: string }): Promise<void> {
    const cacheKey = `${serviceAccount.namespace}/${serviceAccount.name}`

    if (this.clusterAccessCache.has(cacheKey)) {
      return
    }

    const { clusterRoleName, clusterRoleBindingName } = this.buildClusterRoleNames(serviceAccount)

    const desiredClusterRole: k8s.V1ClusterRole = {
      metadata: {
        name: clusterRoleName,
        labels: {
          'managed-by': 'xuanwu-platform'
        }
      },
      rules: this.buildNamespaceRoleRules()
    }

    const roleEnsured = await this.ensureClusterRole(desiredClusterRole)
    if (!roleEnsured) {
      return
    }

    const bindingEnsured = await this.ensureClusterRoleBinding(
      clusterRoleBindingName,
      clusterRoleName,
      serviceAccount
    )

    if (bindingEnsured) {
      this.clusterAccessCache.add(cacheKey)
    }
  }

  private async ensureNamespaceRole(namespace: string, desiredRole: k8s.V1Role): Promise<boolean> {
    const roleName = desiredRole.metadata?.name
    if (!roleName) {
      console.warn('[K8s] ⚠️ Missing role name when ensuring namespace access')
      return false
    }

    try {
      await this.rbacApi.createNamespacedRole({ namespace, body: desiredRole })
      console.log(`[K8s] ✅ Created Role ${roleName} in namespace ${namespace}`)
      return true
    } catch (error: unknown) {
      const statusCode = this.getStatusCode(error)
      if (statusCode === 409) {
        try {
          const existingRole = await this.rbacApi.readNamespacedRole({ name: roleName, namespace })
          if (!this.arePolicyRulesEqual(existingRole.rules, desiredRole.rules)) {
            const resourceVersion = existingRole.metadata?.resourceVersion
            if (!resourceVersion) {
              console.warn(
                `[K8s] ⚠️ Unable to update Role ${roleName} in namespace ${namespace}: missing resourceVersion`
              )
              return true
            }

            const updatedRole: k8s.V1Role = {
              ...desiredRole,
              metadata: {
                ...desiredRole.metadata,
                resourceVersion
              }
            }

            await this.rbacApi.replaceNamespacedRole({
              name: roleName,
              namespace,
              body: updatedRole
            })

            console.log(`[K8s] 🔄 Updated Role ${roleName} in namespace ${namespace}`)
          }

          return true
        } catch (readError: unknown) {
          console.error(
            `[K8s] ❌ Failed to reconcile Role ${roleName} in namespace ${namespace}:`,
            this.getErrorMessage(readError)
          )
          return false
        }
      }

      console.error(
        `[K8s] ❌ Failed to ensure Role ${roleName} in namespace ${namespace}:`,
        this.getErrorMessage(error)
      )
      return false
    }
  }

  private async ensureClusterRole(desiredRole: k8s.V1ClusterRole): Promise<boolean> {
    const roleName = desiredRole.metadata?.name
    if (!roleName) {
      console.warn('[K8s] ⚠️ Missing cluster role name when ensuring cluster access')
      return false
    }

    try {
      await this.rbacApi.createClusterRole({ body: desiredRole })
      console.log(`[K8s] ✅ Created ClusterRole ${roleName}`)
      return true
    } catch (error: unknown) {
      const statusCode = this.getStatusCode(error)
      if (statusCode === 409) {
        try {
          const existingRole = await this.rbacApi.readClusterRole({ name: roleName })
          if (!this.arePolicyRulesEqual(existingRole.rules, desiredRole.rules)) {
            const resourceVersion = existingRole.metadata?.resourceVersion
            if (!resourceVersion) {
              console.warn(
                `[K8s] ⚠️ Unable to update ClusterRole ${roleName}: missing resourceVersion`
              )
              return true
            }

            const updatedRole: k8s.V1ClusterRole = {
              ...desiredRole,
              metadata: {
                ...desiredRole.metadata,
                resourceVersion
              }
            }

            await this.rbacApi.replaceClusterRole({
              name: roleName,
              body: updatedRole
            })

            console.log(`[K8s] 🔄 Updated ClusterRole ${roleName}`)
          }

          return true
        } catch (readError: unknown) {
          console.error(
            `[K8s] ❌ Failed to reconcile ClusterRole ${roleName}:`,
            this.getErrorMessage(readError)
          )
          return false
        }
      }

      if (statusCode === 403) {
        console.warn(
          `[K8s] ⚠️ Insufficient permissions to ensure ClusterRole ${roleName}: ${this.getErrorMessage(error)}`
        )
      } else {
        console.error(
          `[K8s] ❌ Failed to ensure ClusterRole ${roleName}:`,
          this.getErrorMessage(error)
        )
      }
      return false
    }
  }

  private async ensureNamespaceRoleBinding(
    namespace: string,
    roleBindingName: string,
    roleName: string,
    serviceAccount: { namespace: string; name: string }
  ): Promise<boolean> {
    const desiredBinding: k8s.V1RoleBinding = {
      metadata: {
        name: roleBindingName,
        namespace,
        labels: {
          'managed-by': 'xuanwu-platform'
        }
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: roleName
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: serviceAccount.name,
          namespace: serviceAccount.namespace
        }
      ]
    }

    try {
      await this.rbacApi.createNamespacedRoleBinding({ namespace, body: desiredBinding })
      console.log(`[K8s] ✅ Created RoleBinding ${roleBindingName} in namespace ${namespace}`)
      return true
    } catch (error: unknown) {
      const statusCode = this.getStatusCode(error)
      if (statusCode === 409) {
        try {
          const existingBinding = await this.rbacApi.readNamespacedRoleBinding({ name: roleBindingName, namespace })

          const existingSubjects = existingBinding.subjects ?? []
          const hasSubject = existingSubjects.some(
            (subject) =>
              subject.kind === 'ServiceAccount' &&
              subject.name === serviceAccount.name &&
              subject.namespace === serviceAccount.namespace
          )

          const roleRefMatches =
            existingBinding.roleRef?.apiGroup === 'rbac.authorization.k8s.io' &&
            existingBinding.roleRef?.kind === 'Role' &&
            existingBinding.roleRef?.name === roleName

          if (hasSubject && roleRefMatches) {
            return true
          }

          const resourceVersion = existingBinding.metadata?.resourceVersion
          if (!resourceVersion) {
            console.warn(
              `[K8s] ⚠️ Unable to update RoleBinding ${roleBindingName} in namespace ${namespace}: missing resourceVersion`
            )
            return false
          }

          const updatedSubjects = hasSubject
            ? existingSubjects
            : [
                ...existingSubjects,
                {
                  kind: 'ServiceAccount',
                  name: serviceAccount.name,
                  namespace: serviceAccount.namespace
                }
              ]

          const updatedBinding: k8s.V1RoleBinding = {
            metadata: {
              ...existingBinding.metadata,
              name: roleBindingName,
              namespace,
              labels: {
                ...(existingBinding.metadata?.labels ?? {}),
                'managed-by': 'xuanwu-platform'
              },
              resourceVersion
            },
            roleRef: {
              apiGroup: 'rbac.authorization.k8s.io',
              kind: 'Role',
              name: roleName
            },
            subjects: updatedSubjects
          }

          await this.rbacApi.replaceNamespacedRoleBinding({
            name: roleBindingName,
            namespace,
            body: updatedBinding
          })

          console.log(`[K8s] 🔄 Updated RoleBinding ${roleBindingName} in namespace ${namespace}`)
          return true
        } catch (readError: unknown) {
          console.error(
            `[K8s] ❌ Failed to reconcile RoleBinding ${roleBindingName} in namespace ${namespace}:`,
            this.getErrorMessage(readError)
          )
          return false
        }
      }

      console.error(
        `[K8s] ❌ Failed to ensure RoleBinding ${roleBindingName} in namespace ${namespace}:`,
        this.getErrorMessage(error)
      )
      return false
    }
  }

  private async ensureClusterRoleBinding(
    bindingName: string,
    roleName: string,
    serviceAccount: { namespace: string; name: string }
  ): Promise<boolean> {
    const desiredBinding: k8s.V1ClusterRoleBinding = {
      metadata: {
        name: bindingName,
        labels: {
          'managed-by': 'xuanwu-platform'
        }
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: roleName
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: serviceAccount.name,
          namespace: serviceAccount.namespace
        }
      ]
    }

    try {
      await this.rbacApi.createClusterRoleBinding({ body: desiredBinding })
      console.log(`[K8s] ✅ Created ClusterRoleBinding ${bindingName}`)
      return true
    } catch (error: unknown) {
      const statusCode = this.getStatusCode(error)
      if (statusCode === 409) {
        try {
          const existingBinding = await this.rbacApi.readClusterRoleBinding({ name: bindingName })

          const existingSubjects = existingBinding.subjects ?? []
          const hasSubject = existingSubjects.some(
            (subject) =>
              subject.kind === 'ServiceAccount' &&
              subject.name === serviceAccount.name &&
              subject.namespace === serviceAccount.namespace
          )

          const roleRefMatches =
            existingBinding.roleRef?.apiGroup === 'rbac.authorization.k8s.io' &&
            existingBinding.roleRef?.kind === 'ClusterRole' &&
            existingBinding.roleRef?.name === roleName

          if (hasSubject && roleRefMatches) {
            return true
          }

          const resourceVersion = existingBinding.metadata?.resourceVersion
          if (!resourceVersion) {
            console.warn(
              `[K8s] ⚠️ Unable to update ClusterRoleBinding ${bindingName}: missing resourceVersion`
            )
            return false
          }

          const updatedSubjects = hasSubject
            ? existingSubjects
            : [
                ...existingSubjects,
                {
                  kind: 'ServiceAccount',
                  name: serviceAccount.name,
                  namespace: serviceAccount.namespace
                }
              ]

          const updatedBinding: k8s.V1ClusterRoleBinding = {
            metadata: {
              ...existingBinding.metadata,
              name: bindingName,
              labels: {
                ...(existingBinding.metadata?.labels ?? {}),
                'managed-by': 'xuanwu-platform'
              },
              resourceVersion
            },
            roleRef: {
              apiGroup: 'rbac.authorization.k8s.io',
              kind: 'ClusterRole',
              name: roleName
            },
            subjects: updatedSubjects
          }

          await this.rbacApi.replaceClusterRoleBinding({
            name: bindingName,
            body: updatedBinding
          })

          console.log(`[K8s] 🔄 Updated ClusterRoleBinding ${bindingName}`)
          return true
        } catch (readError: unknown) {
          console.error(
            `[K8s] ❌ Failed to reconcile ClusterRoleBinding ${bindingName}:`,
            this.getErrorMessage(readError)
          )
          return false
        }
      }

      if (statusCode === 403) {
        console.warn(
          `[K8s] ⚠️ Insufficient permissions to ensure ClusterRoleBinding ${bindingName}: ${this.getErrorMessage(error)}`
        )
      } else {
        console.error(
          `[K8s] ❌ Failed to ensure ClusterRoleBinding ${bindingName}:`,
          this.getErrorMessage(error)
        )
      }
      return false
    }
  }

  private buildNamespaceRoleRules(): k8s.V1PolicyRule[] {
    return [
      {
        apiGroups: [''],
        resources: ['pods'],
        verbs: ['get', 'list', 'watch']
      },
      {
        apiGroups: [''],
        resources: ['pods/log'],
        verbs: ['get']
      },
      {
        apiGroups: [''],
        resources: ['events'],
        verbs: ['get', 'list', 'watch']
      }
    ]
  }

  private getServiceAccountIdentity(): { namespace: string; name: string } | null {
    if (this.serviceAccountIdentity !== undefined) {
      return this.serviceAccountIdentity
    }

    const envNamespace = process.env.K8S_SERVICE_ACCOUNT_NAMESPACE?.trim()
    const envName = process.env.K8S_SERVICE_ACCOUNT_NAME?.trim()

    const tokenInfo = this.decodeServiceAccountToken()
    const namespaceFromFile = this.readServiceAccountNamespaceFromDisk()

    const namespace = envNamespace || tokenInfo?.namespace || namespaceFromFile
    const name = envName || tokenInfo?.name

    if (!namespace || !name) {
      this.serviceAccountIdentity = null
      return null
    }

    this.serviceAccountIdentity = { namespace, name }
    return this.serviceAccountIdentity
  }

  private readServiceAccountNamespaceFromDisk(): string | undefined {
    const namespacePath = '/var/run/secrets/kubernetes.io/serviceaccount/namespace'

    try {
      if (!fs.existsSync(namespacePath)) {
        return undefined
      }
      const value = fs.readFileSync(namespacePath, 'utf8').trim()
      return value || undefined
    } catch (error) {
      console.warn('[K8s] ⚠️ Failed to read service account namespace from disk', error)
      return undefined
    }
  }

  private decodeServiceAccountToken(): { namespace?: string; name?: string } | null {
    const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token'

    try {
      if (!fs.existsSync(tokenPath)) {
        return null
      }

      const rawToken = fs.readFileSync(tokenPath, 'utf8').trim()
      if (!rawToken) {
        return null
      }

      const parts = rawToken.split('.')
      if (parts.length < 2) {
        return null
      }

      const payload = this.decodeJwtPayloadSegment(parts[1])
      if (!payload) {
        return null
      }

      const namespaceClaim = payload['kubernetes.io/serviceaccount/service-account.namespace']
      const nameClaim = payload['kubernetes.io/serviceaccount/service-account.name']

      let namespace = typeof namespaceClaim === 'string' ? namespaceClaim : undefined
      let name = typeof nameClaim === 'string' ? nameClaim : undefined

      const subjectClaim = typeof payload.sub === 'string' ? payload.sub : undefined
      if ((!namespace || !name) && subjectClaim) {
        const subjectMatch = subjectClaim.match(/^system:serviceaccount:([^:]+):(.+)$/)
        if (subjectMatch) {
          const [, subjectNamespace, subjectName] = subjectMatch
          if (!namespace && subjectNamespace) {
            namespace = subjectNamespace
          }
          if (!name && subjectName) {
            name = subjectName
          }
        }
      }

      return { namespace, name }
    } catch (error) {
      console.warn('[K8s] ⚠️ Failed to decode service account token', error)
      return null
    }
  }

  private decodeJwtPayloadSegment(segment: string): Record<string, unknown> | null {
    try {
      const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
      const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
      const decoded = Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8')
      return JSON.parse(decoded) as Record<string, unknown>
    } catch (error) {
      console.warn('[K8s] ⚠️ Failed to parse JWT payload segment', error)
      return null
    }
  }

  private buildNamespaceRoleNames(serviceAccount: { namespace: string; name: string }): {
    roleName: string
    roleBindingName: string
  } {
    const sanitized = this.sanitizeNamePart(`${serviceAccount.namespace}-${serviceAccount.name}`)
    const hash = createHash('sha256').update(sanitized).digest('hex').slice(0, 6)
    const roleBase = sanitized ? `${sanitized}-${hash}` : hash

    const roleName = this.truncateName(`xuanwu-access-${roleBase}`, 63)
    const roleBindingName = this.truncateName(`xuanwu-access-${roleBase}-binding`, 63)

    return { roleName, roleBindingName }
  }

  private buildClusterRoleNames(serviceAccount: { namespace: string; name: string }): {
    clusterRoleName: string
    clusterRoleBindingName: string
  } {
    const sanitized = this.sanitizeNamePart(`${serviceAccount.namespace}-${serviceAccount.name}`)
    const hash = createHash('sha256').update(`cluster-${sanitized}`).digest('hex').slice(0, 6)
    const roleBase = sanitized ? `${sanitized}-${hash}` : hash

    const clusterRoleName = this.truncateName(`xuanwu-cluster-access-${roleBase}`, 63)
    const clusterRoleBindingName = this.truncateName(
      `xuanwu-cluster-access-${roleBase}-binding`,
      63
    )

    return { clusterRoleName, clusterRoleBindingName }
  }

  private sanitizeNamePart(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  private truncateName(name: string, maxLength: number): string {
    if (name.length <= maxLength) {
      return name
    }
    return name.slice(0, maxLength)
  }

  private normalizePolicyRule(rule?: k8s.V1PolicyRule | null): string {
    if (!rule) {
      return ''
    }

    const normalizeList = (list?: string[] | null) =>
      list
        ? [...list]
            .map((item) => (item ?? '').trim())
            .filter((item) => item.length > 0)
            .sort()
        : []

    return JSON.stringify({
      apiGroups: normalizeList(rule.apiGroups),
      resources: normalizeList(rule.resources),
      verbs: normalizeList(rule.verbs),
      resourceNames: normalizeList(rule.resourceNames),
      nonResourceURLs: normalizeList(rule.nonResourceURLs)
    })
  }

  private arePolicyRulesEqual(
    first?: k8s.V1PolicyRule[] | null,
    second?: k8s.V1PolicyRule[] | null
  ): boolean {
    const normalize = (rules?: k8s.V1PolicyRule[] | null) =>
      (rules ?? []).map((rule) => this.normalizePolicyRule(rule)).sort()

    const firstNormalized = normalize(first)
    const secondNormalized = normalize(second)

    if (firstNormalized.length !== secondNormalized.length) {
      return false
    }

    return firstNormalized.every((value, index) => value === secondNormalized[index])
  }

  /**
   * 为项目创建共享 NFS PVC
   */
  async createProjectPVC(namespace: string): Promise<void> {
    const normalized = namespace.trim()

    console.log(`[K8s] 🚀 createProjectPVC called for namespace: ${normalized}`)

    if (!normalized || normalized === 'default') {
      if (process.env.K8S_VERBOSE === 'true') {
        console.log('[K8s] Skipping PVC creation for default/empty namespace')
      }
      return
    }

    try {
      // 确保命名空间存在
      console.log(`[K8s] Step 1: Ensuring namespace ${normalized} exists...`)
      await this.ensureNamespace(normalized)
      console.log(`[K8s] ✅ Namespace ${normalized} is ready`)

      const pvcName = 'shared-nfs-pvc'

      try {
        // 检查 PVC 是否已存在
        console.log(`[K8s] Step 2: Checking if PVC ${pvcName} exists...`)
        await this.coreApi.readNamespacedPersistentVolumeClaim({
          name: pvcName,
          namespace: normalized
        })
        console.log(`[K8s] PVC ${pvcName} already exists in namespace ${normalized}`)
        return
      } catch (error: unknown) {
        if (this.getStatusCode(error) !== 404) {
          console.error(`[K8s] ❌ Error checking PVC existence:`, error)
          throw error
        }
        console.log(`[K8s] PVC does not exist, will create it`)
      }

      // 创建 PVC
      const pvc: k8s.V1PersistentVolumeClaim = {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: {
          name: pvcName,
          namespace: normalized,
          labels: {
            'managed-by': 'xuanwu-platform'
          }
        },
        spec: {
          accessModes: ['ReadWriteMany'],
          resources: {
            requests: {
              storage: '10Gi'
            }
          },
          storageClassName: 'nfs-sc',
          volumeMode: 'Filesystem'
        }
      }

      console.log(`[K8s] Step 3: Creating PVC ${pvcName} with config:`, JSON.stringify(pvc, null, 2))
      
      try {
        await this.coreApi.createNamespacedPersistentVolumeClaim({
          namespace: normalized,
          body: pvc
        })
        console.log(`[K8s] ✅ Successfully created PVC ${pvcName} in namespace ${normalized}`)
      } catch (createError: unknown) {
        if (this.getStatusCode(createError) === 409) {
          console.log(`[K8s] PVC ${pvcName} already exists (concurrent creation)`)
          return
        }
        console.error(`[K8s] ❌ Failed to create PVC:`, createError)
        throw createError
      }
    } catch (outerError: unknown) {
      console.error(`[K8s] ❌ createProjectPVC failed for namespace ${normalized}:`, outerError)
      throw outerError
    }
  }
  
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message
    }

    return String(error)
  }

  private getStatusCode(error: unknown): number | undefined {
    // 方法 1: 检查 error.response.statusCode
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error
    ) {
      const response = (error as { response?: unknown }).response
      if (
        typeof response === 'object' &&
        response !== null &&
        'statusCode' in response &&
        typeof (response as { statusCode?: unknown }).statusCode === 'number'
      ) {
        return (response as { statusCode: number }).statusCode
      }
    }

    // 方法 2: 检查 error.statusCode（直接在错误对象上）
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
    ) {
      return (error as { statusCode: number }).statusCode
    }

    // 方法 3: 检查 error.code
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'number'
    ) {
      return (error as { code: number }).code
    }

    return undefined
  }
  
  private getImage(service: Service): string {
    if (service.type === 'application') {
      return (service as ApplicationService).built_image || 'nginx:latest'
    } else if (service.type === 'database') {
      const dbService = service as DatabaseService
      const version = dbService.version || 'latest'
      return `${dbService.database_type}:${version}`
    } else {
      const imageService = service as ImageService
      return `${imageService.image}:${imageService.tag || 'latest'}`
    }
  }

  /**
   * 解析命令字符串为 K8s 容器的 command 和 args
   * @param commandStr 用户输入的命令字符串
   * @returns {{ command?: string[], args?: string[] }} K8s 容器配置
   */
  private parseCommand(commandStr?: string): { command?: string[], args?: string[] } {
    if (!commandStr || typeof commandStr !== 'string') {
      return {}
    }

    const trimmed = commandStr.trim()
    if (!trimmed) {
      return {}
    }

    // 简单的 shell 命令解析：按空格分割，保留引号内的内容
    const parts: string[] = []
    let current = ''
    let inQuotes = false
    let quoteChar = ''

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i]
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true
        quoteChar = char
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false
        quoteChar = ''
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current)
          current = ''
        }
      } else {
        current += char
      }
    }

    if (current) {
      parts.push(current)
    }

    if (parts.length === 0) {
      return {}
    }

    // 如果以 sh -c 或 bash -c 开头，使用 shell 模式
    if (parts.length >= 3 && (parts[0] === 'sh' || parts[0] === 'bash') && parts[1] === '-c') {
      return {
        command: [parts[0], '-c'],
        args: [parts.slice(2).join(' ')]
      }
    }

    // 否则，第一个为 command，剩余为 args
    return {
      command: [parts[0]],
      args: parts.slice(1)
    }
  }

  private normalizeNetworkConfig(config?: Service['network_config']): NormalizedNetworkConfig | null {
    if (!config) {
      return null
    }

    const rawConfig = config as unknown as Record<string, unknown>

    const isTruthy = (value: unknown): boolean => {
      if (typeof value === 'boolean') {
        return value
      }
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (!normalized) {
          return false
        }
        return ['true', '1', 'yes', 'y', 'on'].includes(normalized)
      }
      if (typeof value === 'number') {
        return value !== 0
      }
      return false
    }

    let headlessServiceEnabled = false

    const headlessCandidates = [
      rawConfig['headless_service_enabled'],
      rawConfig['headlessServiceEnabled'],
      rawConfig['enable_headless_service'],
      rawConfig['enableHeadlessService']
    ]

    if (headlessCandidates.some((candidate) => isTruthy(candidate))) {
      headlessServiceEnabled = true
    }

    const nestedHeadless = rawConfig['headless_service']
    if (
      nestedHeadless &&
      typeof nestedHeadless === 'object' &&
      isTruthy((nestedHeadless as { enabled?: unknown }).enabled)
    ) {
      headlessServiceEnabled = true
    }

    const serviceType = (() => {
      const rawServiceType = rawConfig['service_type']
      if (typeof rawServiceType === 'string') {
        const normalized = rawServiceType.toLowerCase()
        if (normalized === 'clusterip') {
          return 'ClusterIP'
        }
        if (normalized === 'nodeport') {
          return 'NodePort'
        }
        if (normalized === 'loadbalancer') {
          return 'LoadBalancer'
        }
        if (normalized === 'headless') {
          headlessServiceEnabled = true
          return 'ClusterIP'
        }
      }
      return 'ClusterIP'
    })() as NormalizedNetworkConfig['serviceType']

    const parsePort = (portValue: unknown): NormalizedPortConfig | null => {
      if (!portValue || typeof portValue !== 'object') {
        return null
      }

      const portRecord = portValue as Record<string, unknown>

      const containerPortValue = portRecord['container_port'] ?? portRecord['containerPort']
      const containerPort = Number(containerPortValue)
      if (!Number.isInteger(containerPort) || containerPort <= 0) {
        return null
      }

      const servicePortValue =
        portRecord['service_port'] ?? portRecord['servicePort'] ?? containerPort
      const servicePortNumber = Number(servicePortValue)
      const servicePort =
        Number.isInteger(servicePortNumber) && servicePortNumber > 0
          ? servicePortNumber
          : containerPort

      const protocolRaw = portRecord['protocol']
      const protocolValue: NormalizedPortConfig['protocol'] =
        typeof protocolRaw === 'string' && protocolRaw.toUpperCase() === 'UDP' ? 'UDP' : 'TCP'

      const nodePortValue = portRecord['node_port'] ?? portRecord['nodePort']
      const nodePortNumber = Number(nodePortValue)
      const nodePort =
        Number.isInteger(nodePortNumber) && nodePortNumber > 0
          ? nodePortNumber
          : undefined

      const normalized: NormalizedPortConfig = {
        containerPort,
        servicePort,
        protocol: protocolValue
      }

      if (nodePort !== undefined) {
        normalized.nodePort = nodePort
      }

      const domainValue = portRecord['domain']
      if (domainValue && typeof domainValue === 'object') {
        const domainRecord = domainValue as Record<string, unknown>
        const enabledValue = domainRecord['enabled']
        const enabled = enabledValue === undefined ? true : Boolean(enabledValue)
        const hostValue = domainRecord['host'] ?? domainRecord['hostname']
        if (enabled && typeof hostValue === 'string') {
          const host = hostValue.trim().toLowerCase()
          if (host) {
            const prefixValue = domainRecord['prefix']
            const prefix =
              typeof prefixValue === 'string' && prefixValue.trim().length
                ? prefixValue.trim().toLowerCase()
                : undefined
            normalized.domain = prefix ? { host, prefix } : { host }
          }
        }
      } else if (typeof domainValue === 'string') {
        const host = domainValue.trim().toLowerCase()
        if (host) {
          normalized.domain = { host }
        }
      }

      return normalized
    }

    const rawPorts = rawConfig['ports']
    if (Array.isArray(rawPorts)) {
      const ports = rawPorts
        .map((port) => parsePort(port))
        .filter((port): port is NormalizedPortConfig => port !== null)

      if (!ports.length) {
        return null
      }

      return {
        serviceType,
        ports,
        headlessServiceEnabled
      }
    }

    const legacyPort = parsePort(rawConfig)
    if (!legacyPort) {
      return null
    }

    return {
      serviceType,
      ports: [legacyPort],
      headlessServiceEnabled
    }
  }

  async listNamespaces(): Promise<string[]> {
    try {
      const response = await this.coreApi.listNamespace()
      const directItems = Array.isArray((response as { items?: k8s.V1Namespace[] }).items)
        ? (response as { items: k8s.V1Namespace[] }).items
        : undefined
      const items = directItems ?? ((response as { body?: { items?: k8s.V1Namespace[] } }).body?.items ?? [])
      const names = items
        .map((item) => item.metadata?.name?.trim())
        .filter((name): name is string => Boolean(name && name.length))

      if (!names.includes('default')) {
        names.push('default')
      }

      const unique = Array.from(new Set(names))
      unique.sort((a, b) => {
        if (a === 'default') return -1
        if (b === 'default') return 1
        return a.localeCompare(b)
      })

      return unique
    } catch (error) {
      const message = this.getErrorMessage(error)
      console.error('[K8s] Failed to list namespaces:', message)
      throw new Error(`获取命名空间列表失败: ${message}`)
    }
  }

  async listImportableServices(namespace: string = 'default'): Promise<K8sImportCandidate[]> {
    try {
      const [deployments, statefulSets, services] = await Promise.all([
        this.appsApi.listNamespacedDeployment({ namespace }),
        this.appsApi.listNamespacedStatefulSet({ namespace }),
        this.coreApi.listNamespacedService({ namespace })
      ])

      const serviceItems = services.items ?? []
      const candidates: K8sImportCandidate[] = []

      for (const deployment of deployments.items ?? []) {
        const candidate = this.buildImportCandidateFromWorkload(deployment, 'Deployment', serviceItems)
        if (candidate) {
          candidates.push(candidate)
        }
      }

      for (const statefulSet of statefulSets.items ?? []) {
        const candidate = this.buildImportCandidateFromWorkload(statefulSet, 'StatefulSet', serviceItems)
        if (candidate) {
          candidates.push(candidate)
        }
      }

      return candidates
    } catch (error) {
      console.error('[K8s] Failed to list importable services:', this.getErrorMessage(error))
      return []
    }
  }

  async buildServicePayloadFromWorkload(
    projectId: string,
    namespace: string,
    name: string,
    kind: K8sWorkloadKind
  ): Promise<CreateServiceRequest | null> {
    try {
      const services = await this.coreApi.listNamespacedService({ namespace })

      if (kind === 'Deployment') {
        const workload = await this.appsApi.readNamespacedDeployment({ name, namespace })
        const candidate = this.buildImportCandidateFromWorkload(workload, kind, services.items ?? [])
        return candidate ? this.candidateToCreateRequest(projectId, candidate) : null
      }

      const workload = await this.appsApi.readNamespacedStatefulSet({ name, namespace })
      const candidate = this.buildImportCandidateFromWorkload(workload, kind, services.items ?? [])
      return candidate ? this.candidateToCreateRequest(projectId, candidate) : null
    } catch (error) {
      console.error('[K8s] Failed to build service payload from workload:', this.getErrorMessage(error))
      return null
    }
  }

  private buildEnvVars(service: Service): k8s.V1EnvVar[] {
    const envVars: Record<string, string> = {
      ...this.buildDefaultEnvVars(service)
    }

    if (service.env_vars) {
      for (const [name, value] of Object.entries(service.env_vars)) {
        if (value !== undefined && value !== null) {
          envVars[name] = String(value)
        }
      }
    }

    const entries = Object.entries(envVars)
    if (entries.length === 0) {
      return []
    }

    return entries.map(([name, value]) => ({
      name,
      value
    }))
  }

  private buildDefaultEnvVars(service: Service): Record<string, string> {
    if (service.type !== 'database') {
      return {}
    }

    const dbService = service as DatabaseService
    const env: Record<string, string> = {}

    switch (dbService.database_type) {
      case 'mysql':
      case 'mariadb':
        if (dbService.root_password) {
          env.MYSQL_ROOT_PASSWORD = dbService.root_password
        }
        if (dbService.database_name) {
          env.MYSQL_DATABASE = dbService.database_name
        }
        if (dbService.username) {
          env.MYSQL_USER = dbService.username
        }
        if (dbService.password) {
          env.MYSQL_PASSWORD = dbService.password
        }
        break
      case 'postgresql':
        if (dbService.database_name) {
          env.POSTGRES_DB = dbService.database_name
        }
        if (dbService.username) {
          env.POSTGRES_USER = dbService.username
        }
        if (dbService.password) {
          env.POSTGRES_PASSWORD = dbService.password
        }
        break
      case 'mongodb':
        if (dbService.username) {
          env.MONGO_INITDB_ROOT_USERNAME = dbService.username
        }
        if (dbService.password) {
          env.MONGO_INITDB_ROOT_PASSWORD = dbService.password
        }
        if (dbService.database_name) {
          env.MONGO_INITDB_DATABASE = dbService.database_name
        }
        break
      case 'redis':
        if (dbService.password) {
          env.REDIS_PASSWORD = dbService.password
        }
        break
      default:
        break
    }

    return env
  }

  private buildResources(
    limits?: { cpu?: string; memory?: string },
    requests?: { cpu?: string; memory?: string }
  ): k8s.V1ResourceRequirements | undefined {
    const hasLimits = limits?.cpu || limits?.memory
    const hasRequests = requests?.cpu || requests?.memory
    
    if (!hasLimits && !hasRequests) return undefined
    
    return {
      ...(hasLimits && {
        limits: {
          ...(limits.cpu && { cpu: limits.cpu }),
          ...(limits.memory && { memory: limits.memory })
        }
      }),
      ...(hasRequests && {
        requests: {
          ...(requests.cpu && { cpu: requests.cpu }),
          ...(requests.memory && { memory: requests.memory })
        }
      })
    }
  }

  private buildVolumeMounts(volumes?: Array<{ nfs_subpath?: string; container_path: string; read_only?: boolean }>, serviceName?: string): k8s.V1VolumeMount[] | undefined {
    if (!volumes || volumes.length === 0) return undefined
    // 所有挂载使用同一个 volume (shared-volume)，通过 subPath 区分不同路径
    return volumes.map((v) => ({
      name: 'shared-volume',
      mountPath: v.container_path,
      subPath: this.generateSubPath(serviceName || 'unknown', v.nfs_subpath, v.container_path),
      readOnly: v.read_only
    }))
  }

  /**
   * 生成 NFS 子路径
   * @param serviceName 服务名
   * @param userSubpath 用户指定的子路径
   * @param containerPath 容器路径
   * @returns 子路径，格式：{serviceName}/{userSubpath 或 containerPath}
   */
  private generateSubPath(serviceName: string, userSubpath?: string, containerPath?: string): string {
    // 如果用户指定了子路径
    if (userSubpath) {
      // 如果已经以服务名开头，直接使用
      if (userSubpath.startsWith(`${serviceName}/`)) {
        return userSubpath
      }
      // 否则添加服务名前缀
      return `${serviceName}/${userSubpath}`
    }
    
    // 如果没有指定，使用容器路径生成
    if (containerPath) {
      // 移除前导 '/' 并替换为 '-'
      const normalized = containerPath.replace(/^\//, '').replace(/\//g, '-')
      return `${serviceName}/${normalized}`
    }
    
    return serviceName
  }

  private buildVolumes(volumes?: Array<{ nfs_subpath?: string; container_path: string }>): k8s.V1Volume[] | undefined {
    if (!volumes || volumes.length === 0) return undefined
    // 只创建一个 volume，多个 volumeMount 通过 subPath 共享同一个 PVC
    return [{
      name: 'shared-volume',
      persistentVolumeClaim: {
        claimName: 'shared-nfs-pvc'
      }
    }]
  }

  /**
   * 构建调试工具 Init Container
   */
  private buildDebugInitContainer(
    debugConfig: DebugConfig,
    mountPath: string
  ): k8s.V1Container {
    const toolsetImages: Record<string, string> = {
      busybox: 'busybox:latest',
      netshoot: 'nicolaka/netshoot:latest',
      ubuntu: 'ubuntu:22.04'
    }

    const image = debugConfig.toolset === 'custom' && debugConfig.customImage
      ? debugConfig.customImage
      : toolsetImages[debugConfig.toolset] || toolsetImages.busybox

    const installScript = this.generateDebugToolsInstallScript(debugConfig.toolset, mountPath)

    return {
      name: 'install-debug-tools',
      image,
      imagePullPolicy: 'IfNotPresent', // 优先使用本地缓存，避免频繁拉取
      command: ['sh', '-c'],
      args: [installScript],
      volumeMounts: [
        {
          name: 'debug-tools',
          mountPath
        }
      ]
    }
  }

  /**
   * 生成调试工具安装脚本
   */
  private generateDebugToolsInstallScript(
    toolset: DebugConfig['toolset'],
    mountPath: string
  ): string {
    switch (toolset) {
      case 'busybox':
        return `
echo "Installing BusyBox debug tools..."
cp /bin/busybox ${mountPath}/
${mountPath}/busybox --install -s ${mountPath}/
echo "BusyBox tools installed successfully at ${mountPath}"
ls -la ${mountPath}/ | head -20
        `.trim()

      case 'netshoot':
        return `
echo "Installing Netshoot debug tools..."
mkdir -p ${mountPath}/bin
# 复制常用网络工具
for tool in curl wget nc nslookup dig tcpdump netstat ss iperf3 mtr traceroute nmap; do
  if command -v $tool >/dev/null 2>&1; then
    cp $(command -v $tool) ${mountPath}/bin/ 2>/dev/null || true
  fi
done
echo "Netshoot tools installed successfully at ${mountPath}/bin"
ls -la ${mountPath}/bin/
        `.trim()

      case 'ubuntu':
        return `
echo "Installing Ubuntu debug tools..."
mkdir -p ${mountPath}/bin
# 复制基础工具
for tool in bash sh ls cat grep ps top curl wget nc; do
  if command -v $tool >/dev/null 2>&1; then
    cp $(command -v $tool) ${mountPath}/bin/ 2>/dev/null || true
  fi
done
echo "Ubuntu tools installed successfully at ${mountPath}/bin"
echo "Note: You can install more tools using apt-get in the main container"
ls -la ${mountPath}/bin/
        `.trim()

      default:
        return `
echo "Installing custom debug tools..."
# 用户需要在自定义镜像中实现工具复制逻辑
# 默认复制 /bin 和 /usr/bin 中的常用工具
mkdir -p ${mountPath}/bin
cp /bin/* ${mountPath}/bin/ 2>/dev/null || true
echo "Custom tools installed at ${mountPath}/bin"
        `.trim()
    }
  }

  private buildImportCandidateFromWorkload(
    workload: k8s.V1Deployment | k8s.V1StatefulSet,
    kind: K8sWorkloadKind,
    services: k8s.V1Service[]
  ): K8sImportCandidate | null {
    const metadata = workload.metadata
    const spec = 'spec' in workload ? workload.spec : undefined
    const templateSpec = spec?.template?.spec

    if (!metadata?.name || !templateSpec) {
      return null
    }

    const namespace = metadata.namespace ?? 'default'
    const labels = metadata.labels ?? {}
    const containers = templateSpec.containers ?? []

    if (containers.length === 0) {
      return null
    }

    const primaryContainer = containers[0]
    if (!primaryContainer.image) {
      return null
    }

    const imageInfo = this.parseImage(primaryContainer.image)
    const commandParts = [
      ...(primaryContainer.command ?? []),
      ...(primaryContainer.args ?? [])
    ]
      .map((value) => value.trim())
      .filter(Boolean)

    const volumeInfos = this.extractVolumesFromTemplate(templateSpec, primaryContainer)

    const matchedServices = services
      .filter((service) => this.isServiceMatch(service, namespace, labels))
      .map((service) => this.toMatchedService(service, containers))
      .filter((service): service is NonNullable<typeof service> => service !== null)

    const networkConfig = this.buildNetworkConfigFromServices(matchedServices)

    const containersInfo = containers.map((container) => {
      const info = this.parseImage(container.image)
      const command = [
        ...(container.command ?? []),
        ...(container.args ?? [])
      ]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(' ')

      const envVars = this.extractEnvVars(container)

      return {
        name: container.name || info.repository,
        image: info.repository,
        tag: info.tag,
        command: command || undefined,
        env: Object.keys(envVars).length ? envVars : undefined
      }
    })

    return {
      uid: metadata.uid || `${namespace}/${metadata.name}`,
      name: metadata.name,
      namespace,
      kind,
      labels,
      replicas: spec?.replicas ?? 1,
      image: imageInfo.repository,
      tag: imageInfo.tag,
      command: commandParts.length ? commandParts.join(' ') : undefined,
      containers: containersInfo,
      volumes: volumeInfos,
      services: matchedServices,
      networkConfig: networkConfig || undefined
    }
  }

  private candidateToCreateRequest(projectId: string, candidate: K8sImportCandidate): CreateServiceRequest {
    const envVars = candidate.containers.reduce<Record<string, string>>((acc, container) => {
      if (!container?.env) {
        return acc
      }

      for (const [key, value] of Object.entries(container.env)) {
        if (!key || typeof value !== 'string') {
          continue
        }

        if (!(key in acc)) {
          acc[key] = value
        }
      }

      return acc
    }, {})

    const volumes = candidate.volumes
      .map((volume) => {
        const containerPath = volume.containerPath?.trim()
        if (!containerPath) {
          return null
        }

        const normalized: Record<string, unknown> = {
          container_path: containerPath
        }

        if (volume.subPath) {
          normalized.nfs_subpath = volume.subPath
        }

        if (volume.hostPath) {
          const hostPath = volume.hostPath.trim()
          if (hostPath) {
            normalized.host_path = hostPath
          }
        }

        if (typeof volume.readOnly === 'boolean') {
          normalized.read_only = volume.readOnly
        }

        return normalized
      })
      .filter((volume): volume is Record<string, unknown> => volume !== null)

    const payload: CreateServiceRequest = {
      project_id: projectId,
      name: candidate.name,
      type: ServiceType.IMAGE,
      image: candidate.image,
      tag: candidate.tag,
      command: candidate.command,
      replicas: candidate.replicas,
      ...(Object.keys(envVars).length ? { env_vars: envVars } : {}),
      ...(volumes.length ? { volumes } : {}),
      ...(candidate.networkConfig ? { network_config: candidate.networkConfig } : {})
    } as CreateServiceRequest

    return payload
  }

  private extractEnvVars(container: k8s.V1Container): Record<string, string> {
    const envVars: Record<string, string> = {}
    for (const envVar of container.env ?? []) {
      if (envVar.value !== undefined) {
        envVars[envVar.name] = envVar.value
      }
    }
    return envVars
  }

  private extractVolumesFromTemplate(
    templateSpec: k8s.V1PodSpec,
    container: k8s.V1Container
  ): K8sImportVolumeInfo[] {
    const mounts = container.volumeMounts ?? []
    if (mounts.length === 0) {
      return []
    }

    const volumes = templateSpec.volumes ?? []

    return mounts.map((mount) => {
      const matchedVolume = volumes.find((volume) => volume.name === mount.name)
      const hostPath = matchedVolume?.hostPath?.path
      const subPath = mount.subPath?.trim()
      const readOnly = typeof mount.readOnly === 'boolean' ? mount.readOnly : undefined

      return {
        containerPath: mount.mountPath,
        hostPath: hostPath || undefined,
        readOnly,
        subPath: subPath && subPath.length ? subPath : undefined
      }
    })
  }

  private isServiceMatch(service: k8s.V1Service, namespace: string, labels: Record<string, string>): boolean {
    if ((service.metadata?.namespace ?? 'default') !== namespace) {
      return false
    }

    const selector = service.spec?.selector
    if (!selector || Object.keys(selector).length === 0) {
      return false
    }

    return Object.entries(selector).every(([key, value]) => labels[key] === value)
  }

  private isHeadlessService(service: k8s.V1Service): boolean {
    const clusterIP = service.spec?.clusterIP
    if (typeof clusterIP === 'string' && clusterIP.trim().toLowerCase() === 'none') {
      return true
    }

    const clusterIPs = service.spec?.clusterIPs
    if (Array.isArray(clusterIPs)) {
      return clusterIPs.some(
        (ip) => typeof ip === 'string' && ip.trim().toLowerCase() === 'none'
      )
    }

    return false
  }

  private toMatchedService(
    service: k8s.V1Service,
    containers: k8s.V1Container[]
  ): { name: string; type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName' | 'Headless'; ports: Array<{ name?: string; port: number; targetPort: number; protocol: 'TCP' | 'UDP'; nodePort?: number }> } | null {
    const rawPorts = (service.spec?.ports ?? [])
      .map((port) => {
        const targetPort = this.resolveTargetPort(port, containers)
        if (!targetPort) {
          return null
        }

        return {
          name: port.name || undefined,
          port: port.port ?? targetPort,
          targetPort,
          protocol: (port.protocol === 'UDP' ? 'UDP' : 'TCP') as 'TCP' | 'UDP',
          nodePort: port.nodePort ?? undefined
        }
      })

    const ports = rawPorts.filter((port): port is NonNullable<typeof port> => port !== null)

    if (ports.length === 0) {
      return null
    }

    const normalizedType = this.normalizeServiceType(service.spec?.type)
    const type = this.isHeadlessService(service) ? 'Headless' : normalizedType

    return {
      name: service.metadata?.name ?? 'service',
      type,
      ports
    }
  }

  private resolveTargetPort(port: k8s.V1ServicePort, containers: k8s.V1Container[]): number {
    const target = port.targetPort

    if (typeof target === 'number') {
      return target
    }

    if (typeof target === 'string' && target) {
      const namedPort = containers
        .flatMap((container) => container.ports ?? [])
        .find((containerPort) => containerPort?.name === target)?.containerPort

      if (namedPort) {
        return namedPort
      }

      const numeric = Number(target)
      if (Number.isInteger(numeric) && numeric > 0) {
        return numeric
      }
    }

    if (port.port && port.port > 0) {
      return port.port
    }

    const fallback = containers
      .flatMap((container) => container.ports ?? [])
      .find((containerPort) => typeof containerPort?.containerPort === 'number')?.containerPort

    return fallback ?? 0
  }

  private buildNetworkConfigFromServices(
    services: Array<{ name: string; type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName' | 'Headless'; ports: Array<{ name?: string; port: number; targetPort: number; protocol: 'TCP' | 'UDP'; nodePort?: number }> }>
  ): NetworkConfigV2 | null {
    if (!services.length) {
      return null
    }

    const headlessService = services.find((service) => service.type === 'Headless')
    const primaryService = services.find((service) => service.type !== 'Headless' && service.type !== 'ExternalName')
    const portsSource = primaryService ?? headlessService

    if (!portsSource) {
      return null
    }

    const ports = portsSource.ports.map((port) => ({
      container_port: port.targetPort,
      service_port: port.port,
      protocol: port.protocol,
      node_port: port.nodePort
    }))

    const validPorts = ports.filter((port) => Number.isInteger(port.container_port) && port.container_port > 0)

    if (!validPorts.length) {
      return null
    }

    const baseType = primaryService ? this.normalizeServiceType(primaryService.type) : 'ClusterIP'
    const normalizedServiceType: NetworkConfigV2['service_type'] =
      baseType === 'NodePort' || baseType === 'LoadBalancer' ? baseType : 'ClusterIP'

    const headlessEnabled = Boolean(headlessService)

    return {
      service_type: normalizedServiceType,
      headless_service_enabled: headlessEnabled || undefined,
      ports: validPorts
    }
  }

  private normalizeServiceType(type?: string): 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName' {
    if (!type) {
      return 'ClusterIP'
    }

    const normalized = type.toLowerCase()
    if (normalized === 'nodeport') {
      return 'NodePort'
    }
    if (normalized === 'loadbalancer') {
      return 'LoadBalancer'
    }
    if (normalized === 'externalname') {
      return 'ExternalName'
    }
    return 'ClusterIP'
  }

  private parseImage(image?: string): ImageInfo {
    if (!image) {
      return {
        repository: 'unknown',
        tag: 'latest'
      }
    }

    const digestIndex = image.indexOf('@')
    const workableImage = digestIndex === -1 ? image : image.slice(0, digestIndex)
    const lastSlash = workableImage.lastIndexOf('/')
    const lastColon = workableImage.lastIndexOf(':')

    if (lastColon > lastSlash) {
      return {
        repository: workableImage.slice(0, lastColon),
        tag: workableImage.slice(lastColon + 1) || 'latest'
      }
    }

    return {
      repository: workableImage,
      tag: 'latest'
    }
  }

  private getIngressRules(config: NormalizedNetworkConfig): IngressRuleConfig[] {
    const rules: IngressRuleConfig[] = []
    const seenHosts = new Set<string>()

    for (const port of config.ports) {
      const host = port.domain?.host?.trim()
      if (!host) {
        continue
      }

      const normalizedHost = host.toLowerCase()
      if (seenHosts.has(normalizedHost)) {
        continue
      }

      seenHosts.add(normalizedHost)
      rules.push({
        host: normalizedHost,
        servicePort: port.servicePort
      })
    }

    return rules
  }

  private async deleteK8sServiceIfExists(name: string, namespace: string): Promise<void> {
    try {
      await this.coreApi.deleteNamespacedService({ name, namespace })
    } catch (error: unknown) {
      if (this.getStatusCode(error) !== 404) {
        throw error
      }
    }
  }

  private async deleteIngressIfExists(name: string, namespace: string): Promise<void> {
    try {
      await this.networkingApi.deleteNamespacedIngress({ name, namespace })
    } catch (error: unknown) {
      if (this.getStatusCode(error) !== 404) {
        throw error
      }
    }
  }

  private async syncIngressResources(
    service: Service,
    namespace: string,
    config: NormalizedNetworkConfig
  ): Promise<void> {
    const serviceName = service.name?.trim()
    const targetNamespace = namespace?.trim()

    if (!serviceName || !targetNamespace) {
      return
    }

    const ingressName = `${serviceName}-ingress`
    const rules = this.getIngressRules(config)

    if (!rules.length) {
      await this.deleteIngressIfExists(ingressName, targetNamespace)
      return
    }

    const desiredIngress: k8s.V1Ingress = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: ingressName,
        namespace: targetNamespace,
        labels: {
          app: serviceName,
          'managed-by': 'xuanwu-platform'
        }
      },
      spec: {
        rules: rules.map(({ host, servicePort }) => ({
          host,
          http: {
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: serviceName,
                    port: { number: servicePort }
                  }
                }
              }
            ]
          }
        }))
      }
    }

    let existingIngress: k8s.V1Ingress | null = null
    try {
      existingIngress = await this.networkingApi.readNamespacedIngress({
        name: ingressName,
        namespace: targetNamespace
      })
    } catch (error: unknown) {
      if (this.getStatusCode(error) !== 404) {
        throw error
      }
    }

    if (!existingIngress) {
      await this.networkingApi.createNamespacedIngress({ namespace: targetNamespace, body: desiredIngress })
      return
    }

    const updatedIngress: k8s.V1Ingress = {
      ...existingIngress,
      apiVersion: desiredIngress.apiVersion,
      kind: desiredIngress.kind,
      metadata: {
        ...existingIngress.metadata,
        name: ingressName,
        namespace: targetNamespace,
        labels: {
          ...(existingIngress.metadata?.labels ?? {}),
          ...(desiredIngress.metadata?.labels ?? {})
        }
      },
      spec: {
        ...(existingIngress.spec ?? {}),
        rules: desiredIngress.spec?.rules ?? []
      }
    }

    await this.networkingApi.replaceNamespacedIngress({
      name: ingressName,
      namespace: targetNamespace,
      body: updatedIngress
    })
  }

  private getHeadlessServiceName(serviceName: string): string {
    return `${serviceName}-headless`
  }

  private async syncHeadlessService(
    service: Service,
    namespace: string,
    config: NormalizedNetworkConfig
  ): Promise<void> {
    const serviceName = service.name?.trim()
    const targetNamespace = namespace?.trim()

    if (!serviceName || !targetNamespace) {
      return
    }

    const headlessName = this.getHeadlessServiceName(serviceName)

    if (!config.headlessServiceEnabled || !config.ports.length) {
      await this.deleteK8sServiceIfExists(headlessName, targetNamespace)
      return
    }

    const ports: k8s.V1ServicePort[] = config.ports.map((port, index) => ({
      name: `headless-port-${port.containerPort}-${index}`,
      port: port.servicePort,
      targetPort: port.containerPort,
      protocol: port.protocol
    }))

    const desiredService: k8s.V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: headlessName,
        namespace: targetNamespace,
        labels: {
          app: serviceName,
          'managed-by': 'xuanwu-platform',
          'xuanwu.io/headless-service': 'true'
        }
      },
      spec: {
        selector: { app: serviceName },
        ports,
        type: 'ClusterIP',
        clusterIP: 'None',
        clusterIPs: ['None'],
        publishNotReadyAddresses: true
      }
    }

    let existingService: k8s.V1Service | null = null
    try {
      existingService = await this.coreApi.readNamespacedService({
        name: headlessName,
        namespace: targetNamespace
      })
    } catch (error: unknown) {
      if (this.getStatusCode(error) !== 404) {
        throw error
      }
    }

    if (!existingService) {
      await this.coreApi.createNamespacedService({ namespace: targetNamespace, body: desiredService })
      return
    }

    const updatedService: k8s.V1Service = {
      ...existingService,
      apiVersion: desiredService.apiVersion,
      kind: desiredService.kind,
      metadata: {
        ...existingService.metadata,
        name: headlessName,
        namespace: targetNamespace,
        labels: {
          ...(existingService.metadata?.labels ?? {}),
          ...(desiredService.metadata?.labels ?? {})
        }
      },
      spec: {
        ...existingService.spec,
        selector: desiredService.spec?.selector,
        type: 'ClusterIP',
        ports,
        clusterIP: 'None',
        clusterIPs: ['None'],
        publishNotReadyAddresses: true
      }
    }

    await this.coreApi.replaceNamespacedService({
      name: headlessName,
      namespace: targetNamespace,
      body: updatedService
    })
  }

  async getServiceNetworkInfo(
    serviceName: string,
    namespace: string
  ): Promise<
    | {
        serviceType: string | null
        ports: Array<{
          name: string | null
          port: number | null
          targetPort: number | null
          nodePort: number | null
          protocol: string | null
        }>
      }
    | null
  > {
    const normalizedName = serviceName?.trim()
    const targetNamespace = namespace?.trim() || 'default'

    if (!normalizedName) {
      return null
    }

    try {
      const service = await this.coreApi.readNamespacedService({
        name: normalizedName,
        namespace: targetNamespace
      })

      const spec = service?.spec
      if (!spec) {
        return null
      }

      const ports = (spec.ports ?? []).map((port) => ({
        name: port.name ?? null,
        port: typeof port.port === 'number' ? port.port : null,
        targetPort:
          typeof port.targetPort === 'number'
            ? port.targetPort
            : typeof port.targetPort === 'string'
              ? Number.parseInt(port.targetPort, 10) || null
              : null,
        nodePort: typeof port.nodePort === 'number' ? port.nodePort : null,
        protocol: port.protocol ?? null
      }))

      const resolvedServiceType = this.isHeadlessService(service)
        ? 'Headless'
        : spec.type ?? null

      return {
        serviceType: resolvedServiceType,
        ports
      }
    } catch (error: unknown) {
      if (this.getStatusCode(error) === 404) {
        return null
      }

      const message = this.getErrorMessage(error)
      throw new Error(`获取 Kubernetes Service 信息失败: ${message}`)
    }
  }

  private async createServiceFromConfig(
    service: Service,
    namespace: string,
    config: NormalizedNetworkConfig
  ) {
    const serviceName = service.name?.trim()
    const targetNamespace = namespace?.trim()

    if (!serviceName || !targetNamespace) {
      return
    }

    if (!config.ports.length) {
      await this.deleteK8sServiceIfExists(serviceName, targetNamespace)
      await this.deleteK8sServiceIfExists(this.getHeadlessServiceName(serviceName), targetNamespace)
      await this.syncIngressResources(service, targetNamespace, config)
      return
    }

    const ports: k8s.V1ServicePort[] = config.ports.map((port, index) => {
      const servicePort: k8s.V1ServicePort = {
        name: `port-${port.containerPort}-${index}`,
        port: port.servicePort,
        targetPort: port.containerPort,
        protocol: port.protocol
      }

      if (config.serviceType === 'NodePort' && port.nodePort) {
        servicePort.nodePort = port.nodePort
      }

      return servicePort
    })

    const desiredService: k8s.V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: serviceName,
        namespace: targetNamespace,
        labels: {
          app: serviceName,
          'managed-by': 'xuanwu-platform'
        }
      },
      spec: {
        selector: { app: serviceName },
        ports,
        type: config.serviceType
      }
    }

    let existingService: k8s.V1Service | null = null
    try {
      existingService = await this.coreApi.readNamespacedService({
        name: serviceName,
        namespace: targetNamespace
      })
    } catch (error: unknown) {
      if (this.getStatusCode(error) !== 404) {
        throw error
      }
    }

    if (!existingService) {
      await this.coreApi.createNamespacedService({ namespace: targetNamespace, body: desiredService })
      await this.syncIngressResources(service, targetNamespace, config)
      await this.syncHeadlessService(service, targetNamespace, config)
      return
    }

    if (config.serviceType === 'NodePort') {
      for (const existingPort of existingService.spec?.ports ?? []) {
        const existingTarget = existingPort.targetPort
        const matchedPort = ports.find((portDef) => {
          if (typeof existingTarget === 'number' && typeof portDef.targetPort === 'number') {
            return existingTarget === portDef.targetPort
          }

          if (typeof existingPort.port === 'number') {
            return portDef.port === existingPort.port
          }

          return false
        })

        if (matchedPort && matchedPort.nodePort === undefined && typeof existingPort.nodePort === 'number') {
          matchedPort.nodePort = existingPort.nodePort
        }
      }
    }

    const updatedSpec: k8s.V1ServiceSpec = {
      selector: desiredService.spec?.selector,
      type: desiredService.spec?.type,
      ports,
      publishNotReadyAddresses: existingService.spec?.publishNotReadyAddresses,
      ipFamilies: existingService.spec?.ipFamilies,
      ipFamilyPolicy: existingService.spec?.ipFamilyPolicy,
      sessionAffinity: existingService.spec?.sessionAffinity,
      externalIPs: existingService.spec?.externalIPs,
      externalName: existingService.spec?.externalName,
      externalTrafficPolicy: existingService.spec?.externalTrafficPolicy,
      internalTrafficPolicy: existingService.spec?.internalTrafficPolicy,
      loadBalancerIP: existingService.spec?.loadBalancerIP,
      loadBalancerSourceRanges: existingService.spec?.loadBalancerSourceRanges,
      healthCheckNodePort: existingService.spec?.healthCheckNodePort
    }

    const existingClusterIP = existingService.spec?.clusterIP
    if (existingClusterIP && existingClusterIP.toLowerCase() !== 'none') {
      updatedSpec.clusterIP = existingClusterIP
      if (existingService.spec?.clusterIPs) {
        updatedSpec.clusterIPs = existingService.spec.clusterIPs
      }
    }

    const updatedService: k8s.V1Service = {
      ...existingService,
      apiVersion: desiredService.apiVersion,
      kind: desiredService.kind,
      metadata: {
        ...existingService.metadata,
        name: serviceName,
        namespace: targetNamespace,
        labels: {
          ...(existingService.metadata?.labels ?? {}),
          ...(desiredService.metadata?.labels ?? {})
        }
      },
      spec: updatedSpec
    }

    await this.coreApi.replaceNamespacedService({
      name: serviceName,
      namespace: targetNamespace,
      body: updatedService
    })

    await this.syncIngressResources(service, targetNamespace, config)
    await this.syncHeadlessService(service, targetNamespace, config)
  }

  // execInPod 保留为内部方法供文件系统模块使用
  async execInPod(
    namespace: string,
    podName: string,
    containerName: string,
    command: string[],
    options: { stdin?: Buffer } = {}
  ): Promise<{ stdout: Buffer; stderr: Buffer; exitCode: number | null }> {
    // Create lock key based on pod identity
    const lockKey = `${namespace}/${podName}/${containerName}`
    
    // Wait for any existing exec on this pod to complete (with timeout)
    const existingLock = this.podExecLocks.get(lockKey)
    if (existingLock) {
      try {
        // 等待现有锁，但最多等待5秒
        await Promise.race([
          existingLock,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('等待Pod锁超时')), 5000)
          )
        ])
      } catch (error) {
        // 如果等待超时，强制清除锁
        console.warn(`[K8s] 强制清除Pod锁: ${lockKey}`)
        this.podExecLocks.delete(lockKey)
      }
    }
    
    // Create and register new lock
    let releaseLock: () => void
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve
    })
    this.podExecLocks.set(lockKey, lockPromise)
    
    try {
      return await this.execInPodImpl(namespace, podName, containerName, command, options)
    } finally {
      this.podExecLocks.delete(lockKey)
      releaseLock!()
    }
  }
  
  private async execInPodImpl(
    namespace: string,
    podName: string,
    containerName: string,
    command: string[],
    options: { stdin?: Buffer } = {}
  ): Promise<{ stdout: Buffer; stderr: Buffer; exitCode: number | null }> {
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    const stdoutStream = new Writable({
      write(chunk, _encoding, callback) {
        stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        callback()
      }
    })

    const stderrStream = new Writable({
      write(chunk, _encoding, callback) {
        stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        callback()
      }
    })

    const stdinStream = options.stdin ? Readable.from([options.stdin]) : null
    let status: k8s.V1Status | null = null

    // 添加超时保护
    const execPromise = new Promise<void>((resolve, reject) => {
      let stdoutFinished = false
      let stderrFinished = false
      let socketClosed = false
      let rejected = false
      let ws: any = null

      const cleanup = () => {
        if (ws && typeof ws.close === 'function') {
          try {
            ws.close()
          } catch (error) {
            console.error('[K8s] Error closing websocket:', error)
          }
        }
      }

      const maybeResolve = () => {
        if (rejected) {
          return
        }
        if (stdoutFinished && stderrFinished && socketClosed) {
          resolve()
        }
      }

      const handleError = (error: unknown) => {
        if (rejected) {
          return
        }
        rejected = true
        cleanup()
        reject(error instanceof Error ? error : new Error(String(error)))
      }

      // 设置超时
      const timeoutId = setTimeout(() => {
        if (!rejected) {
          rejected = true
          cleanup()
          const cmdStr = command.join(' ')
          const stdinSize = options.stdin ? `${(options.stdin.length / 1024).toFixed(2)}KB` : '0KB'
          console.error(`[K8s] Pod命令执行超时: ${namespace}/${podName}/${containerName}, stdin: ${stdinSize}, 命令: ${cmdStr.substring(0, 100)}`)
          reject(new Error(`Pod命令执行超时 (120秒)，可能是网络慢或文件过大`))
        }
      }, 120000) // 120秒超时（2分钟）

      stdoutStream.on('finish', () => {
        stdoutFinished = true
        maybeResolve()
      })
      stderrStream.on('finish', () => {
        stderrFinished = true
        maybeResolve()
      })
      stdoutStream.on('error', handleError)
      stderrStream.on('error', handleError)

      this.execClient
        .exec(namespace, podName, containerName, command, stdoutStream, stderrStream, stdinStream, false, (execStatus) => {
          status = execStatus
        })
        .then((websocket) => {
          ws = websocket
          ws.on('close', () => {
            clearTimeout(timeoutId)
            socketClosed = true
            maybeResolve()
          })
          ws.on('error', handleError)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          handleError(error)
        })
    })

    await execPromise

    return {
      stdout: Buffer.concat(stdoutChunks),
      stderr: Buffer.concat(stderrChunks),
      exitCode: this.extractExitCode(status)
    }
  }

  private extractExitCode(status?: k8s.V1Status | null): number | null {
    if (!status) {
      return null
    }

    if (typeof status.code === 'number') {
      return status.code
    }

    const causes = status.details?.causes
    if (Array.isArray(causes)) {
      const exitCause = causes.find((cause) => cause.reason === 'ExitCode')
      if (exitCause) {
        const parsed = Number(exitCause.message)
        if (Number.isFinite(parsed)) {
          return parsed
        }
      }
    }

    if (typeof status.status === 'string') {
      return status.status.toLowerCase() === 'success' ? 0 : null
    }

    return null
  }
}

export const k8sService = new K8sService()
