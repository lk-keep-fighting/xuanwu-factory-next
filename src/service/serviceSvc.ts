import type {
  Service,
  CreateServiceRequest,
  UpdateServiceRequest,
  Deployment,
  ServiceImageRecord,
  ServiceImageStatus
} from '@/types/project'
import type { K8sFileListResult, K8sServiceStatus } from '@/types/k8s'
import type { GitBranchListResult } from '@/types/system'
import type { ServiceDiagnostic } from '@/types/service-tabs'

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

type GetServiceImagesOptions = {
  page?: number
  pageSize?: number
  status?: ServiceImageStatus
}

type ServiceImagesListResponse = {
  items: ServiceImageRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
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
  async deleteService(
    id: string,
    options?: {
      mode?: 'deployment-only' | 'full'
    }
  ): Promise<DeleteServiceResult> {
    const normalizedMode = options?.mode === 'deployment-only' ? options.mode : undefined
    const query = normalizedMode ? `?mode=${normalizedMode}` : ''
    const url = `${API_BASE}/${id}${query}`

    const response = await fetch(url, {
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
  async getServiceImages(
    id: string,
    options: GetServiceImagesOptions = {}
  ): Promise<ServiceImagesListResponse> {
    const params = new URLSearchParams()

    if (typeof options.page === 'number' && Number.isFinite(options.page)) {
      params.set('page', String(options.page))
    }

    if (typeof options.pageSize === 'number' && Number.isFinite(options.pageSize)) {
      params.set('page_size', String(options.pageSize))
    }

    if (options.status) {
      params.set('status', options.status)
    }

    const query = params.toString()
    const url = `${API_BASE}/${id}/images${query ? `?${query}` : ''}`

    const response = await fetch(url)
    const result = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        result && typeof result === 'object' && 'error' in (result as Record<string, unknown>)
          ? ((result as { error?: string }).error || '获取镜像列表失败')
          : '获取镜像列表失败'
      throw new Error(message)
    }

    if (result && typeof result === 'object' && Array.isArray((result as { items?: unknown }).items)) {
      const payload = result as Partial<ServiceImagesListResponse>
      const items = Array.isArray(payload.items) ? payload.items : []
      const total = typeof payload.total === 'number' ? payload.total : items.length
      const page = typeof payload.page === 'number' ? payload.page : options.page ?? 1
      const pageSize = typeof payload.pageSize === 'number' ? payload.pageSize : options.pageSize ?? items.length
      const totalPages = typeof payload.totalPages === 'number'
        ? payload.totalPages
        : pageSize > 0
          ? Math.ceil(total / pageSize)
          : 0
      const hasNext = typeof payload.hasNext === 'boolean' ? payload.hasNext : page * pageSize < total
      const hasPrevious = typeof payload.hasPrevious === 'boolean' ? payload.hasPrevious : page > 1

      return {
        items,
        total,
        page,
        pageSize,
        totalPages,
        hasNext,
        hasPrevious
      }
    }

    const fallbackItems = Array.isArray(result) ? (result as ServiceImageRecord[]) : []
    const fallbackPageSize = options.pageSize ?? fallbackItems.length

    return {
      items: fallbackItems,
      total: fallbackItems.length,
      page: options.page ?? 1,
      pageSize: fallbackPageSize,
      totalPages: fallbackPageSize > 0 ? Math.ceil(fallbackItems.length / fallbackPageSize) : 0,
      hasNext: false,
      hasPrevious: (options.page ?? 1) > 1
    }
  },

  /**
   * 构建应用服务镜像
   */
  async buildApplicationService(id: string, payload?: { branch?: string; tag?: string; fullImage?: string }): Promise<BuildServiceResponse> {
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
   * 切换数据库服务外部访问能力
   */
  async toggleDatabaseExternalAccess(
    id: string,
    enabled: boolean
  ): Promise<{ service: Service; enabled: boolean; message?: string }> {
    const response = await fetch(`${API_BASE}/${id}/external-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
          ? ((payload as { error?: string }).error as string)
          : '外部访问配置更新失败'
      throw new Error(message)
    }

    const service =
      payload && typeof payload === 'object' && 'service' in payload
        ? ((payload as { service?: Service }).service ?? null)
        : null

    if (!service) {
      throw new Error('外部访问配置已更新，但返回数据格式无效。')
    }

    const message =
      payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string'
        ? ((payload as { message?: string }).message as string)
        : undefined

    const responseEnabled =
      payload && typeof payload === 'object' && typeof (payload as { enabled?: unknown }).enabled === 'boolean'
        ? ((payload as { enabled?: boolean }).enabled as boolean)
        : enabled

    return {
      service,
      enabled: responseEnabled,
      message
    }
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
  async getK8sServiceStatus(id: string): Promise<K8sServiceStatus> {
    const response = await fetch(`${API_BASE}/${id}/status`)
    let payload: unknown = null

    try {
      payload = await response.json()
    } catch (error) {
      if (!response.ok) {
        throw new Error('获取 Kubernetes 状态失败')
      }

      throw new Error('获取 Kubernetes 状态失败：返回数据格式无效')
    }

    if (!response.ok) {
      const message =
        payload &&
        typeof payload === 'object' &&
        'error' in (payload as Record<string, unknown>) &&
        typeof (payload as { error?: unknown }).error === 'string'
          ? ((payload as { error?: unknown }).error as string)
          : `请求失败（${response.status}）`

      throw new Error(message)
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('获取 Kubernetes 状态失败：返回数据格式无效')
    }

    return payload as K8sServiceStatus
  },

  /**
   * 获取服务容器中的文件列表
   */
  async listServiceFiles(serviceId: string, path: string = '/', options?: { signal?: AbortSignal }): Promise<K8sFileListResult> {
    const params = new URLSearchParams()
    if (typeof path === 'string') {
      params.set('path', path)
    }
    const query = params.toString()
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
    
    try {
      const response = await fetch(`${API_BASE}/${serviceId}/files${query ? `?${query}` : ''}`, {
        signal: options?.signal || controller.signal
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
            ? ((payload as { error?: string }).error as string)
            : '获取文件列表失败'
        throw new Error(message)
      }

      return (payload as K8sFileListResult) || { path: '/', parentPath: null, entries: [] }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('获取文件列表超时，请重试')
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  },

  /**
   * 上传文件到服务容器
   */
  async uploadServiceFile(serviceId: string, directoryPath: string, file: File | Blob): Promise<{ success: boolean; path?: string }> {
    const formData = new FormData()
    formData.append('path', directoryPath || '/')
    formData.append('file', file)

    // 创建超时控制器
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 120秒超时（2分钟）

    try {
      const response = await fetch(`${API_BASE}/${serviceId}/files`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
            ? ((payload as { error?: string }).error as string)
            : '上传文件失败'
        throw new Error(message)
      }

      return {
        success: Boolean((payload as { success?: boolean })?.success ?? true),
        path: (payload as { path?: string })?.path
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('上传超时，请检查文件大小或网络连接')
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  },

  /**
   * 获取文件下载链接
   */
  getServiceFileDownloadUrl(serviceId: string, filePath: string): string {
    const params = new URLSearchParams()
    params.set('path', filePath)
    const query = params.toString()
    return `${API_BASE}/${serviceId}/files/download${query ? `?${query}` : ''}`
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
  },

  /**
   * 获取服务Git仓库的分支列表
   */
  async getServiceBranches(serviceId: string, options?: { search?: string; perPage?: number }): Promise<GitBranchListResult> {
    const params = new URLSearchParams()
    if (options?.search) {
      params.set('search', options.search)
    }
    if (options?.perPage) {
      params.set('per_page', options.perPage.toString())
    }
    const query = params.toString()

    const response = await fetch(`${API_BASE}/${serviceId}/branches${query ? `?${query}` : ''}`)
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
          ? ((payload as { error?: string }).error as string)
          : '获取分支列表失败'
      throw new Error(message)
    }

    return payload as GitBranchListResult
  },

  /**
   * 获取服务诊断记录
   */
  async getServiceDiagnostics(serviceId: string): Promise<{ diagnostics: ServiceDiagnostic[] }> {
    const response = await fetch(`${API_BASE}/${serviceId}/diagnostics`)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { error?: string }).error || '获取诊断记录失败')
    }
    
    return response.json()
  },

  /**
   * 创建服务诊断记录
   */
  async createServiceDiagnostic(
    serviceId: string, 
    diagnostic: {
      conclusion: string
      diagnostician: string
      reportCategory: string
      reportDetail: string
      diagnosticTime?: string
    }
  ): Promise<{ diagnostic: ServiceDiagnostic }> {
    const response = await fetch(`${API_BASE}/${serviceId}/diagnostics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(diagnostic)
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { error?: string }).error || '创建诊断记录失败')
    }
    
    return response.json()
  }
}
