import { NextRequest, NextResponse } from 'next/server'
import { k8sService } from '@/lib/k8s'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: '服务 ID 不能为空' },
        { status: 400 }
      )
    }

    // 查询服务信息和所属项目
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            identifier: true
          }
        }
      }
    })

    if (!service) {
      return NextResponse.json(
        { error: '服务不存在' },
        { status: 404 }
      )
    }

    // namespace 使用项目的 identifier
    const namespace = service.project?.identifier || service.namespace || 'default'

    // 获取服务事件
    const result = await k8sService.getServiceEvents(service.name, namespace, 50)

    if (result.error) {
      return NextResponse.json(
        { 
          events: [],
          error: result.error,
          debug: {
            serviceName: service.name,
            namespace
          }
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      events: result.events,
      debug: {
        serviceName: service.name,
        namespace,
        totalEvents: result.events.length
      }
    })
  } catch (error: unknown) {
    console.error('[API] 获取服务事件失败:', error)
    const message = error instanceof Error ? error.message : '获取服务事件失败'
    return NextResponse.json(
      { error: message, events: [] },
      { status: 500 }
    )
  }
}
