import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * 获取服务诊断记录
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
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

    // 获取诊断记录
    const diagnostics = await prisma.serviceDiagnostic.findMany({
      where: { serviceId: id },
      orderBy: { diagnosticTime: 'desc' },
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

    return NextResponse.json({ diagnostics })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * 创建新的诊断记录
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
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

    const body = await request.json()
    const { 
      conclusion, 
      diagnostician, 
      reportCategory, 
      reportDetail,
      diagnosticTime 
    } = body

    // 验证必填字段
    if (!conclusion || !diagnostician || !reportCategory || !reportDetail) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      )
    }

    // 创建诊断记录
    const diagnostic = await prisma.serviceDiagnostic.create({
      data: {
        serviceId: id,
        diagnosticTime: diagnosticTime ? new Date(diagnosticTime) : new Date(),
        conclusion,
        diagnostician,
        reportCategory,
        reportDetail
      }
    })

    return NextResponse.json({ diagnostic })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}