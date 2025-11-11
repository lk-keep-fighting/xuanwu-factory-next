import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100
const VALID_STATUSES = new Set(['pending', 'building', 'success', 'failed'])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const searchParams = request.nextUrl.searchParams
    const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10)
    const pageSizeParam = Number.parseInt(searchParams.get('page_size') ?? `${DEFAULT_PAGE_SIZE}`, 10)
    const statusParam = searchParams.get('status')

    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
    const pageSizeCandidate = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : DEFAULT_PAGE_SIZE
    const pageSize = Math.min(pageSizeCandidate, MAX_PAGE_SIZE)
    const skip = (page - 1) * pageSize

    const normalizedStatus = typeof statusParam === 'string' ? statusParam.trim().toLowerCase() : null

    const where = {
      service_id: id,
      ...(normalizedStatus && VALID_STATUSES.has(normalizedStatus) ? { build_status: normalizedStatus } : {})
    }

    const [items, total] = await prisma.$transaction([
      prisma.serviceImage.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.serviceImage.count({ where })
    ])

    const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0
    const hasNext = page * pageSize < total
    const hasPrevious = page > 1

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext,
      hasPrevious
    })
  } catch (error) {
    console.error('[ServiceImages][GET] Failed to fetch images:', error)
    const message = error instanceof Error ? error.message : '获取镜像列表失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
