import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ServicePayload,
  sanitizeServiceData,
  normalizePrismaError,
  normalizeUnknownError
} from './helpers'
import { INVALID_SERVICE_TYPE_MESSAGE, isAllServiceTypeFilter, normalizeServiceType } from './service-type'

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

    return NextResponse.json(services)
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

  const payload = sanitizeServiceData(body)
  payload.project_id = projectId
  payload.name = name
  payload.type = normalizedType

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
