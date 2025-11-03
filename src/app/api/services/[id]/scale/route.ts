import { NextRequest, NextResponse } from 'next/server'
import { k8sService } from '@/lib/k8s'
import { supabase } from '@/lib/supabase'

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
    // 获取服务信息
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('name, project:projects(identifier)')
      .eq('id', id)
      .single()

    if (serviceError || !service) {
      return NextResponse.json(
        { error: '服务不存在' },
        { status: 404 }
      )
    }

    const namespace = (service.project as { identifier?: string })?.identifier?.trim()

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
    await supabase
      .from('services')
      .update({ replicas })
      .eq('id', id)

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
