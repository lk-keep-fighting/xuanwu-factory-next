/**
 * 玄武AI诊断服务
 */

const XUANWU_AI_BASE_URL = process.env.NEXT_PUBLIC_XUANWU_AI_BASE_URL || process.env.XUANWU_AI_BASE_URL || 'http://ai-debug.xuanwu-factory.dev.aimstek.cn'
const DEFAULT_CALLBACK_URL = 'http://api-adapter.xuanwu-factory.dev.aimstek.cn/logic/ai-debug-callback'

/**
 * 创建AI诊断任务的请求参数
 */
export interface CreateAiDiagnosticTaskRequest {
  namespace: string
  pod: string
  repo_url?: string
  branch?: string
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
  async createDiagnosticTask(params: CreateAiDiagnosticTaskRequest): Promise<AiDiagnosticTaskResponse> {
    // 如果没有提供callback_url，使用默认值
    const requestParams = {
      ...params,
      callback_url: params.callback_url || DEFAULT_CALLBACK_URL
    }

    const response = await fetch(`${XUANWU_AI_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestParams)
    })

    if (!response.ok) {
      let errorMessage = '创建AI诊断任务失败'
      
      try {
        const errorData = await response.json()
        if (errorData.message) {
          errorMessage = errorData.message
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }
      
      throw new Error(errorMessage)
    }

    const result = await response.json()
    return result as AiDiagnosticTaskResponse
  },

  /**
   * 检查玄武AI服务是否可用
   */
  async checkServiceAvailability(): Promise<{ available: boolean; error?: string }> {
    try {
      const response = await fetch(`${XUANWU_AI_BASE_URL}/health`, {
        method: 'GET',
        timeout: 5000 // 5秒超时
      } as RequestInit)

      if (response.ok) {
        return { available: true }
      } else {
        return {
          available: false,
          error: `服务不可用 (HTTP ${response.status})`
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