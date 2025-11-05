import type { Service, CreateServiceRequest, UpdateServiceRequest, Deployment, ServiceImageRecord } from '@/types/project'

const API_BASE = '/api/services'

type DeleteServiceResult = {
  success: boolean
  message?: string
  warning?: string
}

type BuildServiceResponse = {
  success?: boolean
  image?: ServiceImageRecord
  service?: Service
  build?: {
    buildNumber?: number
    durationMs?: number
  }
}

/**
 * 服务管理
 */
export const serviceSvc = {
  /**
   * 创建服务（Application/Database/Image）
   */
  async createService(service: CreateServiceRequest): Promise<Service> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(service)
    })

    if (!response.ok) {
      let message = 'Failed to create service'
      let rawBody = ''

      try {
        rawBody = (await response.text()).trim()
      } catch (error) {
        console.error('[serviceSvc] Failed to read createService error response:', error)
      }

      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody) as { error?: unknown; message?: unknown }
          const parsedMessage = [parsed.error, parsed.message]
            .map(value => (typeof value === 'string' ? value.trim() : ''))
            .find(value => value.length > 0)

          message = parsedMessage || rawBody
        } catch {
          message = rawBody
        }
      } else if (response.status === 502 || response.status === 503) {
        message = '服务暂时不可用，请稍后重试。'
      } else {
        message = `请求失败（${response.status}）`
      }

      throw new Error(message)
    }

    try {
      return await response.json()
    } catch (error) {
      console.error('[serviceSvc] Failed to parse createService response:', error)
      throw new Error('服务已创建，但返回数据格式无效。')
    }
  },

  /**
   * 获取项目下的所有服务
   */
  async getServicesByProject(projectId: string): Promise<Service[]> {
    const response = await fetch(`${API_BASE}?project_id=${projectId}`)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch services')
    }
    
    return response.json()
  },

  /**
   * 根据 ID 获取服务
   */
  async getServiceById(id: string): Promise<Service | null> {
    const response = await fetch(`${API_BASE}/${id}`)
    
    if (!response.ok) {
      if (response.status === 404) return null
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch service')
    }
    
    return response.json()
  },

  /**
   * 更新服务
   */
  async updateService(id: string, service: Partial<UpdateServiceRequest>): Promise<Service> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(service)
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update service')
    }
    
    return response.json()
  },

  /**
   * 删除服务
   */
  async deleteService(id: string): Promise<DeleteServiceResult> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE'
    })

    const result = (await response.json().catch(() => ({}))) as Partial<DeleteServiceResult> & {
      error?: string
    }

    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete service')
    }

    if (result.success === false) {
      throw new Error(result.message || result.warning || 'Failed to delete service')
    }

    return {
      success: result.success ?? true,
      message: result.message,
      warning: result.warning
    }
  },

  /**
   * 批量删除服务
   */
  async deleteServices(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => this.deleteService(id)))
  },

  /**
   * 根据类型获取服务
   */
  async getServicesByType(projectId: string, type: string): Promise<Service[]> {
    const response = await fetch(`${API_BASE}?project_id=${projectId}&type=${type}`)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch services by type')
    }
    
    return response.json()
  },

  /**
   * 更新服务状态
   */
  async updateServiceStatus(id: string, status: 'pending' | 'running' | 'stopped' | 'error' | 'building'): Promise<Service> {
    const response = await fetch(`${API_BASE}/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update service status')
    }
    
    return response.json()
  },

  /**
   * 部署服务
   */
  async deployService(id: string, options?: { serviceImageId?: string }): Promise<{ success: boolean; message?: string }> {
    const init: RequestInit = { method: 'POST' }

    if (options?.serviceImageId) {
      init.headers = { 'Content-Type': 'application/json' }
      init.body = JSON.stringify({ service_image_id: options.serviceImageId })
    }

    const response = await fetch(`${API_BASE}/${id}/deploy`, init)
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error((result as { error?: string }).error || '部署失败')
    }

    return result as { success: boolean; message?: string }
  },

  /**
   * 停止服务
   */
  async stopService(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/${id}/stop`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to stop service')
    }
    
    return response.json()
  },

  /**
   * 启动服务
   */
  async startService(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/${id}/start`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to start service')
    }
    
    return response.json()
  },

  /**
   * 重启服务
   */
  async restartService(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/${id}/restart`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to restart service')
    }
    
    return response.json()
  },

  /**
   * 扩缩容服务
   */
  async scaleService(id: string, replicas: number): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/${id}/scale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replicas })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to scale service')
    }
    
    return response.json()
  },

  /**
   * 获取服务部署历史
   */
  async getServiceDeployments(id: string): Promise<Deployment[]> {
    const response = await fetch(`${API_BASE}/${id}/deployments`)
    const result = await response.json()

    if (!response.ok) {
      throw new Error((result as { error?: string }).error || 'Failed to fetch deployment history')
    }

    return result as Deployment[]
  },

  /**
   * 获取服务镜像列表
   */
  async getServiceImages(id: string): Promise<ServiceImageRecord[]> {
    const response = await fetch(`${API_BASE}/${id}/images`)
    const result = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        result && typeof result === 'object' && 'error' in (result as Record<string, unknown>)
          ? ((result as { error?: string }).error || '获取镜像列表失败')
          : '获取镜像列表失败'
      throw new Error(message)
    }

    return Array.isArray(result) ? (result as ServiceImageRecord[]) : []
  },

  /**
   * 构建应用服务镜像
   */
  async buildApplicationService(id: string, payload?: { branch?: string; tag?: string }): Promise<BuildServiceResponse> {
    const init: RequestInit = { method: 'POST' }

    if (payload && Object.keys(payload).length > 0) {
      init.headers = { 'Content-Type': 'application/json' }
      init.body = JSON.stringify(payload)
    }

    const response = await fetch(`${API_BASE}/${id}/build`, init)
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error((result as { error?: string }).error || '镜像构建失败')
    }

    return result as BuildServiceResponse
  },

  /**
   * 激活指定镜像
   */
  async activateServiceImage(serviceId: string, imageId: string): Promise<{ success: boolean; image?: ServiceImageRecord; service?: Service }> {
    const response = await fetch(`${API_BASE}/${serviceId}/images/${imageId}/activate`, {
      method: 'POST'
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error((result as { error?: string }).error || '镜像选择失败')
    }

    return result as { success: boolean; image?: ServiceImageRecord; service?: Service }
  },

  /**
   * 获取服务日志
   */
  async getServiceLogs(id: string, lines: number = 100): Promise<{ logs?: string; error?: string }> {
    const response = await fetch(`${API_BASE}/${id}/logs?lines=${lines}`)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get service logs')
    }
    
    return response.json()
  },

  /**
   * 获取服务实时状态（从 K8s）
   */
  async getK8sServiceStatus(id: string): Promise<unknown> {
    const service = await this.getServiceById(id)
    if (!service) throw new Error('服务不存在')
    
    const response = await fetch(`${API_BASE}/${id}/status`)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get service status')
    }
    
    return response.json()
  },

  /**
   * 获取服务的 Kubernetes YAML 配置
   */
  async getServiceYAML(id: string): Promise<string> {
    const response = await fetch(`${API_BASE}/${id}/yaml`)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { error?: string }).error || '获取 YAML 失败')
    }
    
    return response.text()
  }
}
