import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { k8sService } from '@/lib/k8s'
import type { Service } from '@/types/project'

const resolveDeploymentTag = (service: Service): string | null => {
  switch (service.type) {
    case 'application':
      return service.built_image || service.git_branch || null
    case 'image':
      return service.tag ? `${service.image}:${service.tag}` : service.image
    case 'database':
      return service.version ? `${service.database_type}:${service.version}` : service.database_type
    default:
      return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // 获取服务信息
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*, project:projects!inner(identifier)')
      .eq('id', id)
      .single()

    if (serviceError || !service) {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    const { project: projectMeta, ...serviceData } = service as Service & {
      project?: { identifier?: string }
    }

    const namespace = projectMeta?.identifier?.trim()

    if (!namespace) {
      return NextResponse.json({ error: '项目缺少编号，无法部署' }, { status: 400 })
    }

    const typedService = serviceData as Service

    // 更新服务状态为 building
    const { error: statusError } = await supabase
      .from('services')
      .update({ status: 'building' })
      .eq('id', id)

    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 500 })
    }

    // 写入部署记录（状态 building）
    let deploymentRecordId: string | null = null
    const { data: deploymentRecord, error: deploymentError } = await supabase
      .from('deployments')
      .insert({
        service_id: id,
        status: 'building',
        image_tag: resolveDeploymentTag(typedService)
      })
      .select()
      .single()

    if (deploymentError) {
      // 如果记录失败，记录日志但不中断部署流程
      console.error('[deploy] failed to create deployment record', deploymentError)
    } else if (deploymentRecord) {
      deploymentRecordId = deploymentRecord.id
    }

    try {
      await k8sService.deployService(typedService, namespace)

      await supabase
        .from('services')
        .update({ status: 'running' })
        .eq('id', id)

      if (deploymentRecordId) {
        await supabase
          .from('deployments')
          .update({
            status: 'success',
            completed_at: new Date().toISOString()
          })
          .eq('id', deploymentRecordId)
      }

      return NextResponse.json({ success: true, message: '部署成功' })
    } catch (k8sError: unknown) {
      const errorMessage =
        k8sError instanceof Error
          ? k8sError.message
          : typeof k8sError === 'string'
            ? k8sError
            : '部署失败'

      await supabase
        .from('services')
        .update({ status: 'error' })
        .eq('id', id)

      if (deploymentRecordId) {
        await supabase
          .from('deployments')
          .update({
            status: 'failed',
            build_logs: errorMessage,
            completed_at: new Date().toISOString()
          })
          .eq('id', deploymentRecordId)
      }

      return NextResponse.json({ error: `部署失败: ${errorMessage}` }, { status: 500 })
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '部署过程出现异常'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
