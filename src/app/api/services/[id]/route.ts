import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { k8sService } from '@/lib/k8s'
import { prisma } from '@/lib/prisma'
import type { Service } from '@/types/project'
import {
  ServicePayload,
  sanitizeServiceData,
  normalizePrismaError,
  normalizeUnknownError
} from '../helpers'
import { INVALID_SERVICE_TYPE_MESSAGE, normalizeServiceType } from '../service-type'

const UPDATE_ERROR_MESSAGE = '服务更新失败，请稍后重试。'
const DELETE_ERROR_MESSAGE = '删除服务失败'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const service = await prisma.service.findUnique({ where: { id } })

    if (!service) {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    return NextResponse.json(service)
  } catch (error: unknown) {
    console.error('[Services][GET] 获取服务失败:', error)
    const message = error instanceof Error ? error.message : '获取服务失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
  const updateData = sanitizeServiceData(body)

  if (Object.prototype.hasOwnProperty.call(body, 'type')) {
    const normalizedType = normalizeServiceType(body.type)

    if (!normalizedType) {
      return NextResponse.json(
        { error: INVALID_SERVICE_TYPE_MESSAGE },
        { status: 400 }
      )
    }

    updateData.type = normalizedType
  }

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: '服务名称不能为空' }, { status: 400 })
    }

    updateData.name = body.name.trim()
  }

  if (Object.prototype.hasOwnProperty.call(body, 'project_id')) {
    if (typeof body.project_id !== 'string' || !body.project_id.trim()) {
      return NextResponse.json({ error: '项目 ID 无效' }, { status: 400 })
    }

    updateData.project_id = body.project_id.trim()
  }

  const dataEntries = Object.entries(updateData).filter(([, value]) => value !== undefined)

  if (dataEntries.length === 0) {
    return NextResponse.json({ error: '未提供可更新的字段' }, { status: 400 })
  }

  const data = Object.fromEntries(dataEntries) as Prisma.ServiceUncheckedUpdateInput

  try {
    const service = await prisma.service.update({
      where: { id },
      data
    })

    return NextResponse.json(service)
  } catch (error: unknown) {
    console.error('[Services][PUT] 更新服务失败:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    const normalized = normalizePrismaError(error, {
      defaultMessage: UPDATE_ERROR_MESSAGE
    })

    if (normalized) {
      return NextResponse.json({ error: normalized.message }, { status: normalized.status })
    }

    const { status, message } = normalizeUnknownError(error, UPDATE_ERROR_MESSAGE)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let serviceWithProject: (Service & { project: { identifier: string | null } | null }) | null = null

  try {
    serviceWithProject = (await prisma.service.findUnique({
      where: { id },
      include: {
        project: {
          select: { identifier: true }
        }
      }
    })) as Service & { project: { identifier: string | null } | null }
  } catch (error: unknown) {
    console.error('[Services][DELETE] 获取服务失败:', error)
    const message = error instanceof Error ? error.message : DELETE_ERROR_MESSAGE
    return NextResponse.json({ error: message }, { status: 500 })
  }

  if (!serviceWithProject) {
    return NextResponse.json({ error: '服务不存在' }, { status: 404 })
  }

  const { project: projectMeta, ...serviceWithoutProject } = serviceWithProject
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

  try {
    await prisma.service.delete({ where: { id } })
  } catch (error: unknown) {
    console.error('[Services][DELETE] 删除服务失败:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    const message = error instanceof Error ? error.message : DELETE_ERROR_MESSAGE
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: '服务已删除', warning })
}
