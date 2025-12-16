import { NextRequest, NextResponse } from 'next/server'
import { dockerfileTemplateSvc } from '@/service/dockerfileTemplateSvc'

/**
 * GET /api/dockerfile-templates/categories
 * 获取所有模板分类
 */
export async function GET(request: NextRequest) {
  try {
    const categories = await dockerfileTemplateSvc.getTemplateCategories()

    return NextResponse.json({
      success: true,
      data: categories
    })
  } catch (error) {
    console.error('获取模板分类失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取分类失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}