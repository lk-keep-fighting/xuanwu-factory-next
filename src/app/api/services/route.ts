import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { INVALID_SERVICE_TYPE_MESSAGE, isAllServiceTypeFilter, normalizeServiceType } from './service-type'

const DEFAULT_CREATE_ERROR_MESSAGE = '服务创建失败，请稍后重试。'

type SupabaseError = {
  message?: string | null
  details?: string | null
  hint?: string | null
  code?: string | null
  status?: number
  statusText?: string | null
}

const normalizeSupabaseError = (error: SupabaseError | null | undefined) => {
  const statusFromError = typeof error?.status === 'number' ? error.status : undefined
  let status = statusFromError && statusFromError >= 400 && statusFromError <= 599 ? statusFromError : 500

  if (error?.code === '23505') {
    status = 409
  } else if (error?.code === '23503') {
    status = 400
  }

  const messageCandidates = [error?.message, error?.details, error?.hint, error?.statusText]
    .map(value => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)

  if (messageCandidates.some(value => value.toLowerCase().includes('fetch failed') || value.toLowerCase().includes('bad gateway'))) {
    return {
      status: 502,
      message: '后端服务暂时不可用，请稍后重试。'
    }
  }

  if (status === 502 || status === 503) {
    return {
      status,
      message: '后端服务暂时不可用，请稍后重试。'
    }
  }

  let message = messageCandidates[0]

  if (error?.code === '23505') {
    message = '服务名称已存在，请更换其他名称。'
  } else if (error?.code === '23503') {
    message = '关联的项目不存在或已被删除。'
  }

  if (!message) {
    message = DEFAULT_CREATE_ERROR_MESSAGE
  }

  return { status, message }
}

const normalizeUnknownError = (error: unknown) => {
  if (error instanceof Error) {
    const raw = error.message.trim()
    const normalized = raw.toLowerCase()

    if (
      normalized.includes('fetch failed') ||
      normalized.includes('bad gateway') ||
      normalized.includes('unexpected end of json')
    ) {
      return {
        status: 502,
        message: '服务暂时不可用，请稍后重试。'
      }
    }

    if (raw) {
      return { status: 500, message: raw }
    }
  }

  return { status: 500, message: DEFAULT_CREATE_ERROR_MESSAGE }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const projectId = searchParams.get('project_id')
  const typeParam = searchParams.get('type')
  const normalizedType = typeParam ? normalizeServiceType(typeParam) : null
  const ignoreTypeFilter = typeParam ? isAllServiceTypeFilter(typeParam) : false

  if (typeParam && !normalizedType && !ignoreTypeFilter) {
    return NextResponse.json(
      { error: INVALID_SERVICE_TYPE_MESSAGE },
      { status: 400 }
    )
  }

  let query = supabase.from('services').select('*')

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  if (normalizedType) {
    query = query.eq('type', normalizedType)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
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

  const body = rawBody as Record<string, unknown>
  const normalizedType = normalizeServiceType(body.type)

  if (!normalizedType) {
    return NextResponse.json(
      { error: INVALID_SERVICE_TYPE_MESSAGE },
      { status: 400 }
    )
  }

  const payload = {
    ...body,
    type: normalizedType
  }

  try {
    const { data, error, status } = await supabase
      .from('services')
      .insert(payload)
      .select()
      .single()

    if (error) {
      const { status: normalizedStatus, message } = normalizeSupabaseError({ ...error, status })
      return NextResponse.json({ error: message }, { status: normalizedStatus })
    }

    if (!data) {
      return NextResponse.json({ error: DEFAULT_CREATE_ERROR_MESSAGE }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('[Services][POST] 创建服务失败:', error)
    const { status, message } = normalizeUnknownError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
