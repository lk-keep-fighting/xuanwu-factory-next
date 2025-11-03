import * as k8s from '@kubernetes/client-node'
import {
  type Service,
  type ApplicationService,
  type DatabaseService,
  type ImageService,
  type CreateServiceRequest,
  ServiceType,
  type NetworkConfigV2
} from '@/types/project'
import type { K8sImportCandidate, K8sWorkloadKind } from '@/types/k8s'
import * as yaml from 'js-yaml'

type NormalizedPortConfig = {
  containerPort: number
  servicePort: number
  protocol: 'TCP' | 'UDP'
  nodePort?: number
}

type NormalizedNetworkConfig = {
  serviceType: 'ClusterIP' | 'NodePort' | 'LoadBalancer'
  ports: NormalizedPortConfig[]
}

type ImageInfo = {
  repository: string
  tag: string
}

class K8sService {
  private kc: k8s.KubeConfig
  private appsApi: k8s.AppsV1Api
  private coreApi: k8s.CoreV1Api

  constructor() {
    this.kc = new k8s.KubeConfig()
    
    try {
      // 支持多种配置方式
      if (process.env.KUBECONFIG_DATA) {
        // 方式1：从环境变量中的 JSON 配置加载（适合生产环境）
        console.log('[K8s] 使用 KUBECONFIG_DATA 环境变量加载配置')
        this.kc.loadFromString(process.env.KUBECONFIG_DATA)
      } else if (process.env.KUBECONFIG) {
        // 方式2：从指定路径的文件加载
        console.log('[K8s] 使用 KUBECONFIG 路径加载配置:', process.env.KUBECONFIG)
        this.kc.loadFromFile(process.env.KUBECONFIG)
      } else {
        // 方式3：从默认位置加载 (~/.kube/config)
        console.log('[K8s] 使用默认配置加载 (~/.kube/config)')
        this.kc.loadFromDefault()
      }
      
      // 验证配置
      const currentCluster = this.kc.getCurrentCluster()
      const currentContext = this.kc.getCurrentContext()
      
      if (currentCluster) {
        console.log('[K8s] ✅ 配置加载成功')
        console.log('[K8s]    集群:', currentCluster.name)
        console.log('[K8s]    API Server:', currentCluster.server)
        console.log('[K8s]    上下文:', currentContext)
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
      console.error('[K8s]    3. 生产环境：设置 KUBECONFIG_DATA 环境变量')
      console.error('[K8s] 原始错误对象:', error)
    }
    
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api)
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api)
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

    // 使用 network_config 创建 K8s Service
    if (normalizedNetwork) {
      await this.createServiceFromConfig(service, targetNamespace, normalizedNetwork)
    }

