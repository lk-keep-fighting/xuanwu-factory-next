import { NextResponse } from 'next/server'
import { k8sService } from '@/lib/k8s'

/**
 * K8s 连接和权限诊断接口
 */
export async function GET() {
  const results: {
    step: string
    status: 'success' | 'error'
    message: string
    details?: any
  }[] = []

  const testNamespace = `xuanwu-test-${Date.now()}`

  try {
    // 步骤 1: 测试列出命名空间权限
    results.push({
      step: '1. List Namespaces',
      status: 'success',
      message: '正在测试列出命名空间的权限...'
    })

    try {
      const namespaces = await k8sService.listNamespaces()
      results[results.length - 1].status = 'success'
      results[results.length - 1].message = `✅ 可以列出命名空间，共 ${namespaces.length} 个`
      results[results.length - 1].details = namespaces.map((ns: any) => ns.metadata?.name)
    } catch (error: any) {
      results[results.length - 1].status = 'error'
      results[results.length - 1].message = `❌ 无法列出命名空间: ${error.message}`
      results[results.length - 1].details = error.toString()
    }

    // 步骤 2: 测试创建项目 PVC（这会自动创建 namespace）
    results.push({
      step: '2. Create Project Resources',
      status: 'success',
      message: `正在测试为 ${testNamespace} 创建资源...`
    })

    try {
      await k8sService.createProjectPVC(testNamespace)
      results[results.length - 1].status = 'success'
      results[results.length - 1].message = `✅ 成功创建测试项目资源: ${testNamespace}`
    } catch (error: any) {
      results[results.length - 1].status = 'error'
      results[results.length - 1].message = `❌ 无法创建项目资源: ${error.message}`
      results[results.length - 1].details = error.toString()
    }

    const hasError = results.some(r => r.status === 'error')

    return NextResponse.json({
      success: !hasError,
      summary: hasError ? '❌ 检测到权限问题' : '✅ 所有权限检查通过',
      testNamespace,
      note: hasError ? '请手动检查 K8s 连接和 RBAC 权限配置' : `测试命名空间 ${testNamespace} 已创建，请手动删除: kubectl delete namespace ${testNamespace}`,
      results
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      summary: '❌ 诊断过程出错',
      error: error.message,
      results
    }, { status: 500 })
  }
}
