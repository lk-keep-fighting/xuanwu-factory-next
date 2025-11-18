import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { k8sService } from '@/lib/k8s'
import {
  ServiceType,
  SUPPORTED_DATABASE_TYPES,
  DATABASE_TYPE_METADATA,
  type Service,
  type SupportedDatabaseType
} from '@/types/project'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const buildNetworkConfig = (
  port: number,
  serviceType: 'ClusterIP' | 'NodePort',
  nodePort?: number | null
) => {
  const basePort = Number(port)
  return {
    service_type: serviceType,
    ports: [
      {
        container_port: basePort,
        service_port: basePort,
        protocol: 'TCP',
        ...(typeof nodePort === 'number' && nodePort > 0 ? { node_port: nodePort } : {})
      }
    ]
  }
}

const extractSupportedDatabaseType = (value: unknown): SupportedDatabaseType | null => {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().toLowerCase()
  return (SUPPORTED_DATABASE_TYPES as readonly string[]).find((item) => item === normalized) as
    | SupportedDatabaseType
    | null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let rawPayload: unknown
  try {
    rawPayload = await request.json()
  } catch (error) {
    return NextResponse.json({ error: '请求体不是有效的 JSON 数据' }, { status: 400 })
  }

  const enabled = Boolean((rawPayload as { enabled?: unknown })?.enabled)

  try {
    const serviceRecord = await prisma.service.findUnique({
      where: { id },
      include: {
        project: {
          select: { identifier: true }
        }
      }
    })

    if (!serviceRecord) {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    if ((serviceRecord.type ?? '').toLowerCase() !== ServiceType.DATABASE) {
      return NextResponse.json({ error: '仅数据库服务支持外部访问配置。' }, { status: 400 })
    }

    const dbType = extractSupportedDatabaseType(serviceRecord.database_type)

    if (!dbType) {
      return NextResponse.json({ error: '该数据库类型暂不支持外部访问配置。' }, { status: 400 })
    }

    const metadata = DATABASE_TYPE_METADATA[dbType]
    const basePort = Number.isInteger(serviceRecord.port) && (serviceRecord.port ?? 0) > 0
      ? (serviceRecord.port as number)
      : metadata.defaultPort

    const namespace = serviceRecord.project?.identifier?.trim()
    if (!namespace) {
      return NextResponse.json({ error: '项目缺少编号，无法更新外部访问配置。' }, { status: 400 })
    }

    const plainServiceRecord = JSON.parse(JSON.stringify(serviceRecord)) as typeof serviceRecord
    const { project: _project, ...plainService } = plainServiceRecord
    const previousService = plainService as unknown as Service

    const nextNetworkConfig = buildNetworkConfig(basePort, enabled ? 'NodePort' : 'ClusterIP')
    const nextService = {
      ...previousService,
      port: basePort,
      external_port: null,
      network_config: nextNetworkConfig
    } as Service

    try {
      await k8sService.deployService(nextService, namespace)
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新 Kubernetes 资源失败'
      console.error('[Services][ExternalAccess] Failed to deploy updated service:', error)

      try {
        await k8sService.deployService(previousService, namespace)
      } catch (revertError) {
        console.error('[Services][ExternalAccess] Failed to revert service deployment:', revertError)
      }

      return NextResponse.json({ error: `更新外部访问配置失败：${message}` }, { status: 500 })
    }

    let assignedNodePort: number | null = null

    if (enabled) {
      const maxAttempts = 6
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const networkInfo = await k8sService.getServiceNetworkInfo(serviceRecord.name, namespace)

        if (networkInfo?.ports?.length) {
          const matched = networkInfo.ports.find((port) => {
            const targetPort = port.targetPort ?? port.port
            return typeof targetPort === 'number' && targetPort === basePort
          })

          if (matched?.nodePort) {
            assignedNodePort = matched.nodePort
            break
          }
        }

        await sleep(500)
      }

      if (!assignedNodePort) {
        try {
          await k8sService.deployService(previousService, namespace)
        } catch (revertError) {
          console.error('[Services][ExternalAccess] Failed to revert service deployment after nodePort lookup failure:', revertError)
        }

        return NextResponse.json({ error: '未能获取到分配的外部端口，请稍后重试。' }, { status: 500 })
      }
    }

    const finalNetworkConfig = buildNetworkConfig(
      basePort,
      enabled ? 'NodePort' : 'ClusterIP',
      enabled ? assignedNodePort : null
    )

    const updatedService = await prisma.service.update({
      where: { id },
      data: {
        port: basePort,
        network_config: finalNetworkConfig as unknown as Prisma.JsonValue,
        external_port: enabled ? assignedNodePort : null
      }
    })

    const responseService = JSON.parse(JSON.stringify(updatedService)) as typeof updatedService

    return NextResponse.json({
      success: true,
      enabled,
      service: responseService,
      message: enabled ? '外部访问已开启' : '已关闭外部访问'
    })
  } catch (error) {
    console.error('[Services][ExternalAccess] Unexpected error:', error)
    const message = error instanceof Error ? error.message : '更新外部访问配置失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
