import { NextRequest, NextResponse } from 'next/server'

import { requirementsMockStore } from '@/service/requirementsMockStore'
import { type RequirementCreatePayload, type RequirementListQuery } from '@/types/requirement'

const buildListQuery = (request: NextRequest): RequirementListQuery => {
  const { searchParams } = new URL(request.url)

  const query: RequirementListQuery = {}

  const searchKeyword = searchParams.get('search')
  if (searchKeyword) {
    query.search = searchKeyword
  }

  const projectId = searchParams.get('projectId')
  if (projectId) {
    query.projectId = projectId
  }

  const serviceId = searchParams.get('serviceId')
  if (serviceId) {
    query.serviceId = serviceId
  }

  const sortByParam = searchParams.get('sortBy')
  if (sortByParam === 'title' || sortByParam === 'updatedAt') {
    query.sortBy = sortByParam
  }

  const sortOrder = searchParams.get('sortOrder')
  if (sortOrder === 'asc' || sortOrder === 'desc') {
    query.sortOrder = sortOrder
  }

  return query
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const query = buildListQuery(request)
    const response = requirementsMockStore.list(query)
    return NextResponse.json(response)
  } catch (error: unknown) {
    console.error('[Requirement][GET] Failed to list requirements:', error)
    const message = error instanceof Error ? error.message : '加载需求列表失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Partial<RequirementCreatePayload>

    const title = typeof payload.title === 'string' ? payload.title.trim() : ''
    const projectId = typeof payload.projectId === 'string' ? payload.projectId : ''
    const serviceIds = Array.isArray(payload.serviceIds) ? payload.serviceIds.map((id) => String(id)) : []

    if (!title) {
      return NextResponse.json({ error: '需求标题不能为空' }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: '请选择关联项目' }, { status: 400 })
    }

    const sanitizedPayload: RequirementCreatePayload = {
      title,
      projectId,
      serviceIds
    }

    const requirement = requirementsMockStore.create(sanitizedPayload)

    return NextResponse.json({ data: requirement })
  } catch (error: unknown) {
    console.error('[Requirement][POST] Failed to create requirement:', error)
    const message = error instanceof Error ? error.message : '创建需求失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
