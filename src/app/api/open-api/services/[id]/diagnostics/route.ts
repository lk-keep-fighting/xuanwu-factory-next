import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  validateOpenApiAuth, 
  createOpenApiErrorResponse, 
  createOpenApiSuccessResponse,
  validateRequiredFields,
  validateFieldLength,
  validateEnumValue,
  parsePaginationParams
} from '@/lib/open-api-auth'

/**
 * 开放API - 创建服务诊断记录
 * 
 * 此接口用于外部系统向服务添加诊断数据
 * 需要提供API密钥进行身份验证
 */
export async function POST(
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

    // 验证服务是否存在
    const service = await prisma.service.findUnique({
      where: { id },
      select: { id: true, name: true }
    })

    if (!service) {
      return NextResponse.json(
        createOpenApiErrorResponse('Service not found', '服务不存在'),
        { status: 404 }
      )
    }

    const body = await request.json()
    const { 
      conclusion, 
      diagnostician, 
      reportCategory, 
      reportDetail,
      diagnosticTime,
      source // 新增字段，标识数据来源
    } = body

    // 验证必填字段
    const requiredFields = ['conclusion', 'diagnostician', 'reportCategory', 'reportDetail']
    const fieldValidation = validateRequiredFields(body, requiredFields)
    if (!fieldValidation.valid) {
      return NextResponse.json(
        createOpenApiErrorResponse(
          'Missing required fields',
          `缺少必填字段: ${fieldValidation.missingFields.join(', ')}`
        ),
        { status: 400 }
      )
    }

    // 验证字段长度
    const lengthValidation = validateFieldLength(conclusion, '诊断结论', 255)
    if (!lengthValidation.valid) {
      return NextResponse.json(
        createOpenApiErrorResponse('Field too long', lengthValidation.error!),
        { status: 400 }
      )
    }

    // 验证归因分类
    const validCategories = [
      '应用问题', '基础设施', '网络问题', '存储问题', 
      '配置问题', '性能问题', '安全问题', '其他'
    ]
    const categoryValidation = validateEnumValue(reportCategory, '归因分类', validCategories)
    if (!categoryValidation.valid) {
      return NextResponse.json(
        createOpenApiErrorResponse('Invalid report category', categoryValidation.error!),
        { status: 400 }
      )
    }

    // 创建诊断记录
    const diagnostic = await prisma.serviceDiagnostic.create({
      data: {
        serviceId: id,
        diagnosticTime: diagnosticTime ? new Date(diagnosticTime) : new Date(),
        conclusion,
        diagnostician: source ? `${diagnostician} (${source})` : diagnostician,
        reportCategory,
        reportDetail
      }
    })

    return NextResponse.json(
      createOpenApiSuccessResponse({
        id: diagnostic.id,
        serviceId: diagnostic.serviceId,
        diagnosticTime: diagnostic.diagnosticTime,
        conclusion: diagnostic.conclusion,
        diagnostician: diagnostic.diagnostician,
        reportCategory: diagnostic.reportCategory,
        reportDetail: diagnostic.reportDetail,
        createdAt: diagnostic.createdAt
      }, '诊断记录创建成功')
    )
  } catch (error: unknown) {
    console.error('Open API - Create diagnostic error:', error)
    
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      createOpenApiErrorResponse('Internal server error', '服务器内部错误: ' + message),
      { status: 500 }
    )
  }
}

/**
 * 开放API - 获取服务诊断记录列表
 * 
 * 此接口用于外部系统查询服务的诊断记录
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

    // 验证服务是否存在
    const service = await prisma.service.findUnique({
      where: { id },
      select: { id: true, name: true }
    })

    if (!service) {
      return NextResponse.json(
        createOpenApiErrorResponse('Service not found', '服务不存在'),
        { status: 404 }
      )
    }

    // 解析分页参数
    const { page, limit, skip } = parsePaginationParams(request)

    // 获取诊断记录
    const [diagnostics, total] = await Promise.all([
      prisma.serviceDiagnostic.findMany({
        where: { serviceId: id },
        orderBy: { diagnosticTime: 'desc' },
        skip,
        take: limit,
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
      }),
      prisma.serviceDiagnostic.count({
        where: { serviceId: id }
      })
    ])

    return NextResponse.json(
      createOpenApiSuccessResponse({
        diagnostics,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrevious: page > 1
        }
      })
    )
  } catch (error: unknown) {
    console.error('Open API - Get diagnostics error:', error)
    
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      createOpenApiErrorResponse('Internal server error', '服务器内部错误: ' + message),
      { status: 500 }
    )
  }
}