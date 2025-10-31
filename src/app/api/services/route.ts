import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { INVALID_SERVICE_TYPE_MESSAGE, isAllServiceTypeFilter, normalizeServiceType } from './service-type'

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

  const { data, error } = await supabase
    .from('services')
    .insert(payload)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
