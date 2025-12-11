import { NextRequest, NextResponse } from 'next/server'
import * as k8s from '@kubernetes/client-node'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const namespace = searchParams.get('namespace') || 'default'
    const podName = searchParams.get('podName')
    const container = searchParams.get('container')
    const tailLines = parseInt(searchParams.get('tailLines') || '100')
    const follow = searchParams.get('follow') === 'true'
    const previous = searchParams.get('previous') === 'true'
    const sinceSeconds = searchParams.get('sinceSeconds')

    if (!podName) {
      return NextResponse.json(
        { success: false, error: 'Pod name is required' },
        { status: 400 }
      )
    }

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

    // 构建日志查询参数
    const logParams: any = {
      name: podName,
      namespace,
      tailLines,
      follow,
      previous
    }

    if (container) {
      logParams.container = container
    }

    if (sinceSeconds) {
      logParams.sinceSeconds = parseInt(sinceSeconds)
    }

    // 获取日志
    const logsResponse = await coreApi.readNamespacedPodLog(logParams)
    const logs = typeof logsResponse === 'string' ? logsResponse : (logsResponse.body || '')

    return NextResponse.json({
      success: true,
      logs,
      podName,
      container,
      namespace,
      tailLines,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to fetch logs:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch logs'
      },
      { status: 500 }
    )
  }
}