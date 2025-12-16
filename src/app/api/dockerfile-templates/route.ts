import { NextRequest, NextResponse } from 'next/server'
import { dockerfileTemplateSvc } from '@/service/dockerfileTemplateSvc'

/**
 * GET /api/dockerfile-templates
 * 获取所有模板或按分类筛选
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let templates
    if (category) {
      templates = await dockerfileTemplateSvc.getTemplatesByCategory(category)
    } else {
      templates = await dockerfileTemplateSvc.getAllTemplates()
    }

    return NextResponse.json({
      success: true,
      data: templates
    })
  } catch (error) {
    console.error('获取Dockerfile模板失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取模板失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dockerfile-templates
 * 创建新模板
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // 验证必需字段
    const requiredFields = ['id', 'name', 'description', 'category', 'base_image', 'run_command', 'dockerfile_content']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { 
            success: false, 
            error: `缺少必需字段: ${field}` 
          },
          { status: 400 }
        )
      }
    }

    const template = await dockerfileTemplateSvc.createTemplate(body)

    return NextResponse.json({
      success: true,
      data: template
    })
  } catch (error) {
    console.error('创建Dockerfile模板失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '创建模板失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}