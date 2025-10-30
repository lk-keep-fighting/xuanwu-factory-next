import type { Service, CreateServiceRequest, UpdateServiceRequest } from '@/types/project'

const API_BASE = '/api/services'

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
  async deleteService(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete service')
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
  async deployService(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}/deploy`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to deploy service')
    }
  }
}
