import type { Project } from '@/types/project'

const API_BASE = '/api/projects'

/**
 * 项目管理服务
 */
export const projectSvc = {
  /**
   * 创建项目
   */
  async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create project')
    }
    
    return response.json()
  },

  /**
   * 获取项目列表
   */
  async getProjects(): Promise<Project[]> {
    const response = await fetch(API_BASE)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch projects')
    }
    
    return response.json()
  },

  /**
   * 根据 ID 获取项目
   */
  async getProjectById(id: string): Promise<Project | null> {
    const response = await fetch(`${API_BASE}/${id}`)
    
    if (!response.ok) {
      if (response.status === 404) return null
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch project')
    }
    
    return response.json()
  },

  /**
   * 更新项目
   */
  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update project')
    }
    
    return response.json()
  },

  /**
   * 删除项目
   */
  async deleteProject(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete project')
    }
  },

  /**
   * 根据名称搜索项目
   */
  async searchProjects(keyword: string): Promise<Project[]> {
    const response = await fetch(`${API_BASE}?search=${encodeURIComponent(keyword)}`)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to search projects')
    }
    
    return response.json()
  }
}
