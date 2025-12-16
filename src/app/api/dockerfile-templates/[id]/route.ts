import { NextRequest, NextResponse } from 'next/server'
import { dockerfileTemplateSvc } from '@/service/dockerfileTemplateSvc'

/**
 * GET /api/dockerfile-templates/[id]
 * 获取指定模板
 */
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Extract ID from URL as fallback for Next.js 16 compatibility
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const id = context.params?.id || pathSegments[pathSegments.length - 1]
    
    console.log('API Route - URL:', url.pathname)
    console.log('API Route - ID:', id)
    
    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: '缺少模板ID参数' 
        },
        { status: 400 }
      )
    }
    
    const template = await dockerfileTemplateSvc.getTemplateById(id)
    
    if (!template) {
      return NextResponse.json(
        { 
          success: false, 
          error: '模板不存在' 
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: template
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
 * PUT /api/dockerfile-templates/[id]
 * 更新模板
 */
export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Extract ID from URL as fallback for Next.js 16 compatibility
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const id = context.params?.id || pathSegments[pathSegments.length - 1]
    
    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: '缺少模板ID参数' 
        },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    
    const template = await dockerfileTemplateSvc.updateTemplate(id, body)

    return NextResponse.json({
      success: true,
      data: template
    })
  } catch (error) {
    console.error('更新Dockerfile模板失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '更新模板失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/dockerfile-templates/[id]
 * 删除模板（软删除）
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Extract ID from URL as fallback for Next.js 16 compatibility
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const id = context.params?.id || pathSegments[pathSegments.length - 1]
    
    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: '缺少模板ID参数' 
        },
        { status: 400 }
      )
    }
    
    await dockerfileTemplateSvc.deleteTemplate(id)

    return NextResponse.json({
      success: true,
      message: '模板已删除'
    })
  } catch (error) {
    console.error('删除Dockerfile模板失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '删除模板失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}