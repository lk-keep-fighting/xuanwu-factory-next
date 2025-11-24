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
  type K8sStartupConfig
} from '@/types/project'
import type {
  K8sImportCandidate,
  K8sWorkloadKind,
  K8sImportVolumeInfo,
  K8sFileEntry,
  K8sFileListResult
} from '@/types/k8s'
import * as yaml from 'js-yaml'
import { sanitizeStartupConfig, buildStartupCommandPreview } from '@/lib/startup-config'

const SHARED_NFS_VOLUME_NAME = 'shared-nfs-volume'

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

const POSIX_PATH = path.posix

const FILE_OPERATION_EXIT_CODES = {
  NOT_FOUND: 44,
  NOT_DIRECTORY: 45,
  IS_DIRECTORY: 46
} as const

export class K8sFileError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = 'K8sFileError'
    this.statusCode = statusCode
  }
}

class K8sService {
  private kc: k8s.KubeConfig
  private appsApi: k8s.AppsV1Api
  private coreApi: k8s.CoreV1Api
  private networkingApi: k8s.NetworkingV1Api
  private rbacApi: k8s.RbacAuthorizationV1Api
  private execClient: k8s.Exec
  private namespaceAccessCache = new Set<string>()
  private clusterAccessCache = new Set<string>()
  private serviceAccountIdentity?: { namespace: string; name: string } | null

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

      if (kubeconfigData) {
        const configValue = this.decodeConfigInput(kubeconfigData)
        console.log('[K8s] 使用 KUBECONFIG_DATA 环境变量加载配置')
        this.kc.loadFromString(configValue)
      } else if (apiServer && bearerToken) {
        console.log('[K8s] 使用 K8S_API_SERVER + K8S_BEARER_TOKEN 环境变量加载配置')
        this.loadFromTokenEnv()
      } else if (process.env.KUBECONFIG) {
        console.log('[K8s] 使用 KUBECONFIG 路径加载配置:', process.env.KUBECONFIG)
        this.kc.loadFromFile(process.env.KUBECONFIG)
      } else {
        console.log('[K8s] 使用默认配置加载 (~/.kube/config)')
        this.kc.loadFromDefault()
      }

      const currentCluster = this.kc.getCurrentCluster()
      const currentContext = this.kc.getCurrentContext()

