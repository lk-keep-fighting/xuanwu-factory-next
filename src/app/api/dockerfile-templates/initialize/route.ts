import { NextRequest, NextResponse } from 'next/server'
import { dockerfileTemplateSvc } from '@/service/dockerfileTemplateSvc'

/**
 * POST /api/dockerfile-templates/initialize
 * 初始化系统模板
 */
export async function POST(request: NextRequest) {
  try {
    await dockerfileTemplateSvc.initializeSystemTemplates()

    return NextResponse.json({
      success: true,
      message: '系统模板初始化完成'
    })
  } catch (error) {
    console.error('初始化系统模板失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '初始化失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}