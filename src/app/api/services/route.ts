import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ServiceType, SUPPORTED_DATABASE_TYPES, DATABASE_TYPE_METADATA } from '@/types/project'
import {
  ServicePayload,
  sanitizeServiceData,
  normalizePrismaError,
  normalizeUnknownError
} from './helpers'
import { INVALID_SERVICE_TYPE_MESSAGE, isAllServiceTypeFilter, normalizeServiceType } from './service-type'
import { normalizeDebugConfig, validateDebugConfig } from '@/lib/debug-tools-utils'

const DEFAULT_CREATE_ERROR_MESSAGE = '服务创建失败，请稍后重试。'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const projectId = searchParams.get('project_id')?.trim() || null
  const typeParam = searchParams.get('type')
  const normalizedType = typeParam ? normalizeServiceType(typeParam) : null
  const ignoreTypeFilter = typeParam ? isAllServiceTypeFilter(typeParam) : false

  if (typeParam && !normalizedType && !ignoreTypeFilter) {
    return NextResponse.json(
      { error: INVALID_SERVICE_TYPE_MESSAGE },
      { status: 400 }
    )
  }

  const where: Prisma.ServiceWhereInput = {}

  if (projectId) {
    where.project_id = projectId
  }

  if (normalizedType) {
    where.type = normalizedType
  }

  try {
    const services = await prisma.service.findMany({
      where,
      orderBy: { created_at: 'desc' }
    })

    // Normalize debug_config for backward compatibility
    const normalizedServices = services.map(service => {
      if (service.debug_config) {
        const normalizedDebugConfig = normalizeDebugConfig(service.debug_config)
        return {
          ...service,
          debug_config: normalizedDebugConfig as Prisma.JsonValue
        }
      }
      return service
    })

    return NextResponse.json(normalizedServices)
  } catch (error: unknown) {
    console.error('[Services][GET] Failed to fetch services:', error)
    const message = error instanceof Error ? error.message : '获取服务失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let rawBody: unknown

  try {
    rawBody = await request.json()
  } catch (error) {
    return NextResponse.json({ error: '请求体不是有效的 JSON 数据' }, { status: 400 })
  }

  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: '请求体格式不正确' }, { status: 400 })
  }

  const body = rawBody as ServicePayload
  const normalizedType = normalizeServiceType(body.type)

  if (!normalizedType) {
    return NextResponse.json(
      { error: INVALID_SERVICE_TYPE_MESSAGE },
      { status: 400 }
    )
  }

  const projectId = typeof body.project_id === 'string' ? body.project_id.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!projectId) {
    return NextResponse.json({ error: '项目 ID 无效' }, { status: 400 })
  }

  if (!name) {
    return NextResponse.json({ error: '服务名称不能为空' }, { status: 400 })
  }

  // Handle debug_config validation and normalization
  if (Object.prototype.hasOwnProperty.call(body, 'debug_config')) {
    const rawDebugConfig = body.debug_config
    
    // Normalize the config (handles legacy format conversion)
    const normalizedConfig = normalizeDebugConfig(rawDebugConfig)
    
    // Validate the normalized config
    const validation = validateDebugConfig(normalizedConfig)
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: '调试工具配置验证失败', 
          details: validation.errors 
        },
        { status: 400 }
      )
    }
    
    // Replace the raw config with the normalized version
    body.debug_config = normalizedConfig as Prisma.JsonValue | null
  }

  const payload = sanitizeServiceData(body)
  payload.project_id = projectId
  payload.name = name
  payload.type = normalizedType

  if (normalizedType === ServiceType.DATABASE) {
    const rawDatabaseType =
      typeof body.database_type === 'string' ? body.database_type.trim().toLowerCase() : ''
    const matchedDatabaseType = SUPPORTED_DATABASE_TYPES.find((type) => type === rawDatabaseType)

    if (!matchedDatabaseType) {
      return NextResponse.json(
        { error: '当前仅支持创建 MySQL 或 Redis 数据库服务。' },
        { status: 400 }
      )
    }

    payload.database_type = matchedDatabaseType

    const metadata = DATABASE_TYPE_METADATA[matchedDatabaseType]

    let normalizedPort: number
    if (typeof payload.port === 'number') {
      normalizedPort = payload.port
    } else if (typeof body.port === 'number') {
      normalizedPort = body.port
    } else if (typeof body.port === 'string') {
      const parsed = Number.parseInt(body.port, 10)
      normalizedPort = Number.isInteger(parsed) && parsed > 0 ? parsed : metadata.defaultPort
    } else {
      const parsedPayloadPort = Number(payload.port)
      normalizedPort = Number.isInteger(parsedPayloadPort) && parsedPayloadPort > 0 ? parsedPayloadPort : metadata.defaultPort
    }

    if (!Number.isInteger(normalizedPort) || normalizedPort <= 0) {
      normalizedPort = metadata.defaultPort
    }

    payload.port = normalizedPort

    if (typeof payload.volume_size !== 'string' || !payload.volume_size.trim()) {
      payload.volume_size = '10Gi'
    } else {
      payload.volume_size = payload.volume_size.trim()
    }

    if (!payload.network_config) {
      payload.network_config = {
        service_type: 'NodePort',
        ports: [
          {
            container_port: normalizedPort,
            service_port: normalizedPort,
            protocol: 'TCP'
          }
        ]
      } as Prisma.JsonValue
    }
  }

  try {
    const service = await prisma.service.create({
      data: payload as Prisma.ServiceUncheckedCreateInput
    })

    return NextResponse.json(service)
  } catch (error: unknown) {
    console.error('[Services][POST] 创建服务失败:', error)

    const normalized = normalizePrismaError(error, {
      defaultMessage: DEFAULT_CREATE_ERROR_MESSAGE
    })

    if (normalized) {
      return NextResponse.json({ error: normalized.message }, { status: normalized.status })
    }

    const { status, message } = normalizeUnknownError(error, DEFAULT_CREATE_ERROR_MESSAGE)
    return NextResponse.json({ error: message }, { status })
  }
}
