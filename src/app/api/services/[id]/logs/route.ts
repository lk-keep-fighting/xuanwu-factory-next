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
      .select('name')
      .eq('id', id)
      .single()

    if (error || !service) {
      return NextResponse.json(
        { error: '服务不存在' },
        { status: 404 }
      )
    }

    // 获取 K8s 日志
    const result = await k8sService.getServiceLogs(service.name, lines)
    
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
