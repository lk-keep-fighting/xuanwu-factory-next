import { NextRequest, NextResponse } from 'next/server'
import { k8sService } from '@/lib/k8s'
import { supabase } from '@/lib/supabase'

/**
 * 获取服务日志
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const lines = parseInt(searchParams.get('lines') || '100')
  
  try {
    // 获取服务名称
    const { data: service, error } = await supabase
      .from('services')
      .select('name, project:projects(identifier)')
      .eq('id', id)
      .single()

    if (error || !service) {
      return NextResponse.json(
        { error: '服务不存在' },
        { status: 404 }
      )
    }

    const namespace = (service.project as { identifier?: string })?.identifier?.trim()

    if (!namespace) {
      return NextResponse.json(
        { error: '项目缺少编号，无法获取日志' },
        { status: 400 }
      )
    }

    if (!service.name) {
      return NextResponse.json(
        { error: '服务名称缺失' },
        { status: 400 }
      )
    }

    // 获取 K8s 日志
    const result = await k8sService.getServiceLogs(service.name, lines, namespace)
    
    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
