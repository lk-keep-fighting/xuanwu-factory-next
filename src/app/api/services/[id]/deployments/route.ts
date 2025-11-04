import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const deployments = await prisma.deployment.findMany({
      where: { service_id: id },
      orderBy: { created_at: 'desc' }
    })

    return NextResponse.json(deployments)
  } catch (error: unknown) {
    console.error('[Services][Deployments] 获取部署历史失败:', error)
    const message = error instanceof Error ? error.message : '获取部署历史失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
