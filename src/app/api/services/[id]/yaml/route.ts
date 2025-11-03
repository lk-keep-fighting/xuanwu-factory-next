import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { k8sService } from '@/lib/k8s'
import type { Service } from '@/types/project'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // 直接从数据库获取服务信息
    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error || !service) {
      return NextResponse.json(
        { error: '服务不存在' },
        { status: 404 }
      )
    }
    
    // 生成 YAML
    const yaml = k8sService.generateServiceYAML(service as Service, 'default')
    
    return new Response(yaml, {
      headers: {
        'Content-Type': 'text/yaml; charset=utf-8'
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('生成 YAML 失败:', error)
    
    return NextResponse.json(
      { error: `生成 YAML 失败: ${message}` },
      { status: 500 }
    )
  }
}
