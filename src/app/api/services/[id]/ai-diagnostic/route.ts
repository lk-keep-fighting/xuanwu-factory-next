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

    // 构建AI诊断任务参数
    const taskParams: any = {
      namespace,
      pod,
      callback_url: callback_url || DEFAULT_CALLBACK_URL
    }

    // 如果是Application服务，添加Git仓库信息
    if (service.type === 'application') {
      const appService = service as any
      if (appService.git_repository) {
        taskParams.repo_url = appService.git_repository
        if (appService.git_branch) {
          taskParams.branch = appService.git_branch
        }
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
    
    return NextResponse.json({
      success: true,
      data: result,
      message: 'AI诊断任务创建成功'
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