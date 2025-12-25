import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  validateOpenApiAuth, 
  createOpenApiErrorResponse, 
  createOpenApiSuccessResponse,
  validateRequiredFields
} from '@/lib/open-api-auth'

/**
 * 开放API - 更新诊断记录
 * 
 * 此接口用于外部系统（如AI诊断回调）更新诊断记录信息
 * 需要提供API密钥进行身份验证
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // API密钥验证
    const authResult = validateOpenApiAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        createOpenApiErrorResponse(authResult.error!, authResult.message!),
        { status: 401 }
      )
    }

    // 验证诊断记录是否存在
    const existingDiagnostic = await prisma.serviceDiagnostic.findUnique({
      where: { id },
      select: { 
        id: true, 
        serviceId: true,
        conclusion: true,
        diagnostician: true,
        reportCategory: true,
        reportDetail: true
      }
    })

    if (!existingDiagnostic) {
      return NextResponse.json(
        createOpenApiErrorResponse('Diagnostic not found', '诊断记录不存在'),
        { status: 404 }
      )
    }

    const body = await request.json()
    const { 
      conclusion, 
      reportDetail,
      reportCategory,
      task_id,
      status,
      result,
      error_message,
      completed_at
    } = body

    // 构建更新数据
    const updateData: any = {}

    // 如果提供了直接的字段，使用直接字段
    if (conclusion) {
      updateData.conclusion = conclusion
    }
    if (reportDetail) {
      updateData.reportDetail = reportDetail
    }
    if (reportCategory) {
      updateData.reportCategory = reportCategory
    }

    // 如果没有提供直接字段，但提供了AI任务相关字段，则自动生成
    if (!conclusion && !reportDetail && (task_id || status || result || error_message)) {
      if (status === 'completed' && result) {
        // 任务成功完成
        updateData.conclusion = 'AI诊断完成'
        updateData.reportDetail = `## AI诊断结果\n\n**任务ID**: ${task_id || 'N/A'}\n**完成时间**: ${completed_at || new Date().toISOString()}\n**状态**: 诊断成功\n\n### 诊断报告\n\n${result}\n\n---\n*本报告由玄武AI系统自动生成*`
      } else if (status === 'failed' || error_message) {
        // 任务失败
        updateData.conclusion = 'AI诊断失败'
        updateData.reportDetail = `## AI诊断失败\n\n**任务ID**: ${task_id || 'N/A'}\n**失败时间**: ${completed_at || new Date().toISOString()}\n**错误信息**: ${error_message || '未知错误'}\n\n### 建议\n- 检查服务状态是否正常\n- 确认Pod是否在运行\n- 稍后重试AI诊断\n\n---\n*如问题持续存在，请联系技术支持*`
      } else if (status === 'running') {
        // 任务进行中，只更新详情不改变结论
        updateData.reportDetail = `## AI诊断进行中\n\n**任务ID**: ${task_id || 'N/A'}\n**当前状态**: 正在分析\n**更新时间**: ${new Date().toISOString()}\n\n正在进行深度分析，请耐心等待...\n\n### 分析进度\n- ✅ 任务已创建\n- 🔄 正在分析Pod状态\n- ⏳ 日志分析中\n- ⏳ 生成诊断报告\n\n预计还需要2-3分钟完成。`
      } else if (status) {
        // 其他状态
        updateData.conclusion = `AI诊断状态: ${status}`
        updateData.reportDetail = `## AI诊断状态更新\n\n**任务ID**: ${task_id || 'N/A'}\n**当前状态**: ${status}\n**更新时间**: ${new Date().toISOString()}\n\n任务状态已更新，请等待进一步结果。`
      }
    }

    // 如果没有任何更新数据，返回错误
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        createOpenApiErrorResponse(
          'No update data provided',
          '没有提供更新数据，请提供 conclusion、reportDetail、reportCategory 或 AI任务相关字段'
        ),
        { status: 400 }
      )
    }

    // 更新诊断记录
    const updatedDiagnostic = await prisma.serviceDiagnostic.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(
      createOpenApiSuccessResponse({
        id: updatedDiagnostic.id,
        serviceId: updatedDiagnostic.serviceId,
        diagnosticTime: updatedDiagnostic.diagnosticTime,
        conclusion: updatedDiagnostic.conclusion,
        diagnostician: updatedDiagnostic.diagnostician,
        reportCategory: updatedDiagnostic.reportCategory,
        reportDetail: updatedDiagnostic.reportDetail,
        updatedAt: updatedDiagnostic.updatedAt
      }, '诊断记录更新成功')
    )

  } catch (error: unknown) {
    console.error('Open API - Update diagnostic error:', error)
    
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      createOpenApiErrorResponse('Internal server error', '服务器内部错误: ' + message),
      { status: 500 }
    )
  }
}

/**
 * 开放API - 获取诊断记录详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // API密钥验证
    const authResult = validateOpenApiAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        createOpenApiErrorResponse(authResult.error!, authResult.message!),
        { status: 401 }
      )
    }

    // 获取诊断记录
    const diagnostic = await prisma.serviceDiagnostic.findUnique({
      where: { id },
      select: {
        id: true,
        serviceId: true,
        diagnosticTime: true,
        conclusion: true,
        diagnostician: true,
        reportCategory: true,
        reportDetail: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!diagnostic) {
      return NextResponse.json(
        createOpenApiErrorResponse('Diagnostic not found', '诊断记录不存在'),
        { status: 404 }
      )
    }

    return NextResponse.json(
      createOpenApiSuccessResponse(diagnostic)
    )

  } catch (error: unknown) {
    console.error('Open API - Get diagnostic error:', error)
    
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      createOpenApiErrorResponse('Internal server error', '服务器内部错误: ' + message),
      { status: 500 }
    )
  }
}