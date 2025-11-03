import { NextRequest, NextResponse } from 'next/server'
import { k8sService } from '@/lib/k8s'
import { supabase } from '@/lib/supabase'
import type { Service } from '@/types/project'
import { INVALID_SERVICE_TYPE_MESSAGE, normalizeServiceType } from '../service-type'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let rawBody: unknown

  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: '请求体不是有效的 JSON 数据' }, { status: 400 })
  }

  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: '请求体格式不正确' }, { status: 400 })
  }

  const body = rawBody as Record<string, unknown>
  let payload: Record<string, unknown> = body

  if (Object.prototype.hasOwnProperty.call(body, 'type')) {
    const normalizedType = normalizeServiceType(body.type)

    if (!normalizedType) {
      return NextResponse.json(
        { error: INVALID_SERVICE_TYPE_MESSAGE },
        { status: 400 }
      )
    }

    payload = {
      ...body,
      type: normalizedType
    }
  }

  const { data, error } = await supabase
    .from('services')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: service, error: fetchError } = await supabase
    .from('services')
    .select('*, project:projects(identifier)')
    .eq('id', id)
    .single()

  if (fetchError) {
    const status = fetchError.code === 'PGRST116' ? 404 : 500
    const message = status === 404 ? '服务不存在' : (fetchError.message || '获取服务失败')
    return NextResponse.json({ error: message }, { status })
  }

  if (!service) {
    return NextResponse.json({ error: '服务不存在' }, { status: 404 })
  }

  const { project: projectMeta, ...serviceWithoutProject } = service as Service & {
    project?: { identifier?: string }
  }

  const namespace = projectMeta?.identifier?.trim()

  if (!namespace) {
    return NextResponse.json({ error: '项目缺少编号，无法删除服务' }, { status: 400 })
  }

  const serviceData = serviceWithoutProject as Service

  if (!serviceData.name) {
    return NextResponse.json({ error: '服务名称缺失，无法删除' }, { status: 400 })
  }

  let warning: string | undefined

  try {
    await k8sService.deleteService(serviceData.name, namespace)
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : String(error)

    const normalizedMessage = errorMessage.toLowerCase()
    const notFound =
      normalizedMessage.includes('not found') ||
      normalizedMessage.includes('404') ||
      normalizedMessage.includes('does not exist') ||
      normalizedMessage.includes('no matches') ||
      normalizedMessage.includes('不存在') ||
      normalizedMessage.includes('未找到')

    if (notFound) {
      warning = `Kubernetes 集群中未找到服务「${serviceData.name}」，已跳过集群资源清理。`

      if (errorMessage && errorMessage !== warning) {
        console.warn(`[Service Delete] Kubernetes 删除资源时未找到：${errorMessage}`)
      }
    } else {
      return NextResponse.json(
        { error: errorMessage || '删除 Kubernetes 资源失败' },
        { status: 500 }
      )
    }
  }

  const { error: deleteError } = await supabase
    .from('services')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: '服务已删除', warning })
}
