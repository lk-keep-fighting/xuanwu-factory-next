import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { k8sService } from '@/lib/k8s'
import type { Service } from '@/types/project'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    // 获取服务信息
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single()

    if (serviceError || !service) {
      return NextResponse.json(
        { error: '服务不存在' },
        { status: 404 }
      )
    }

    // 更新服务状态为 building
    await supabase
      .from('services')
      .update({ status: 'building' })
      .eq('id', id)

    // 部署到 Kubernetes
    try {
      await k8sService.deployService(service as Service)
      
      // 更新状态为 running
      await supabase
        .from('services')
        .update({ status: 'running' })
        .eq('id', id)

      return NextResponse.json({
        success: true,
        message: '部署成功'
      })
    } catch (k8sError: any) {
      // 部署失败，更新状态为 error
      await supabase
        .from('services')
        .update({ status: 'error' })
        .eq('id', id)

      return NextResponse.json(
        { error: `部署失败: ${k8sError.message}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
