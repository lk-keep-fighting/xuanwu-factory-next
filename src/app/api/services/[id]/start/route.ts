import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { k8sService } from '@/lib/k8s'

/**
 * 启动服务
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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
        { error: '项目缺少编号，无法启动服务' },
        { status: 400 }
      )
    }

    if (!service.name) {
      return NextResponse.json(
        { error: '服务名称缺失' },
        { status: 400 }
      )
    }

    // 启动 K8s 服务
    const result = await k8sService.startService(service.name, namespace)

    // 更新数据库状态
    await prisma.service.update({
      where: { id },
      data: { status: 'pending' }
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
