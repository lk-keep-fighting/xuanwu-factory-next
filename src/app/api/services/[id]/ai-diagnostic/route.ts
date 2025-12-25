import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const XUANWU_AI_BASE_URL = process.env.XUANWU_AI_BASE_URL || 'http://ai-debug.xuanwu-factory.dev.aimstek.cn'
const DEFAULT_CALLBACK_URL = 'http://api-adapter.xuanwu-factory.dev.aimstek.cn/api/run-logic/ai-debug-callback'

/**
 * 创建AI诊断任务
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // 验证服务是否存在
    const service = await prisma.service.findUnique({
      where: { id },
      select: { 
        id: true, 
        name: true, 
        type: true,
        git_repository: true,
        git_branch: true
      }
    })

    if (!service) {
      return NextResponse.json(
        { error: '服务不存在' },
        { status: 404 }
      )
    }

    // 获取请求体中的K8s信息
    const body = await request.json()
    const { namespace, pod, callback_url } = body

    // 验证必填字段
    if (!namespace || !pod) {
      return NextResponse.json(
        { error: '缺少必填字段: namespace, pod' },
        { status: 400 }
      )
    }

    // 先创建诊断记录
    const diagnostic = await prisma.serviceDiagnostic.create({
      data: {
        serviceId: id,
        diagnosticTime: new Date(),
        conclusion: 'AI诊断进行中...',
        diagnostician: '玄武AI系统',
        reportCategory: '其他',
        reportDetail: '## AI诊断任务\n\n正在进行AI智能诊断，请稍候...\n\n- 任务状态: 已创建\n- 诊断类型: 自动化AI诊断\n- 预计完成时间: 3-5分钟'
      }
    })

    // 构建AI诊断任务参数
    const taskParams: any = {
      namespace,
      pod,
      callback_url: callback_url || DEFAULT_CALLBACK_URL,
      metadata: {
        serviceId: id,
        serviceName: service.name,
        diagnosticId: diagnostic.id,
        diagnosticTime: diagnostic.diagnosticTime.toISOString(),
        platform: 'xuanwu-factory'
      }
    }

    // 如果是Application服务，添加Git仓库信息
    if (service.type === 'application') {
      const appService = service as any
      if (appService.git_repository) {
        taskParams.repo_url = appService.git_repository
        if (appService.git_branch) {
          taskParams.branch = appService.git_branch
        }
        // 在metadata中也添加Git信息
        taskParams.metadata.gitRepository = appService.git_repository
        taskParams.metadata.gitBranch = appService.git_branch
      }
    }

    // 调用玄武AI服务
    const aiResponse = await fetch(`${XUANWU_AI_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskParams),
      // 设置超时时间
      signal: AbortSignal.timeout(30000) // 30秒超时
    })

    if (!aiResponse.ok) {
      // 如果AI任务创建失败，更新诊断记录状态
      await prisma.serviceDiagnostic.update({
        where: { id: diagnostic.id },
        data: {
          conclusion: 'AI诊断任务创建失败',
          reportDetail: `## AI诊断任务创建失败\n\n**错误信息**: AI服务响应错误 (HTTP ${aiResponse.status})\n\n**时间**: ${new Date().toISOString()}\n\n**建议**: 请检查AI服务状态或稍后重试`
        }
      })

      let errorMessage = '创建AI诊断任务失败'
      
      try {
        const errorData = await aiResponse.json()
        if (errorData.message) {
          errorMessage = errorData.message
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        errorMessage = `AI服务响应错误 (HTTP ${aiResponse.status}): ${aiResponse.statusText}`
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: aiResponse.status }
      )
    }

    const result = await aiResponse.json()
    
    // 更新诊断记录，添加AI任务ID
    await prisma.serviceDiagnostic.update({
      where: { id: diagnostic.id },
      data: {
        reportDetail: `## AI诊断任务已创建\n\n**任务ID**: ${result.task_id}\n**状态**: ${result.status}\n**创建时间**: ${result.created_at}\n\n正在进行AI智能诊断，预计3-5分钟完成。诊断完成后将自动更新结果。\n\n### 诊断范围\n- Pod状态分析\n- 日志异常检测\n- 资源使用情况\n- 配置问题排查${taskParams.repo_url ? '\n- 代码质量分析' : ''}`
      }
    })
    
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        diagnosticId: diagnostic.id,
        metadata: taskParams.metadata
      },
      message: 'AI诊断任务创建成功，诊断记录已生成'
    })

  } catch (error: unknown) {
    console.error('AI诊断任务创建失败:', error)
    
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'AI服务请求超时，请稍后重试' },
        { status: 408 }
      )
    }
    
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: '服务器内部错误: ' + message },
      { status: 500 }
    )
  }
}

/**
 * 检查AI服务可用性
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // 验证服务是否存在
    const service = await prisma.service.findUnique({
      where: { id },
      select: { id: true, name: true }
    })

    if (!service) {
      return NextResponse.json(
        { error: '服务不存在' },
        { status: 404 }
      )
    }

    // 检查AI服务可用性
    const healthResponse = await fetch(`${XUANWU_AI_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5秒超时
    })

    if (healthResponse.ok) {
      return NextResponse.json({
        success: true,
        available: true,
        message: '玄武AI服务可用'
      })
    } else {
      return NextResponse.json({
        success: false,
        available: false,
        error: `AI服务不可用 (HTTP ${healthResponse.status})`
      })
    }

  } catch (error: unknown) {
    console.error('AI服务健康检查失败:', error)
    
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({
        success: false,
        available: false,
        error: 'AI服务连接超时'
      })
    }
    
    return NextResponse.json({
      success: false,
      available: false,
      error: 'AI服务连接失败'
    })
  }
}