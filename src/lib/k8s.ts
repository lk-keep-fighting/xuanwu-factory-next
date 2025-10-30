import * as k8s from '@kubernetes/client-node'
import type { Service, ApplicationService, DatabaseService, ComposeService } from '@/types/project'

class K8sService {
  private kc: k8s.KubeConfig
  private appsApi: k8s.AppsV1Api
  private coreApi: k8s.CoreV1Api

  constructor() {
    this.kc = new k8s.KubeConfig()
    this.kc.loadFromDefault()
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api)
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api)
  }

  async deployService(service: Service) {
    const namespace = 'default'
    
    // 获取replicas值，根据不同类型处理
    let replicas = 1
    if (service.type === 'application' || service.type === 'compose') {
      replicas = (service as ApplicationService | ComposeService).replicas || 1
    }
    
    // 获取port值
    let containerPort: number | undefined
    if (service.type === 'application' || service.type === 'database') {
      containerPort = (service as ApplicationService | DatabaseService).port
    } else if (service.type === 'compose') {
      // Compose 服务可能有多个端口
      const ports = (service as ComposeService).ports
      if (ports && ports.length > 0) {
        containerPort = ports[0].container_port
      }
    }
    
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

    if (containerPort) {
      await this.createService(service, namespace, containerPort)
    }

    return { success: true }
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

  private async createService(service: Service, namespace: string, port: number) {
    const k8sService: k8s.V1Service = {
      metadata: {
        name: service.name,
        labels: { app: service.name }
      },
      spec: {
        selector: { app: service.name },
        ports: [{
          port,
          targetPort: port as any
        }],
        type: 'ClusterIP'
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

  async deleteService(serviceName: string) {
    const namespace = 'default'
    
    try {
      await this.appsApi.deleteNamespacedDeployment({ name: serviceName, namespace })
      await this.coreApi.deleteNamespacedService({ name: serviceName, namespace })
    } catch (error) {
      console.error('Failed to delete K8s resources:', error)
    }
  }

  async getServiceStatus(serviceName: string) {
    const namespace = 'default'
    
    try {
      const deployment = await this.appsApi.readNamespacedDeployment({ name: serviceName, namespace })
      const availableReplicas = deployment.status?.availableReplicas || 0
      const replicas = deployment.spec?.replicas || 0
      
      return {
        status: availableReplicas === replicas ? 'running' : 'pending',
        replicas,
        availableReplicas
      }
    } catch (error: any) {
      return { status: 'error', error: error.message }
    }
  }
}

export const k8sService = new K8sService()
