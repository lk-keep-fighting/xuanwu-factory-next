import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { k8sService } from '@/lib/k8s'
import { ServiceType, type Service, type ApplicationService } from '@/types/project'

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

type DeployRequestPayload = {
  service_image_id?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let requestedServiceImageId: string | null = null

  try {
    const rawBody = await request.json()
    if (rawBody && typeof rawBody === 'object') {
      const candidate = (rawBody as DeployRequestPayload).service_image_id
      if (typeof candidate === 'string' && candidate.trim()) {
        requestedServiceImageId = candidate.trim()
      }
    }
  } catch {
    // ignore non-JSON payloads
  }

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

    const { project: projectMeta, ...serviceWithoutProject } = serviceRecord
    const namespace = projectMeta?.identifier?.trim()

    if (!namespace) {
      return NextResponse.json({ error: '项目缺少编号，无法部署' }, { status: 400 })
    }

    let serviceImageId = requestedServiceImageId
    let selectedServiceImage: Awaited<ReturnType<typeof prisma.serviceImage.findUnique>> | null = null

    const isApplicationService = (serviceRecord.type ?? '').toLowerCase() === ServiceType.APPLICATION

    if (isApplicationService) {
      if (serviceImageId) {
        selectedServiceImage = await prisma.serviceImage.findUnique({ where: { id: serviceImageId } })

        if (!selectedServiceImage || selectedServiceImage.service_id !== id) {
          return NextResponse.json({ error: '镜像不存在' }, { status: 404 })
        }

        if ((selectedServiceImage.build_status ?? '').toLowerCase() !== 'success') {
          return NextResponse.json({ error: '仅可部署构建成功的镜像版本' }, { status: 400 })
        }
      } else if (!serviceWithoutProject.built_image) {
        selectedServiceImage = await prisma.serviceImage.findFirst({
          where: {
            service_id: id,
            build_status: 'success',
            is_active: true
          },
          orderBy: { updated_at: 'desc' }
        })

        if (!selectedServiceImage) {
          return NextResponse.json({ error: '请先构建镜像并选择要部署的版本。' }, { status: 400 })
        }

        serviceImageId = selectedServiceImage.id
      } else {
        if (isApplicationService && (serviceWithoutProject as unknown as ApplicationService).built_image) {
          selectedServiceImage = await prisma.serviceImage.findFirst({
            where: {
              service_id: id,
              full_image: (serviceWithoutProject as unknown as ApplicationService).built_image!
            }
          })
        }

        if (selectedServiceImage) {
          serviceImageId = selectedServiceImage.id
        }
      }

      if (selectedServiceImage) {
        const currentBuiltImage = isApplicationService ? (serviceWithoutProject as unknown as ApplicationService).built_image : null
        const needsBuiltImageSync = currentBuiltImage !== selectedServiceImage.full_image
        const needsActivation = !selectedServiceImage.is_active

        if (needsBuiltImageSync || needsActivation) {
          try {
            await prisma.$transaction([
              prisma.serviceImage.updateMany({
                where: { service_id: id, id: { not: selectedServiceImage.id } },
                data: { is_active: false }
              }),
              prisma.serviceImage.update({
                where: { id: selectedServiceImage.id },
                data: { is_active: true }
              }),
              prisma.service.update({
                where: { id },
                data: { built_image: selectedServiceImage.full_image }
              })
            ])

            selectedServiceImage = {
              ...selectedServiceImage,
              is_active: true
            }

            serviceWithoutProject.built_image = selectedServiceImage.full_image
          } catch (syncError) {
            console.error('[Services][Deploy] 同步镜像状态失败:', syncError)
            return NextResponse.json({ error: '同步镜像状态失败，请稍后重试。' }, { status: 500 })
          }
        } else {
          if (isApplicationService) {
            (serviceWithoutProject as unknown as ApplicationService).built_image = selectedServiceImage.full_image
          }
        }
      } else if (isApplicationService && !(serviceWithoutProject as unknown as ApplicationService).built_image) {
        return NextResponse.json({ error: '请先构建镜像后再部署。' }, { status: 400 })
      }
    }

    const typedService = JSON.parse(JSON.stringify(serviceWithoutProject)) as Service

    if (isApplicationService && !(typedService as unknown as ApplicationService).built_image) {
      return NextResponse.json({ error: '请先构建镜像后再部署。' }, { status: 400 })
    }

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

    const deploymentImageTag = resolveDeploymentTag(typedService)
    let deploymentRecordId: string | null = null

    try {
      const deploymentRecord = await prisma.deployment.create({
        data: {
          service_id: id,
          status: 'building',
          image_tag: deploymentImageTag ?? undefined,
          ...(serviceImageId ? { service_image_id: serviceImageId } : {})
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
