import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { k8sService } from '@/lib/k8s'
import type { K8sImportRequest } from '@/types/k8s'

export async function POST(request: Request) {
  const payload = (await request.json()) as Partial<K8sImportRequest>

  const projectId = payload?.project_id
  const resource = payload?.resource

  if (!projectId || !resource?.name || !resource?.kind) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 })
  }

  const namespace = resource.namespace || 'default'
  const servicePayload = await k8sService.buildServicePayloadFromWorkload(
    projectId,
    namespace,
    resource.name,
    resource.kind
  )

  if (!servicePayload) {
    return NextResponse.json({ error: '无法从 Kubernetes 资源构建服务配置' }, { status: 422 })
  }

  let finalName = servicePayload.name
  let suffix = 1

  // 检查名称冲突，若存在则自动追加序号
  while (true) {
    const { data: conflict, error: conflictError } = await supabase
      .from('services')
      .select('id')
      .eq('project_id', projectId)
      .eq('name', finalName)
      .maybeSingle()

    if (conflictError && conflictError.code !== 'PGRST116') {
      return NextResponse.json({ error: conflictError.message }, { status: 500 })
    }

    if (!conflict) {
      break
    }

    finalName = `${servicePayload.name}-${suffix}`
    suffix += 1
  }

  const insertPayload = {
    ...servicePayload,
    name: finalName
  }

  const { data, error } = await supabase
    .from('services')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
