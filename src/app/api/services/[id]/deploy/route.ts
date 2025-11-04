import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { k8sService } from '@/lib/k8s'
import type { Service } from '@/types/project'

const resolveDeploymentTag = (service: Service): string | null => {
  switch (service.type) {
    case 'application':
      return service.built_image || service.git_branch || null
    case 'image':
      return service.tag ? `${service.image}:${service.tag}` : service.image
    case 'database':
      return service.version ? `${service.database_type}:${service.version}` : service.database_type
    default:
      return null
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const serviceRecord = await prisma.service.findUnique({
      where: { id },
      include: {
        project: {
          select: { identifier: true }
        }
      }
    })

    if (!serviceRecord) {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    const { project: projectMeta, ...serviceWithoutProject } = serviceRecord as Service & {
      project: { identifier?: string | null } | null
    }

    const namespace = projectMeta?.identifier?.trim()

    if (!namespace) {
      return NextResponse.json({ error: '项目缺少编号，无法部署' }, { status: 400 })
    }

    const typedService = serviceWithoutProject as Service

    try {
      await prisma.service.update({
        where: { id },
        data: { status: 'building' }
      })
    } catch (statusError: unknown) {
      console.error('[Services][Deploy] 无法更新服务状态为 building:', statusError)

      if (statusError instanceof Prisma.PrismaClientKnownRequestError && statusError.code === 'P2025') {
        return NextResponse.json({ error: '服务不存在' }, { status: 404 })
      }

      const message = statusError instanceof Error ? statusError.message : '更新服务状态失败'
      return NextResponse.json({ error: message }, { status: 500 })
    }

    let deploymentRecordId: string | null = null

    try {
      const deploymentRecord = await prisma.deployment.create({
        data: {
          service_id: id,
          status: 'building',
          image_tag: resolveDeploymentTag(typedService)
        }
      })

      deploymentRecordId = deploymentRecord.id
    } catch (deploymentError: unknown) {
      console.error('[Services][Deploy] 创建部署记录失败：', deploymentError)
    }

    try {
      await k8sService.deployService(typedService, namespace)

      await prisma.service.update({
        where: { id },
        data: { status: 'running' }
      })

      if (deploymentRecordId) {
        await prisma.deployment.update({
          where: { id: deploymentRecordId },
          data: {
            status: 'success',
            completed_at: new Date()
          }
        })
      }

      return NextResponse.json({ success: true, message: '部署成功' })
    } catch (k8sError: unknown) {
      const errorMessage =
        k8sError instanceof Error
          ? k8sError.message
          : typeof k8sError === 'string'
            ? k8sError
            : '部署失败'

      try {
        await prisma.service.update({
          where: { id },
          data: { status: 'error' }
        })
      } catch (statusUpdateError) {
        console.error('[Services][Deploy] 无法更新服务状态为 error:', statusUpdateError)
      }

      if (deploymentRecordId) {
        try {
          await prisma.deployment.update({
            where: { id: deploymentRecordId },
            data: {
              status: 'failed',
              build_logs: errorMessage,
              completed_at: new Date()
            }
          })
        } catch (updateError) {
          console.error('[Services][Deploy] 更新部署记录为失败状态时出错:', updateError)
        }
      }

      return NextResponse.json({ error: `部署失败: ${errorMessage}` }, { status: 500 })
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '部署过程出现异常'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
