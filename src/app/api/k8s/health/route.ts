import { NextResponse } from 'next/server'
import { k8sService } from '@/lib/k8s'

/**
 * 测试 Kubernetes 连接
 */
export async function GET() {
  try {
    // 尝试获取集群信息
    await k8sService.getServiceStatus('test-connection', 'default')
    
    return NextResponse.json({
      connected: true,
      message: 'Kubernetes 连接正常',
      clusterInfo: '连接成功'
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    // 如果是 404 错误，说明能连接 K8s 但服务不存在（这是正常的）
    if (message.includes('404') || message.toLowerCase().includes('not found')) {
      return NextResponse.json({
        connected: true,
        message: 'Kubernetes 连接正常（测试服务不存在，但能连接集群）',
        clusterInfo: 'API 可访问'
      })
    }
    
    // 其他错误说明无法连接
    return NextResponse.json({
      connected: false,
      message: 'Kubernetes 连接失败',
      error: message,
      help: '请检查 kubeconfig 配置：\n1. 确保 ~/.kube/config 存在\n2. 或设置 KUBECONFIG 环境变量\n3. 或设置 KUBECONFIG_DATA 环境变量'
    }, { status: 500 })
  }
}
