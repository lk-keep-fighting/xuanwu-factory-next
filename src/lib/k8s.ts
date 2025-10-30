import * as k8s from '@kubernetes/client-node'
import type { Service, ApplicationService, DatabaseService, ComposeService } from '@/types/project'

class K8sService {
  private kc: k8s.KubeConfig
  private appsApi: k8s.AppsV1Api
  private coreApi: k8s.CoreV1Api

  constructor() {
    this.kc = new k8s.KubeConfig()
    
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
      try {
        this.kc.loadFromDefault()
        console.log('[K8s] 配置加载成功，集群:', this.kc.getCurrentCluster()?.name || '未知')
      } catch (error: any) {
        console.error('[K8s] ⚠️  配置加载失败:', error.message)
        console.error('[K8s] ⚠️  所有 K8s 操作将会失败！请配置 kubeconfig')
      }
    }
    
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api)
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api)
  }

  /**
   * 部署服务到 Kubernetes
   */
  async deployService(service: Service) {
    const namespace = 'default'
    
    // 获取replicas值，根据不同类型处理
    let replicas = 1
    if (service.type === 'application' || service.type === 'compose') {
      replicas = (service as ApplicationService | ComposeService).replicas || 1
    }
    
    // 使用 network_config 获取端口
    const containerPort = service.network_config?.container_port
    
    const deployment: k8s.V1Deployment = {
      metadata: {
        name: service.name,
        labels: { app: service.name }
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
              ports: containerPort ? [{ containerPort }] : undefined,
              env: this.buildEnvVars(service.env_vars),
              resources: this.buildResources(service.resource_limits),
              volumeMounts: this.buildVolumeMounts(service.volumes)
            }],
            volumes: this.buildVolumes(service.volumes)
          }
        }
      }
    }

    try {
      await this.appsApi.createNamespacedDeployment({ namespace, body: deployment })
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        await this.appsApi.replaceNamespacedDeployment({ 
          name: service.name, 
          namespace, 
          body: deployment 
        })
      } else {
        throw error
      }
    }

    // 使用 network_config 创建 K8s Service
    if (service.network_config) {
      await this.createServiceFromConfig(service, namespace)
    }

    return { success: true }
  }

  /**
   * 停止服务（将副本数设为 0）
   */
  async stopService(serviceName: string) {
    const namespace = 'default'
    
    try {
      const deployment = await this.appsApi.readNamespacedDeployment({ name: serviceName, namespace })
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
        namespace,
        body: updatedDeployment as k8s.V1Deployment
      })
      
      return { success: true, message: '服务已停止' }
    } catch (error: any) {
      console.error('Failed to stop service:', error)
      throw new Error(`停止服务失败: ${error.message}`)
    }
  }

  /**
   * 启动服务（恢复副本数）
   */
  async startService(serviceName: string) {
    const namespace = 'default'
    
    try {
      const deployment = await this.appsApi.readNamespacedDeployment({ name: serviceName, namespace })
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
        namespace,
        body: updatedDeployment as k8s.V1Deployment
      })
      
      return { success: true, message: '服务已启动' }
    } catch (error: any) {
      console.error('Failed to start service:', error)
      throw new Error(`启动服务失败: ${error.message}`)
    }
  }

  /**
   * 重启服务（重建所有 Pod）
   */
  async restartService(serviceName: string) {
    const namespace = 'default'
    
    try {
      console.log(`[K8s] 尝试重启服务: ${serviceName}`)
      
      const deployment = await this.appsApi.readNamespacedDeployment({ name: serviceName, namespace })
      
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
        namespace,
        body: updatedDeployment as k8s.V1Deployment
      })
      
      console.log(`[K8s] ✅ 服务 ${serviceName} 重启成功`)
      return { success: true, message: '服务正在重启' }
    } catch (error: any) {
      console.error(`[K8s] ❌ 重启服务失败: ${serviceName}`, error)
      throw new Error(`重启服务失败: ${error.message}`)
    }
  }

  /**
   * 扩缩容服务
   */
  async scaleService(serviceName: string, replicas: number) {
    const namespace = 'default'
    
    try {
      const deployment = await this.appsApi.readNamespacedDeployment({ name: serviceName, namespace })
      
      const updatedDeployment = {
        ...deployment,
        spec: {
          ...deployment.spec,
          replicas
        }
      }
      
      await this.appsApi.replaceNamespacedDeployment({
        name: serviceName,
        namespace,
        body: updatedDeployment as k8s.V1Deployment
      })
      
      return { success: true, message: `服务已扩缩至 ${replicas} 个副本` }
    } catch (error: any) {
      console.error('Failed to scale service:', error)
      throw new Error(`扩缩容失败: ${error.message}`)
    }
  }

  /**
   * 删除服务
   */
  async deleteService(serviceName: string) {
    const namespace = 'default'
    
    try {
      await this.appsApi.deleteNamespacedDeployment({ name: serviceName, namespace })
      await this.coreApi.deleteNamespacedService({ name: serviceName, namespace })
      return { success: true, message: '服务已删除' }
    } catch (error: any) {
      console.error('Failed to delete K8s resources:', error)
      throw new Error(`删除服务失败: ${error.message}`)
    }
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus(serviceName: string) {
    const namespace = 'default'
    
    try {
      const deployment = await this.appsApi.readNamespacedDeployment({ name: serviceName, namespace })
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
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return { status: 'error' as const, error: '服务不存在' }
      }
      return { status: 'error' as const, error: error.message }
    }
  }

  /**
   * 获取服务日志
   */
  async getServiceLogs(serviceName: string, lines: number = 100) {
    const namespace = 'default'
    
    try {
      const pods = await this.coreApi.listNamespacedPod({
        namespace,
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
        namespace,
        tailLines: lines
      })
      
      return { logs }
    } catch (error: any) {
      console.error('Failed to get service logs:', error)
      return { logs: '', error: error.message }
    }
  }

  /**
   * 获取服务事件
   */
  async getServiceEvents(serviceName: string) {
    const namespace = 'default'
    
    try {
      const events = await this.coreApi.listNamespacedEvent({
        namespace,
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
    } catch (error: any) {
      console.error('Failed to get service events:', error)
      return { events: [], error: error.message }
    }
  }
  
  private getImage(service: Service): string {
    if (service.type === 'application') {
      return (service as ApplicationService).built_image || 'nginx:latest'
    } else if (service.type === 'database') {
      const dbService = service as DatabaseService
      const version = dbService.version || 'latest'
      return `${dbService.database_type}:${version}`
    } else {
      const composeService = service as ComposeService
      return `${composeService.image}:${composeService.tag || 'latest'}`
    }
  }

  private buildEnvVars(envVars?: Record<string, string>): k8s.V1EnvVar[] {
    if (!envVars) return []
    return Object.entries(envVars).map(([name, value]) => ({
      name,
      value: String(value)
    }))
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

  private buildVolumeMounts(volumes?: Array<{ host_path?: string; container_path: string; read_only?: boolean }>): k8s.V1VolumeMount[] | undefined {
    if (!volumes || volumes.length === 0) return undefined
    return volumes.map((v, i) => ({
      name: `volume-${i}`,
      mountPath: v.container_path,
      readOnly: v.read_only
    }))
  }

  private buildVolumes(volumes?: Array<{ host_path?: string; container_path: string }>): k8s.V1Volume[] | undefined {
    if (!volumes || volumes.length === 0) return undefined
    return volumes.map((v, i) => ({
      name: `volume-${i}`,
      ...(v.host_path && {
        hostPath: {
          path: v.host_path
        }
      })
    }))
  }

  private async createServiceFromConfig(service: Service, namespace: string) {
    const config = service.network_config!
    
    const k8sService: k8s.V1Service = {
      metadata: {
        name: service.name,
        labels: { app: service.name }
      },
      spec: {
        selector: { app: service.name },
        ports: [{
          name: 'main',
          port: config.service_port || config.container_port,
          targetPort: config.container_port as any,
          protocol: config.protocol || 'TCP',
          ...(config.service_type === 'NodePort' && config.node_port && { nodePort: config.node_port })
        }],
        type: config.service_type || 'ClusterIP'
      }
    }

    try {
      await this.coreApi.createNamespacedService({ namespace, body: k8sService })
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
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