    return { success: true }
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
    } catch (error: unknown) {
      console.error('Failed to stop service:', error)
      throw new Error(`停止服务失败: ${this.getErrorMessage(error)}`)
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
          replicas: originalReplicas
        }
      }

      await this.appsApi.replaceNamespacedDeployment({
        name: serviceName,
        namespace: targetNamespace,
        body: updatedDeployment as k8s.V1Deployment
      })

      return { success: true, message: '服务已启动' }
    } catch (error: unknown) {
      console.error('Failed to start service:', error)
      throw new Error(`启动服务失败: ${this.getErrorMessage(error)}`)
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
    } catch (error: unknown) {
      console.error(`[K8s] ❌ 重启服务失败: ${serviceName}`, error)

      const rawMessage = this.getErrorMessage(error)
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
    } catch (error: unknown) {
      console.error('Failed to scale service:', error)
      throw new Error(`扩缩容失败: ${this.getErrorMessage(error)}`)
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
      await this.coreApi.deleteNamespacedService({ name: serviceName, namespace: targetNamespace })
    } catch (error: unknown) {
      if (this.getStatusCode(error) !== 404) {
        console.error('Failed to delete service resource:', error)
        throw new Error(`删除服务失败: ${this.getErrorMessage(error)}`)
      }
    }

    return { success: true, message: '服务已删除' }
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus(serviceName: string, namespace: string) {
    const targetNamespace = namespace?.trim() || 'default'

    try {
      const deployment = await this.appsApi.readNamespacedDeployment({ name: serviceName, namespace: targetNamespace })
      const replicas = deployment.spec?.replicas || 0
      const availableReplicas = deployment.status?.availableReplicas || 0
      const readyReplicas = deployment.status?.readyReplicas || 0
      const updatedReplicas = deployment.status?.updatedReplicas || 0

      let status: 'running' | 'pending' | 'stopped' | 'error' = 'pending'

      if (replicas === 0) {
        status = 'stopped'
      } else if (availableReplicas === replicas && readyReplicas === replicas) {
        status = 'running'
      } else if (availableReplicas === 0) {
        status = 'error'
      }

      return {
        status,
        replicas,
        availableReplicas,
        readyReplicas,
        updatedReplicas,
        conditions: deployment.status?.conditions || []
      }
    } catch (error: unknown) {
      if (this.getStatusCode(error) === 404) {
        return { status: 'error' as const, error: '服务不存在' }
      }
      return { status: 'error' as const, error: this.getErrorMessage(error) }
    }
  }

  /**
   * 获取服务日志
   */
  async getServiceLogs(serviceName: string, lines: number = 100, namespace: string = 'default') {
    const targetNamespace = namespace?.trim() || 'default'

    try {
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
   * 获取服务事件
   */
  async getServiceEvents(serviceName: string, namespace: string = 'default') {
    const targetNamespace = namespace?.trim() || 'default'

    try {
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

    try {
      await this.coreApi.readNamespace({ name: normalized })
      console.log(`[K8s] ✅ Namespace ${normalized} already exists`)
      return
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
        } catch (createError: unknown) {
          const statusCode = this.getStatusCode(createError)
          if (statusCode === 409) {
            console.log(`[K8s] Namespace ${normalized} already exists (concurrent creation)`)
            // 即使 409，也要验证一下是否真的存在
            try {
              await this.coreApi.readNamespace({ name: normalized })
              console.log(`[K8s] ✅ Verified namespace ${normalized} exists after 409`)
            } catch (verifyError: unknown) {
              console.error(`[K8s] ❌ Namespace ${normalized} returned 409 but still not accessible:`, verifyError)
              throw verifyError
            }
          } else {
            console.error(`[K8s] ❌ Failed to create namespace ${normalized}:`, createError)
            throw createError
          }
        }
      } else {
        console.error(`[K8s] ❌ Error reading namespace ${normalized}:`, error)
        throw error
      }
    }
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
        ports
      }
    }

    const legacyPort = parsePort(rawConfig)
    if (!legacyPort) {
      return null
    }

    return {
      serviceType,
      ports: [legacyPort]
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
    return volumes.map((v, i) => ({
      name: `volume-${i}`,
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
    // 所有卷都使用 shared-nfs-pvc
    return volumes.map((v, i) => ({
      name: `volume-${i}`,
      persistentVolumeClaim: {
        claimName: 'shared-nfs-pvc'
      }
    }))
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
    const primaryEnv = candidate.containers[0]?.env ?? {}
    const envVars = Object.fromEntries(
      Object.entries(primaryEnv).filter(([key, value]) => key && typeof value === 'string' && value.length)
    )

    const volumes = candidate.volumes
      .filter((volume) => volume.containerPath)
      .map((volume) => ({
        container_path: volume.containerPath,
        ...(volume.hostPath ? { host_path: volume.hostPath } : {}),
        ...(volume.readOnly ? { read_only: true } : {})
      }))

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
  ): Array<{ containerPath: string; hostPath?: string; readOnly?: boolean }> {
    const mounts = container.volumeMounts ?? []
    if (mounts.length === 0) {
      return []
    }

    const volumes = templateSpec.volumes ?? []

    return mounts.map((mount) => {
      const matchedVolume = volumes.find((volume) => volume.name === mount.name)
      const hostPath = matchedVolume?.hostPath?.path

      return {
        containerPath: mount.mountPath,
        hostPath: hostPath || undefined,
        readOnly: mount.readOnly || undefined
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

  private toMatchedService(
    service: k8s.V1Service,
    containers: k8s.V1Container[]
  ): { name: string; type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName'; ports: Array<{ name?: string; port: number; targetPort: number; protocol: 'TCP' | 'UDP'; nodePort?: number }> } | null {
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

    return {
      name: service.metadata?.name ?? 'service',
      type: this.normalizeServiceType(service.spec?.type),
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
    services: Array<{ name: string; type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName'; ports: Array<{ name?: string; port: number; targetPort: number; protocol: 'TCP' | 'UDP'; nodePort?: number }> }>
  ): NetworkConfigV2 | null {
    if (!services.length) {
      return null
    }

    const serviceType = services[0]?.type ?? 'ClusterIP'
    const ports = services.flatMap((service) =>
      service.ports.map((port) => ({
        container_port: port.targetPort,
        service_port: port.port,
        protocol: port.protocol,
        node_port: port.nodePort
      }))
    )

    const validPorts = ports.filter((port) => Number.isInteger(port.container_port) && port.container_port > 0)

    if (!validPorts.length) {
      return null
    }

    return {
      service_type: serviceType === 'NodePort' || serviceType === 'LoadBalancer' ? serviceType : 'ClusterIP',
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

  private async createServiceFromConfig(
    service: Service,
    namespace: string,
    config: NormalizedNetworkConfig
  ) {
    if (!config.ports.length) {
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

    const k8sService: k8s.V1Service = {
      metadata: {
        name: service.name,
        labels: { app: service.name }
      },
      spec: {
        selector: { app: service.name },
        ports,
        type: config.serviceType
      }
    }

    try {
      await this.coreApi.createNamespacedService({ namespace, body: k8sService })
    } catch (error: unknown) {
      if (this.getStatusCode(error) === 409) {
        await this.coreApi.replaceNamespacedService({ 
          name: service.name, 
          namespace, 
          body: k8sService 
        })
      }
    }
  }
}

export const k8sService = new K8sService()
