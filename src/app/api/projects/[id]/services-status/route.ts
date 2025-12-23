import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { k8sService } from '@/lib/k8s'

/**
 * 批量获取项目下所有服务的K8s状态
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        identifier: true,
        services: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const namespace = project.identifier?.trim()

    if (!namespace) {
      return NextResponse.json(
        { error: '项目缺少编号，无法获取 Kubernetes 状态' },
        { status: 400 }
      )
    }

    // 获取命名空间下所有 Deployment 和 StatefulSet
    const [deployments, statefulSets, pods] = await Promise.all([
      k8sService.listNamespaceDeployments(namespace),
      k8sService.listNamespaceStatefulSets(namespace),
      k8sService.listNamespacePods(namespace)
    ])

    // 构建服务状态映射
    const servicesStatus: Record<string, {
      status: 'running' | 'pending' | 'stopped' | 'error'
      replicas?: number
      readyReplicas?: number
      availableReplicas?: number
      podStatus?: {
        imagePullFailed?: boolean
        imagePullError?: string
      }
      error?: string
    }> = {}

    // 处理项目中的每个服务
    for (const service of project.services) {
      const serviceName = service.name?.trim()
      if (!serviceName) continue

      // 检查是否有对应的 Deployment
      const deployment = deployments.find(d => d.metadata?.name === serviceName)
      if (deployment) {
        const replicas = deployment.spec?.replicas || 0
        const availableReplicas = deployment.status?.availableReplicas || 0
        const readyReplicas = deployment.status?.readyReplicas || 0
        const conditions = deployment.status?.conditions || []

        // 检查失败条件
        const hasFailedCondition = conditions.some((condition: any) => {
          const type = condition.type?.toString() || ''
          const status = condition.status?.toString() || ''
          const reason = condition.reason?.toString() || ''
          
          return (
            (type === 'Progressing' && status === 'False') ||
            (type === 'Available' && status === 'False' && replicas > 0) ||
            (type === 'ReplicaFailure' && status === 'True') ||
            reason === 'ProgressDeadlineExceeded'
          )
        })

        // 检查 Pod 状态
        const servicePods = pods.filter(p => 
          p.metadata?.labels?.app === serviceName
        )

        let imagePullFailed = false
        let imagePullError = ''

        for (const pod of servicePods) {
          const containerStatuses = pod.status?.containerStatuses || []
          
          for (const containerStatus of containerStatuses) {
            const waitingState = containerStatus.state?.waiting
            if (waitingState) {
              const reason = waitingState.reason || ''
              if (reason === 'ErrImagePull' || reason === 'ImagePullBackOff') {
                imagePullFailed = true
                imagePullError = waitingState.message || `镜像拉取失败: ${reason}`
                break
              }
            }
          }
          
          if (imagePullFailed) break
        }

        // 确定状态
        let status: 'running' | 'pending' | 'stopped' | 'error' = 'pending'
        
        if (replicas === 0) {
          status = 'stopped'
        } else if (imagePullFailed) {
          status = 'error'
        } else if (hasFailedCondition) {
          status = 'error'
        } else if (availableReplicas === replicas && readyReplicas === replicas) {
          status = 'running'
        } else if (availableReplicas === 0 && readyReplicas === 0) {
          status = 'error'
        } else {
          status = 'pending'
        }

        servicesStatus[service.id] = {
          status,
          replicas,
          readyReplicas,
          availableReplicas,
          ...(imagePullFailed && {
            podStatus: {
              imagePullFailed,
              imagePullError: imagePullError || undefined
            }
          })
        }
        continue
      }

      // 检查是否有对应的 StatefulSet
      const statefulSet = statefulSets.find(s => s.metadata?.name === serviceName)
      if (statefulSet) {
        const replicas = statefulSet.spec?.replicas || 0
        const readyReplicas = statefulSet.status?.readyReplicas || 0
        const currentReplicas = statefulSet.status?.currentReplicas || readyReplicas
        const conditions = statefulSet.status?.conditions || []

        // 检查失败条件
        const hasFailedCondition = conditions.some((condition: any) => {
          const type = condition.type?.toString() || ''
          const status = condition.status?.toString() || ''
          
          return type === 'Available' && status === 'False' && replicas > 0
        })

        // 检查 Pod 状态
        const servicePods = pods.filter(p => 
          p.metadata?.labels?.app === serviceName
        )

        let imagePullFailed = false
        let imagePullError = ''

        for (const pod of servicePods) {
          const containerStatuses = pod.status?.containerStatuses || []
          
          for (const containerStatus of containerStatuses) {
            const waitingState = containerStatus.state?.waiting
            if (waitingState) {
              const reason = waitingState.reason || ''
              if (reason === 'ErrImagePull' || reason === 'ImagePullBackOff') {
                imagePullFailed = true
                imagePullError = waitingState.message || `镜像拉取失败: ${reason}`
                break
              }
            }
          }
          
          if (imagePullFailed) break
        }

        // 确定状态
        let status: 'running' | 'pending' | 'stopped' | 'error' = 'pending'
        
        if (replicas === 0) {
          status = 'stopped'
        } else if (imagePullFailed) {
          status = 'error'
        } else if (hasFailedCondition) {
          status = 'error'
        } else if (readyReplicas === replicas) {
          // StatefulSet 中，当 readyReplicas 等于期望的 replicas 时，表示运行正常
          status = 'running'
        } else if (readyReplicas === 0) {
          // 如果没有就绪的副本，检查是否有 Pod 存在
          const podCount = servicePods.length
          if (podCount > 0) {
            // 有 Pod 但未就绪，可能正在启动
            status = 'pending'
          } else {
            // 没有 Pod，可能是错误状态
            status = 'error'
          }
        } else {
          // 部分就绪，正在启动或更新中
          status = 'pending'
        }

        servicesStatus[service.id] = {
          status,
          replicas,
          readyReplicas,
          availableReplicas: currentReplicas,
          ...(imagePullFailed && {
            podStatus: {
              imagePullFailed,
              imagePullError: imagePullError || undefined
            }
          })
        }
        continue
      }

      // 如果既没有 Deployment 也没有 StatefulSet，标记为未部署
      servicesStatus[service.id] = {
        status: 'pending',
        error: '未在 Kubernetes 中找到该服务'
      }
    }

    return NextResponse.json({
      namespace,
      services: servicesStatus
    })
  } catch (error: unknown) {
    console.error('[Projects][ServicesStatus] 获取服务状态失败:', error)
    const message = error instanceof Error ? error.message : '获取服务状态失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
