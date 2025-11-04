import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { k8sService } from '@/lib/k8s'

/**
 * 扩缩容服务
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { replicas } = await request.json()

  if (typeof replicas !== 'number' || replicas < 0) {
    return NextResponse.json(
      { error: '副本数必须是非负整数' },
      { status: 400 }
    )
  }

  try {
    const service = await prisma.service.findUnique({
      where: { id },
      select: {
        name: true,
        project: {
          select: { identifier: true }
        }
      }
    })

    if (!service) {
      return NextResponse.json(
        { error: '服务不存在' },
        { status: 404 }
      )
    }

    const namespace = service.project?.identifier?.trim()

    if (!namespace) {
      return NextResponse.json(
        { error: '项目缺少编号，无法调整副本数' },
        { status: 400 }
      )
    }

    if (!service.name) {
      return NextResponse.json(
        { error: '服务名称缺失' },
        { status: 400 }
      )
    }

    // 扩缩容 K8s 服务
    const result = await k8sService.scaleService(service.name, replicas, namespace)

    // 更新数据库中的副本数
    await prisma.service.update({
      where: { id },
      data: { replicas }
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
