import { NextRequest, NextResponse } from 'next/server'

import { requirementsMockStore } from '@/service/requirementsMockStore'
import {
  type RequirementCreatePayload,
  type RequirementListQuery,
  type RequirementPriority,
  type RequirementStatus
} from '@/types/requirement'

const STATUS_VALUES: RequirementStatus[] = ['DRAFT', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELED']
const PRIORITY_VALUES: RequirementPriority[] = ['LOW', 'MEDIUM', 'HIGH']

const parseMultiValue = (values: string[] | null): string[] => {
  if (!values) return []
  const result: string[] = []
  values.forEach((value) => {
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .forEach((item) => result.push(item))
  })
  return result
}

const coerceStatus = (value: string): RequirementStatus | undefined => {
  if (STATUS_VALUES.includes(value as RequirementStatus)) {
    return value as RequirementStatus
  }
  return undefined
}

const coercePriority = (value: string): RequirementPriority | undefined => {
  if (PRIORITY_VALUES.includes(value as RequirementPriority)) {
    return value as RequirementPriority
  }
  return undefined
}

const buildListQuery = (request: NextRequest): RequirementListQuery => {
  const { searchParams } = new URL(request.url)

  const statusValues = parseMultiValue(searchParams.getAll('status'))
  const priorityValues = parseMultiValue(searchParams.getAll('priority'))

  const query: RequirementListQuery = {}

  const validStatuses = statusValues
    .map((status) => coerceStatus(status))
    .filter((value): value is RequirementStatus => Boolean(value))

  if (validStatuses.length > 0) {
    query.statuses = validStatuses
  }

  const validPriorities = priorityValues
    .map((priority) => coercePriority(priority))
    .filter((value): value is RequirementPriority => Boolean(value))

  if (validPriorities.length > 0) {
    query.priorities = validPriorities
  }

  const projectId = searchParams.get('projectId')
  if (projectId) {
    query.projectId = projectId
  }

  const serviceId = searchParams.get('serviceId')
  if (serviceId) {
    query.serviceId = serviceId
  }

  const ownerId = searchParams.get('ownerId')
  if (ownerId) {
    query.ownerId = ownerId
  }

  const searchKeyword = searchParams.get('search')
  if (searchKeyword) {
    query.search = searchKeyword
  }

  const overdue = searchParams.get('overdue')
  if (overdue === 'true') {
    query.onlyOverdue = true
  }

  const aiDispatch = searchParams.get('aiDispatch')
  if (aiDispatch === 'dispatched') {
    query.aiDispatch = 'DISPATCHED'
  } else if (aiDispatch === 'undispatched') {
    query.aiDispatch = 'UNDISPATCHED'
  }

  const sortByParam = searchParams.get('sortBy')
  if (sortByParam === 'dueAt' || sortByParam === 'priority' || sortByParam === 'updatedAt') {
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
    const description = typeof payload.description === 'string' ? payload.description : ''
    const projectId = typeof payload.projectId === 'string' ? payload.projectId : ''
    const ownerId = typeof payload.ownerId === 'string' ? payload.ownerId : ''
    const statusValue = typeof payload.status === 'string' ? payload.status : 'DRAFT'
    const priorityValue = typeof payload.priority === 'string' ? payload.priority : 'MEDIUM'

    if (!title) {
      return NextResponse.json({ error: '需求标题不能为空' }, { status: 400 })
    }
    if (!description) {
      return NextResponse.json({ error: '请填写需求描述' }, { status: 400 })
    }
    if (!projectId) {
      return NextResponse.json({ error: '请选择关联项目' }, { status: 400 })
    }
    if (!ownerId) {
      return NextResponse.json({ error: '请选择需求责任人' }, { status: 400 })
    }

    const status = coerceStatus(statusValue) ?? 'DRAFT'
    const priority = coercePriority(priorityValue) ?? 'MEDIUM'

    const serviceIds = Array.isArray(payload.serviceIds)
      ? payload.serviceIds.map((id) => String(id))
      : []
    const watcherIds = Array.isArray(payload.watcherIds)
      ? payload.watcherIds.map((id) => String(id))
      : []

    const sanitizedPayload: RequirementCreatePayload = {
      title,
      description,
      projectId,
      serviceIds,
      priority,
      status,
      ownerId,
      watcherIds,
      dueAt: typeof payload.dueAt === 'string' && payload.dueAt !== '' ? payload.dueAt : undefined,
      tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag)) : []
    }

    const requirement = requirementsMockStore.create(sanitizedPayload)

    return NextResponse.json({ data: requirement })
  } catch (error: unknown) {
    console.error('[Requirement][POST] Failed to create requirement:', error)
    const message = error instanceof Error ? error.message : '创建需求失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
