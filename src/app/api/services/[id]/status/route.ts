import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { status } = body as { status?: string }

  if (!status) {
    return NextResponse.json({ error: 'Status is required' }, { status: 400 })
  }

  try {
    const service = await prisma.service.update({
      where: { id },
      data: { status }
    })

    return NextResponse.json(service)
  } catch (error: unknown) {
    console.error('[Services][Status] 更新服务状态失败:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    const message = error instanceof Error ? error.message : '更新服务状态失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