      if (currentCluster) {
        console.log('[K8s] ✅ 配置加载成功')
        console.log('[K8s]    集群:', currentCluster.name)
        console.log('[K8s]    API Server:', currentCluster.server)
        console.log('[K8s]    上下文:', currentContext)
        console.log('[K8s]    TLS验证:', currentCluster.skipTLSVerify ? '已禁用 ⚠️' : '已启用')
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
      
      console.log('[K8s] 🔓 已配置 HTTPS Agent：禁用证书验证（适用于自签名证书）')
    } else {
      console.log('[K8s] 🔒 使用默认 HTTPS Agent：启用证书验证')
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
      const startupOverrides = this.normalizeServiceStartupConfig(service)
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
              containers: [{
                name: service.name,
                image: this.getImage(service),
                ports: effectiveNetwork
                  ? effectiveNetwork.ports.map((port, index) => ({
                      containerPort: port.containerPort,
                      protocol: port.protocol,
                      name: `port-${port.containerPort}-${index}`
                    }))
                  : undefined,
                env: this.buildEnvVars(service),
                resources: this.buildResources(service.resource_limits),
                volumeMounts: this.buildVolumeMounts(service.volumes, service.name),
                ...(startupOverrides?.workingDir ? { workingDir: startupOverrides.workingDir } : {}),
                ...(startupOverrides?.command && startupOverrides.command.length
                  ? { command: startupOverrides.command }
                  : {}),
                ...(startupOverrides?.args && startupOverrides.args.length
                  ? { args: startupOverrides.args }
                  : {})
              }],
              volumes: this.buildVolumes(service.volumes)
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

  private async deployDatabaseStatefulSet(
    service: DatabaseService,
    namespace: string,
    networkConfig: NormalizedNetworkConfig | null
  ): Promise<void> {
    const serviceName = service.name?.trim()

    if (!serviceName) {
      throw new Error('数据库服务名称缺失，无法部署。')
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

    const startupOverrides = this.normalizeServiceStartupConfig(service)
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
            containers: [
              {
                name: serviceName,
                image: this.getImage(service),
                ports: containerPorts,
                env: this.buildEnvVars(service),
                resources: this.buildResources(service.resource_limits),
                volumeMounts: volumeMounts.length ? volumeMounts : undefined,
                ...(startupOverrides?.workingDir ? { workingDir: startupOverrides.workingDir } : {}),
                ...(startupOverrides?.command && startupOverrides.command.length
                  ? { command: startupOverrides.command }
                  : {}),
                ...(startupOverrides?.args && startupOverrides.args.length
                  ? { args: startupOverrides.args }
                  : {})
              }
            ],
            volumes: this.buildVolumes(service.volumes)
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
      const hasFailedCondition = conditions.some((condition) => {
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

      if (replicas === 0) {
        status = 'stopped'
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

      const podStatusInfo = await this.getPodStatusInfo(targetNamespace, serviceName)

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
      const hasFailedCondition = conditions.some((condition) => {
        const type = condition.type?.toString() || ''
        const status = condition.status?.toString() || ''
        
        if (type === 'Available' && status === 'False' && replicas > 0) {
          return true
        }
        
        return false
      })

      if (replicas === 0) {
        status = 'stopped'
      } else if (hasFailedCondition) {
        status = 'error'
      } else if (readyReplicas === replicas && currentReplicas === replicas) {
        status = 'running'
      } else if (readyReplicas === 0 && currentReplicas === 0) {
        status = 'error'
      } else {
        status = 'pending'
      }

      const podStatusInfo = await this.getPodStatusInfo(targetNamespace, serviceName)

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
   * 列出容器中的文件和目录
   */
  async listContainerFiles(
    serviceName: string,
    namespace: string,
    targetPath: string = '/'
  ): Promise<K8sFileListResult> {
    const normalizedPath = this.normalizeContainerPath(targetPath)
    const podInfo = await this.getPrimaryPodInfo(serviceName, namespace)
    const script = [
      `TARGET=${this.escapeShellArg(normalizedPath)}`,
      'if [ ! -e "$TARGET" ]; then echo "__XW_FILE_NOT_FOUND__" 1>&2; exit 44; fi',
      'if [ ! -d "$TARGET" ]; then echo "__XW_NOT_DIRECTORY__" 1>&2; exit 45; fi',
      'cd "$TARGET" && ls -a -p'
    ].join('; ')

    const result = await this.execInPod(podInfo.namespace, podInfo.podName, podInfo.containerName, [
      'sh',
      '-c',
      script
    ])

    if (result.exitCode && result.exitCode !== 0) {
      if (result.exitCode === FILE_OPERATION_EXIT_CODES.NOT_FOUND) {
        throw new K8sFileError('指定的路径不存在', 404)
      }
      if (result.exitCode === FILE_OPERATION_EXIT_CODES.NOT_DIRECTORY) {
        throw new K8sFileError('指定的路径不是目录', 400)
      }
      const stderr = result.stderr.toString('utf8').trim()
      throw new K8sFileError(stderr || '获取目录列表失败')
    }

    const entries = this.parseDirectoryListing(result.stdout.toString('utf8'), normalizedPath)

    return {
      path: normalizedPath,
      parentPath: this.getParentContainerPath(normalizedPath),
      entries
    }
  }

  /**
   * 下载容器中的文件
   */
  async readContainerFile(serviceName: string, namespace: string, filePath: string): Promise<Buffer> {
    const normalizedPath = this.normalizeContainerPath(filePath)
    const podInfo = await this.getPrimaryPodInfo(serviceName, namespace)
    const script = [
      `TARGET=${this.escapeShellArg(normalizedPath)}`,
      'if [ ! -e "$TARGET" ]; then echo "__XW_FILE_NOT_FOUND__" 1>&2; exit 44; fi',
      'if [ -d "$TARGET" ]; then echo "__XW_PATH_IS_DIRECTORY__" 1>&2; exit 46; fi',
      'cat "$TARGET"'
    ].join('; ')

    const result = await this.execInPod(podInfo.namespace, podInfo.podName, podInfo.containerName, [
      'sh',
      '-c',
      script
    ])

    if (result.exitCode && result.exitCode !== 0) {
      if (result.exitCode === FILE_OPERATION_EXIT_CODES.NOT_FOUND) {
        throw new K8sFileError('文件不存在', 404)
      }
      if (result.exitCode === FILE_OPERATION_EXIT_CODES.IS_DIRECTORY) {
        throw new K8sFileError('无法下载目录，请选择文件', 400)
      }
      const stderr = result.stderr.toString('utf8').trim()
      throw new K8sFileError(stderr || '读取文件失败')
    }

    return result.stdout
  }

  /**
   * 上传文件到容器
   */
  async uploadContainerFile(
    serviceName: string,
    namespace: string,
    directoryPath: string,
    fileName: string,
    content: Buffer
  ): Promise<{ path: string }> {
    const normalizedDirectory = this.normalizeContainerPath(directoryPath)
    const sanitizedFileName = this.validateFileName(fileName)
    const targetFilePath = this.joinContainerPath(normalizedDirectory, sanitizedFileName)
    const podInfo = await this.getPrimaryPodInfo(serviceName, namespace)
    const script = [
      `TARGET_DIR=${this.escapeShellArg(normalizedDirectory)}`,
      'if [ ! -d "$TARGET_DIR" ]; then echo "__XW_NOT_DIRECTORY__" 1>&2; exit 45; fi',
      `cat > ${this.escapeShellArg(targetFilePath)}`
    ].join('; ')

    const result = await this.execInPod(
      podInfo.namespace,
      podInfo.podName,
      podInfo.containerName,
      ['sh', '-c', script],
      { stdin: content }
    )

    if (result.exitCode && result.exitCode !== 0) {
      if (result.exitCode === FILE_OPERATION_EXIT_CODES.NOT_DIRECTORY) {
        throw new K8sFileError('目标路径不是有效的目录', 400)
      }
      const stderr = result.stderr.toString('utf8').trim()
      throw new K8sFileError(stderr || '上传文件失败')
    }

    return { path: targetFilePath }
  }

  /**
   * 获取服务事件
   */
  async getServiceEvents(serviceName: string, namespace: string = 'default') {
    const targetNamespace = namespace?.trim() || 'default'

    try {
      await this.ensureNamespaceAccess(targetNamespace)

      const events = await this.coreApi.listNamespacedEvent({
        namespace: targetNamespace,
        fieldSelector: `involvedObject.name=${serviceName}`
      })

      return {
        events: events.items.map(event => ({
          type: event.type || 'Normal',
          reason: event.reason || '',
          message: event.message || '',
          timestamp: event.lastTimestamp || event.firstTimestamp,
          count: event.count || 1
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
              ports: normalizedNetwork
                ? normalizedNetwork.ports.map((port, index) => ({
                    containerPort: port.containerPort,
                    protocol: port.protocol,
                    name: `port-${port.containerPort}-${index}`
                  }))
                : undefined,
              env: this.buildEnvVars(service),
              resources: this.buildResources(service.resource_limits),
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

  private async ensureNamespaceAccess(namespace: string): Promise<void> {
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
      console.log('[K8s] Skipping PVC creation for default/empty namespace')
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

  private buildResources(limits?: { cpu?: string; memory?: string }): k8s.V1ResourceRequirements | undefined {
    if (!limits?.cpu && !limits?.memory) return undefined
    return {
      limits: {
        ...(limits.cpu && { cpu: limits.cpu }),
        ...(limits.memory && { memory: limits.memory })
      }
    }
  }

  private buildVolumeMounts(volumes?: Array<{ nfs_subpath?: string; container_path: string; read_only?: boolean }>, serviceName?: string): k8s.V1VolumeMount[] | undefined {
    if (!volumes || volumes.length === 0) return undefined
    return volumes.map((v) => ({
      name: SHARED_NFS_VOLUME_NAME,
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
    // 所有挂载共享同一个 PVC，避免重复声明导致冲突
    return [
      {
        name: SHARED_NFS_VOLUME_NAME,
        persistentVolumeClaim: {
          claimName: 'shared-nfs-pvc'
        }
      }
    ]
  }

  private async getPodStatusInfo(
    namespace: string,
    serviceName: string
  ): Promise<{ imagePullFailed?: boolean; imagePullError?: string; containerStatuses?: k8s.V1ContainerStatus[] } | null> {
    try {
      const pods = await this.coreApi.listNamespacedPod({
        namespace,
        labelSelector: `app=${serviceName}`
      })

      const containerStatuses: k8s.V1ContainerStatus[] = []
      let imagePullFailed = false
      let imagePullError = ''

      for (const pod of pods.items) {
        const podContainerStatuses = pod.status?.containerStatuses || []
        containerStatuses.push(...podContainerStatuses)

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

        if (imagePullFailed) {
          break
        }
      }

      return {
        imagePullFailed,
        imagePullError: imagePullError || undefined,
        containerStatuses
      }
    } catch (error) {
      console.warn('[K8s] Failed to get pod status:', error)
      return null
    }
  }

  private normalizeServiceStartupConfig(
    service: Service
  ): { workingDir?: string; command?: string[]; args?: string[] } | null {
    const sanitized = sanitizeStartupConfig(service.k8s_startup_config ?? null)

    if (sanitized) {
      return {
        ...(sanitized.working_dir ? { workingDir: sanitized.working_dir } : {}),
        ...(sanitized.command && sanitized.command.length ? { command: sanitized.command } : {}),
        ...(sanitized.args && sanitized.args.length ? { args: sanitized.args } : {})
      }
    }

    const fallbackCommand = typeof service.command === 'string' ? service.command.trim() : ''
    if (fallbackCommand) {
      return {
        command: ['/bin/sh', '-c', fallbackCommand]
      }
    }

    return null
  }

  private extractStartupConfigFromContainer(container: k8s.V1Container): K8sStartupConfig | null {
    const candidate: K8sStartupConfig = {}

    if (typeof container.workingDir === 'string') {
      const workingDir = container.workingDir.trim()
      if (workingDir) {
        candidate.working_dir = workingDir
      }
    }

    if (Array.isArray(container.command) && container.command.length) {
      candidate.command = container.command
    }

    if (Array.isArray(container.args) && container.args.length) {
      candidate.args = container.args
    }

    return sanitizeStartupConfig(candidate)
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

    const startupConfig = this.extractStartupConfigFromContainer(primaryContainer)
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
      startupConfig: startupConfig ?? undefined,
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

    const normalizedStartupConfig = sanitizeStartupConfig(candidate.startupConfig ?? null)
    if (normalizedStartupConfig) {
      payload.k8s_startup_config = normalizedStartupConfig
      const preview = buildStartupCommandPreview(normalizedStartupConfig)
      if (preview) {
        payload.command = preview
      }
    }

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

  private async getPrimaryPodInfo(
    serviceName: string,
    namespace: string
  ): Promise<{ namespace: string; podName: string; containerName: string }> {
    const normalizedServiceName = serviceName?.trim()
    const targetNamespace = namespace?.trim() || 'default'

    if (!normalizedServiceName) {
      throw new K8sFileError('服务名称缺失，无法执行文件操作', 400)
    }

    await this.ensureNamespaceAccess(targetNamespace)

    const pods = await this.coreApi.listNamespacedPod({
      namespace: targetNamespace,
      labelSelector: `app=${normalizedServiceName}`
    })

    if (!pods.items.length) {
      throw new K8sFileError('未找到运行中的 Pod，请先部署或启动服务后再试。', 409)
    }

    const selectedPod = this.selectPreferredPod(pods.items)
    if (!selectedPod) {
      throw new K8sFileError('未找到可用的 Pod 实例', 409)
    }

    const podName = selectedPod.metadata?.name?.trim()
    if (!podName) {
      throw new K8sFileError('无法确定目标 Pod 名称', 500)
    }

    const containerName = this.resolveContainerName(selectedPod, normalizedServiceName)

    return {
      namespace: targetNamespace,
      podName,
      containerName
    }
  }

  private selectPreferredPod(pods: k8s.V1Pod[]): k8s.V1Pod | null {
    if (!pods.length) {
      return null
    }

    const scored = pods
      .map((pod) => {
        const phase = (pod.status?.phase ?? '').toLowerCase()
        const statuses = pod.status?.containerStatuses ?? []
        const ready = statuses.length ? statuses.every((status) => status.ready) : phase === 'running'
        const restartCount = statuses.reduce((sum, status) => sum + (status.restartCount ?? 0), 0)
        const startTime = pod.status?.startTime ? new Date(pod.status.startTime).getTime() : 0

        return {
          pod,
          ready,
          phase,
          restartCount,
          startTime
        }
      })
      .sort((a, b) => {
        if (a.ready !== b.ready) {
          return a.ready ? -1 : 1
        }
        if (a.phase !== b.phase) {
          if (a.phase === 'running') {
            return -1
          }
          if (b.phase === 'running') {
            return 1
          }
        }
        if (a.restartCount !== b.restartCount) {
          return a.restartCount - b.restartCount
        }
        return b.startTime - a.startTime
      })

    return scored[0]?.pod ?? null
  }

  private resolveContainerName(pod: k8s.V1Pod, fallback: string): string {
    const containers = pod.spec?.containers ?? []
    if (!containers.length) {
      return fallback
    }

    const normalizedFallback = fallback?.trim()
    const matched = normalizedFallback
      ? containers.find((container) => container.name === normalizedFallback)
      : undefined

    return matched?.name ?? containers[0].name ?? normalizedFallback
  }

  private parseDirectoryListing(rawOutput: string, basePath: string): K8sFileEntry[] {
    const normalizedBase = this.normalizeContainerPath(basePath)
    const lines = rawOutput
      .split('\n')
      .map((line) => line.replace(/\r/g, '').trim())
      .filter((line) => line && line !== '.' && line !== '..')

    const entries = lines.map((line) => {
      const isDirectory = line.endsWith('/')
      const cleanName = isDirectory ? line.slice(0, -1) : line
      const type: K8sFileEntry['type'] = isDirectory ? 'directory' : 'file'

      return {
        name: cleanName,
        path: this.joinContainerPath(normalizedBase, cleanName),
        type,
        isHidden: cleanName.startsWith('.')
      }
    })

    return entries.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') {
        return -1
      }
      if (a.type !== 'directory' && b.type === 'directory') {
        return 1
      }
      return a.name.localeCompare(b.name, 'zh-CN')
    })
  }

  private normalizeContainerPath(candidate?: string | null): string {
    if (!candidate) {
      return '/'
    }

    const trimmed = candidate.trim()
    if (!trimmed) {
      return '/'
    }

    const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
    const normalized = POSIX_PATH.normalize(withLeadingSlash)

    if (!normalized || normalized === '.' || normalized === '') {
      return '/'
    }

    return normalized
  }

  private getParentContainerPath(pathValue: string): string | null {
    const normalized = this.normalizeContainerPath(pathValue)
    if (normalized === '/') {
      return null
    }

    const parent = POSIX_PATH.dirname(normalized)
    return parent === normalized ? '/' : parent
  }

  private joinContainerPath(basePath: string, name: string): string {
    const normalizedBase = this.normalizeContainerPath(basePath)
    const trimmedName = name.trim()

    if (!trimmedName || trimmedName === '.') {
      return normalizedBase
    }

    if (trimmedName === '..') {
      return this.getParentContainerPath(normalizedBase) ?? '/'
    }

    if (trimmedName.includes('/')) {
      throw new K8sFileError('路径中包含非法字符', 400)
    }

    return POSIX_PATH.join(normalizedBase, trimmedName)
  }

  private validateFileName(fileName: string): string {
    const normalized = fileName?.trim()

    if (!normalized) {
      throw new K8sFileError('文件名不能为空', 400)
    }

    if (normalized === '.' || normalized === '..') {
      throw new K8sFileError('文件名非法', 400)
    }

    if (normalized.includes('/') || normalized.includes('\0') || normalized.includes('\n')) {
      throw new K8sFileError('文件名包含非法字符', 400)
    }

    return normalized
  }

  private escapeShellArg(value: string): string {
    if (!value) {
      return "''"
    }

    return `'${value.replace(/'/g, "'\\''")}'`
  }

  private async execInPod(
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

    await new Promise<void>((resolve, reject) => {
      let stdoutFinished = false
      let stderrFinished = false
      let socketClosed = false
      let rejected = false

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
        reject(error instanceof Error ? error : new Error(String(error)))
      }

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
        .then((ws) => {
          ws.on('close', () => {
            socketClosed = true
            maybeResolve()
          })
          ws.on('error', handleError)
        })
        .catch(handleError)
    })

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
