import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { k8sService } from '@/lib/k8s'
import type { K8sImportRequest } from '@/types/k8s'
import {
  sanitizeServiceData,
  normalizePrismaError,
  normalizeUnknownError
} from '../../../services/helpers'

const IMPORT_ERROR_MESSAGE = '导入服务失败，请稍后重试。'

export async function POST(request: Request) {
  const payload = (await request.json()) as Partial<K8sImportRequest>

  const projectId = payload?.project_id
  const resource = payload?.resource

  if (!projectId || !resource?.name || !resource?.kind) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 })
  }

  const namespace = resource.namespace || 'default'
  const servicePayload = await k8sService.buildServicePayloadFromWorkload(
    projectId,
    namespace,
    resource.name,
    resource.kind
  )

  if (!servicePayload) {
    return NextResponse.json({ error: '无法从 Kubernetes 资源构建服务配置' }, { status: 422 })
  }

  let finalName = servicePayload.name
  let suffix = 1

  // 检查名称冲突，若存在则自动追加序号
  while (true) {
    const conflict = await prisma.service.findFirst({
      where: {
        project_id: projectId,
        name: finalName
      },
      select: { id: true }
    })

    if (!conflict) {
      break
    }

    finalName = `${servicePayload.name}-${suffix}`
    suffix += 1
  }

  const sanitizedPayload = sanitizeServiceData({
    ...servicePayload,
    project_id: projectId,
    name: finalName
  })

  sanitizedPayload.project_id = projectId
  sanitizedPayload.name = finalName

  try {
    const service = await prisma.service.create({
      data: sanitizedPayload as Prisma.ServiceUncheckedCreateInput
    })

    return NextResponse.json(service)
  } catch (error: unknown) {
    console.error('[K8s][Import] 导入服务失败:', error)

    const normalized = normalizePrismaError(error, {
      defaultMessage: IMPORT_ERROR_MESSAGE
    })

    if (normalized) {
      return NextResponse.json({ error: normalized.message }, { status: normalized.status })
    }

    const { status, message } = normalizeUnknownError(error, IMPORT_ERROR_MESSAGE)
    return NextResponse.json({ error: message }, { status })
  }
}
