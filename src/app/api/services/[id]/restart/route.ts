import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { k8sService } from '@/lib/k8s'

/**
 * 重启服务
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
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
        { error: '项目缺少编号，无法重启服务' },
        { status: 400 }
      )
    }

    if (!service.name) {
      return NextResponse.json(
        { error: '服务名称缺失' },
        { status: 400 }
      )
    }

    // 重启 K8s 服务
    const result = await k8sService.restartService(service.name, namespace)
    
    // 更新数据库状态
    await supabase
      .from('services')
      .update({ status: 'pending' })
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
