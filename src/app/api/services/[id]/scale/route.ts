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
      .select('name')
      .eq('id', id)
      .single()

    if (serviceError || !service) {
      return NextResponse.json(
        { error: '服务不存在' },
        { status: 404 }
      )
    }

    // 扩缩容 K8s 服务
    const result = await k8sService.scaleService(service.name, replicas)
    
    // 更新数据库中的副本数
    await supabase
      .from('services')
      .update({ replicas })
      .eq('id', id)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
