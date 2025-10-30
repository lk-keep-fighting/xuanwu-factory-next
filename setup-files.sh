#!/bin/bash

# 1. 更新 .env.local
cat > .env.local << 'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=http://192.168.154.154:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
ENVEOF

# 2. 更新 src/lib/supabase.ts
cat > src/lib/supabase.ts << 'SUPAEOF'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})
SUPAEOF

# 3. 创建 K8s 工具类
cat > src/lib/k8s.ts << 'K8SEOF'
import * as k8s from '@kubernetes/client-node'
import type { Service } from '@/types/project'

export class K8sService {
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
    
    const deployment: k8s.V1Deployment = {
      metadata: {
        name: service.name,
        labels: { app: service.name }
      },
      spec: {
        replicas: service.replicas || 1,
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
              ports: service.port ? [{ containerPort: service.port }] : undefined,
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
      await this.appsApi.createNamespacedDeployment(namespace, deployment)
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        await this.appsApi.replaceNamespacedDeployment(
          service.name,
          namespace,
          deployment
        )
      } else {
        throw error
      }
    }

    if (service.port) {
      await this.createService(service, namespace)
    }

    return { success: true }
  }

  private getImage(service: Service): string {
    if (service.type === 'application') {
      return service.built_image || 'nginx:latest'
    } else if (service.type === 'database') {
      const version = service.version || 'latest'
      return `${service.database_type}:${version}`
    } else {
      return `${service.image}:${service.tag || 'latest'}`
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

  private async createService(service: Service, namespace: string) {
    const k8sService: k8s.V1Service = {
      metadata: {
        name: service.name,
        labels: { app: service.name }
      },
      spec: {
        selector: { app: service.name },
        ports: [{
          port: service.port!,
          targetPort: service.port as any
        }],
        type: 'ClusterIP'
      }
    }

    try {
      await this.coreApi.createNamespacedService(namespace, k8sService)
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        await this.coreApi.replaceNamespacedService(
          service.name,
          namespace,
          k8sService
        )
      }
    }
  }

  async deleteService(serviceName: string) {
    const namespace = 'default'
    
    try {
      await this.appsApi.deleteNamespacedDeployment(serviceName, namespace)
      await this.coreApi.deleteNamespacedService(serviceName, namespace)
    } catch (error) {
      console.error('Failed to delete K8s resources:', error)
    }
  }

  async getServiceStatus(serviceName: string) {
    const namespace = 'default'
    
    try {
      const deployment = await this.appsApi.readNamespacedDeployment(serviceName, namespace)
      const availableReplicas = deployment.body.status?.availableReplicas || 0
      const replicas = deployment.body.spec?.replicas || 0
      
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
K8SEOF

echo "✅ 核心文件创建完成"
