import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { k8sService } from '@/lib/k8s'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const service = await prisma.service.findUnique({
      where: { id },
      select: {
        name: true,
        status: true,
        project: {
          select: { identifier: true }
        }
      }
    })

    if (!service) {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    const namespace = service.project?.identifier?.trim()

    if (!namespace) {
      return NextResponse.json(
        { error: '项目缺少编号，无法获取 Kubernetes 状态' },
        { status: 400 }
      )
    }

    const serviceName = service.name?.trim()

    if (!serviceName) {
      return NextResponse.json(
        { error: '服务名称缺失，无法获取 Kubernetes 状态' },
        { status: 400 }
      )
    }

    const normalizedDbStatus = (service.status ?? '').trim().toLowerCase()
    const isPendingStatus = normalizedDbStatus.length === 0 || normalizedDbStatus === 'pending'

    if (isPendingStatus) {
      return NextResponse.json({
        status: 'pending',
        replicas: 0,
        availableReplicas: 0,
        readyReplicas: 0,
        updatedReplicas: 0,
        conditions: [],
        namespace,
        serviceName,
        dbStatus: service.status ?? null
      })
    }

    const statusResult = await k8sService.getServiceStatus(serviceName, namespace)

    // 自动同步K8s状态到数据库
    const k8sStatus = statusResult.status?.toLowerCase()?.trim()

    if (k8sStatus && k8sStatus !== normalizedDbStatus) {
      // 异步更新数据库状态，不阻塞响应
      prisma.service.update({
        where: { id },
        data: { status: k8sStatus }
      }).catch(error => {
        console.error('[Services][Status][GET] 同步状态到数据库失败:', error)
      })
    }

    return NextResponse.json({
      ...statusResult,
      namespace,
      serviceName,
      dbStatus: service.status ?? null
    })
  } catch (error: unknown) {
    console.error('[Services][Status][GET] 获取服务状态失败:', error)
    const message = error instanceof Error ? error.message : '获取服务状态失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { status } = body as { status?: string }

  if (!status) {
    return NextResponse.json({ error: 'Status is required' }, { status: 400 })
  }

  try {
    const service = await prisma.service.update({
      where: { id },
      data: { status }
    })

    return NextResponse.json(service)
  } catch (error: unknown) {
    console.error('[Services][Status] 更新服务状态失败:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    const message = error instanceof Error ? error.message : '更新服务状态失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
