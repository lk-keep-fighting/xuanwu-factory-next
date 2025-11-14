import { NextRequest, NextResponse } from 'next/server'

import { aiMockStore } from '@/service/aiMockStore'
import { AITaskStatus } from '@/types/ai'

const isTaskStatus = (value: string): value is AITaskStatus =>
  value === 'PENDING' || value === 'IN_PROGRESS' || value === 'SUCCESS' || value === 'FAILED'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = Number.parseInt(searchParams.get('pageSize') ?? '10', 10)
  const statusParam = searchParams.get('status') ?? undefined

  const result = aiMockStore.listEmployeeTasks(params.id, {
    page: Number.isNaN(page) ? 1 : page,
    pageSize: Number.isNaN(pageSize) ? 10 : pageSize,
    status: statusParam ? (statusParam === 'ALL' ? 'ALL' : isTaskStatus(statusParam) ? statusParam : undefined) : undefined
  })

  return NextResponse.json({
    data: result.items,
    pagination: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    }
  })
}
