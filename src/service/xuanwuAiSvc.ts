/**
 * 玄武AI诊断服务
 * 通过后端API调用，避免跨域问题
 */

/**
 * 创建AI诊断任务的请求参数
 */
export interface CreateAiDiagnosticTaskRequest {
  namespace: string
  pod: string
  callback_url?: string
}

/**
 * AI诊断任务响应
 */
export interface AiDiagnosticTaskResponse {
  task_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  message?: string
  created_at: string
}

/**
 * 玄武AI诊断服务
 */
export const xuanwuAiSvc = {
  /**
   * 创建AI诊断任务
   */
  async createDiagnosticTask(serviceId: string, params: CreateAiDiagnosticTaskRequest): Promise<AiDiagnosticTaskResponse> {
    const response = await fetch(`/api/services/${serviceId}/ai-diagnostic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      let errorMessage = '创建AI诊断任务失败'
      
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }
      
      throw new Error(errorMessage)
    }

    const result = await response.json()
    return result.data as AiDiagnosticTaskResponse
  },

  /**
   * 检查玄武AI服务是否可用
   */
  async checkServiceAvailability(serviceId: string): Promise<{ available: boolean; error?: string }> {
    try {
      const response = await fetch(`/api/services/${serviceId}/ai-diagnostic`, {
        method: 'GET'
      })

      const result = await response.json()
      
      if (result.success && result.available) {
        return { available: true }
      } else {
        return {
          available: false,
          error: result.error || '服务不可用'
        }
      }
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : '连接失败'
      }
    }
  }
}