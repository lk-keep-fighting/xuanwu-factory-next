import { NextRequest, NextResponse } from 'next/server'
import { k8sService } from '@/lib/k8s'
import * as k8s from '@kubernetes/client-node'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const namespace = searchParams.get('namespace') || 'default'
    const labelSelector = searchParams.get('labelSelector')

    // 初始化 Kubernetes 客户端
    const kc = new k8s.KubeConfig()
    try {
      const kubeconfigData = process.env.KUBECONFIG_DATA?.trim()
      const apiServer = process.env.K8S_API_SERVER?.trim()
      const bearerToken = process.env.K8S_BEARER_TOKEN?.trim()

      if (kubeconfigData) {
        kc.loadFromString(kubeconfigData)
      } else if (apiServer && bearerToken) {
        const cluster = {
          name: 'custom-cluster',
          server: apiServer,
          skipTLSVerify: process.env.K8S_SKIP_TLS_VERIFY === 'true',
        }
        
        if (process.env.K8S_CA_CERT_DATA) {
          cluster.caData = process.env.K8S_CA_CERT_DATA
        }
        
        kc.loadFromOptions({
          clusters: [cluster],
          users: [{
            name: 'custom-user',
            token: bearerToken,
          }],
          contexts: [{
            name: 'custom-context',
            cluster: 'custom-cluster',
            user: 'custom-user',
          }],
          currentContext: 'custom-context',
        })
      } else {
        kc.loadFromDefault()
      }
    } catch (error) {
      console.error('Failed to initialize Kubernetes client:', error)
      throw error
    }

    const coreApi = kc.makeApiClient(k8s.CoreV1Api)

    // 构建查询参数
    const queryParams: any = {
      namespace
    }

    if (labelSelector) {
      queryParams.labelSelector = labelSelector
    }

    // 获取Pod列表
    const podsResponse = await coreApi.listNamespacedPod(queryParams)
    const pods = podsResponse.body?.items || podsResponse.items || []

    // 格式化Pod数据
    const formattedPods = pods.map(pod => {
      const containerStatuses = pod.status?.containerStatuses || []
      const containers = pod.spec?.containers?.map(c => c.name) || []
      
      return {
        name: pod.metadata?.name || 'unknown',
        namespace: pod.metadata?.namespace || namespace,
        status: pod.status?.phase || 'Unknown',
        ready: `${containerStatuses.filter(c => c.ready).length}/${containerStatuses.length}`,
        restartCount: containerStatuses.reduce((sum, c) => sum + (c.restartCount || 0), 0),
        age: pod.metadata?.creationTimestamp || '',
        containers,
        labels: pod.metadata?.labels || {},
        annotations: pod.metadata?.annotations || {},
        nodeName: pod.spec?.nodeName,
        podIP: pod.status?.podIP,
        hostIP: pod.status?.hostIP,
        conditions: pod.status?.conditions || []
      }
    })

    return NextResponse.json({
      success: true,
      pods: formattedPods,
      total: formattedPods.length
    })

  } catch (error) {
    console.error('Failed to fetch pods:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pods'
      },
      { status: 500 }
    )
  }
}