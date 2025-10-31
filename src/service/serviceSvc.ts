import type { Service, CreateServiceRequest, UpdateServiceRequest, Deployment } from '@/types/project'

const API_BASE = '/api/services'

type DeleteServiceResult = {
  success: boolean
  message?: string
  warning?: string
}

/**
 * 服务管理
 */
export const serviceSvc = {
  /**
   * 创建服务（Application/Database/Compose）
   */
  async createService(service: CreateServiceRequest): Promise<Service> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(service)
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create service')
    }
    
    return response.json()
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
  async deployService(id: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${API_BASE}/${id}/deploy`, {
      method: 'POST'
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error((result as { error?: string }).error || 'Failed to deploy service')
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
  }
}
