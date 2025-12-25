import { NextRequest } from 'next/server'

/**
 * 开放API认证配置
 */
export interface OpenApiAuthConfig {
  apiKey: string
  allowedOrigins?: string[]
  rateLimit?: {
    windowMs: number
    maxRequests: number
  }
}

/**
 * 开放API认证结果
 */
export interface OpenApiAuthResult {
  success: boolean
  error?: string
  message?: string
}

/**
 * 验证开放API请求的认证信息
 */
export function validateOpenApiAuth(request: NextRequest): OpenApiAuthResult {
  // 获取API密钥
  const apiKey = request.headers.get('x-api-key')
  
  if (!apiKey) {
    return {
      success: false,
      error: 'Missing API key',
      message: '缺少API密钥，请在请求头中提供 x-api-key'
    }
  }

  // 验证API密钥
  const validApiKey = process.env.OPEN_API_KEY || 'default-api-key'
  if (apiKey !== validApiKey) {
    return {
      success: false,
      error: 'Invalid API key',
      message: 'API密钥无效'
    }
  }

  // 检查来源域名（可选）
  const origin = request.headers.get('origin')
  const allowedOrigins = process.env.OPEN_API_ALLOWED_ORIGINS?.split(',') || []
  
  if (allowedOrigins.length > 0 && origin && !allowedOrigins.includes(origin)) {
    return {
      success: false,
      error: 'Origin not allowed',
      message: '请求来源不被允许'
    }
  }

  return { success: true }
}

/**
 * 开放API错误响应格式
 */
export interface OpenApiErrorResponse {
  error: string
  message: string
  timestamp?: string
  path?: string
}

/**
 * 创建标准化的开放API错误响应
 */
export function createOpenApiErrorResponse(
  error: string,
  message: string,
  path?: string
): OpenApiErrorResponse {
  return {
    error,
    message,
    timestamp: new Date().toISOString(),
    path
  }
}

/**
 * 开放API成功响应格式
 */
export interface OpenApiSuccessResponse<T = any> {
  success: true
  data: T
  message?: string
  timestamp?: string
}

/**
 * 创建标准化的开放API成功响应
 */
export function createOpenApiSuccessResponse<T>(
  data: T,
  message?: string
): OpenApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  }
}

/**
 * 验证请求体中的必填字段
 */
export function validateRequiredFields(
  body: Record<string, any>,
  requiredFields: string[]
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = []
  
  for (const field of requiredFields) {
    if (!body[field] || (typeof body[field] === 'string' && !body[field].trim())) {
      missingFields.push(field)
    }
  }
  
  return {
    valid: missingFields.length === 0,
    missingFields
  }
}

/**
 * 验证字符串字段长度
 */
export function validateFieldLength(
  value: string,
  fieldName: string,
  maxLength: number
): { valid: boolean; error?: string } {
  if (value.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName}长度不能超过${maxLength}个字符`
    }
  }
  
  return { valid: true }
}

/**
 * 验证枚举值
 */
export function validateEnumValue(
  value: string,
  fieldName: string,
  validValues: string[]
): { valid: boolean; error?: string } {
  if (!validValues.includes(value)) {
    return {
      valid: false,
      error: `${fieldName}必须是以下值之一: ${validValues.join(', ')}`
    }
  }
  
  return { valid: true }
}

/**
 * 解析分页参数
 */
export function parsePaginationParams(request: NextRequest): {
  page: number
  limit: number
  skip: number
} {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const skip = (page - 1) * limit
  
  return { page, limit, skip }
}