import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { k8sService } from '@/lib/k8s'

/**
 * 停止服务
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
      .select('name')
      .eq('id', id)
      .single()

    if (serviceError || !service) {
      return NextResponse.json(
        { error: '服务不存在' },
        { status: 404 }
      )
    }

    // 停止 K8s 服务
    const result = await k8sService.stopService(service.name)
    
    // 更新数据库状态
    await supabase
      .from('services')
      .update({ status: 'stopped' })
      .eq('id', id)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
