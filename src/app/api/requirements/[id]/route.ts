import { NextRequest, NextResponse } from 'next/server'

import { requirementsMockStore } from '@/service/requirementsMockStore'
import {
  type RequirementPriority,
  type RequirementStatus,
  type RequirementStatusChangePayload,
  type RequirementUpdatePayload
} from '@/types/requirement'

const STATUS_VALUES: RequirementStatus[] = ['DRAFT', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELED']
const PRIORITY_VALUES: RequirementPriority[] = ['LOW', 'MEDIUM', 'HIGH']

const coerceStatus = (value: unknown): RequirementStatus | undefined => {
  if (typeof value !== 'string') return undefined
  if (STATUS_VALUES.includes(value as RequirementStatus)) {
    return value as RequirementStatus
  }
  return undefined
}

const coercePriority = (value: unknown): RequirementPriority | undefined => {
  if (typeof value !== 'string') return undefined
  if (PRIORITY_VALUES.includes(value as RequirementPriority)) {
    return value as RequirementPriority
  }
  return undefined
}

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const detail = requirementsMockStore.get(params.id)
    if (!detail) {
      return NextResponse.json({ error: '未找到对应的需求' }, { status: 404 })
    }

    const filters = requirementsMockStore.getFilters()

    return NextResponse.json({
      data: detail,
      meta: {
        nextStatuses: requirementsMockStore.getNextStatuses(detail.status),
        aiEmployees: requirementsMockStore.getAiEmployees(),
        projects: filters.projects,
        services: filters.services,
        people: requirementsMockStore.getPeople(),
        priorities: filters.priorities,
        statuses: filters.statuses
      }
    })
  } catch (error: unknown) {
    console.error('[Requirement][GET/:id] Failed to get requirement:', error)
    const message = error instanceof Error ? error.message : '加载需求详情失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await request.json()

    if (payload?.action === 'statusChange') {
      const toStatus = coerceStatus(payload?.toStatus)
      const changedBy = typeof payload?.changedBy === 'string' ? payload.changedBy : ''
      const note = typeof payload?.note === 'string' ? payload.note : undefined

      if (!toStatus) {
        return NextResponse.json({ error: '无效的目标状态' }, { status: 400 })
      }
      if (!changedBy) {
        return NextResponse.json({ error: '缺少操作者信息' }, { status: 400 })
      }

      const changePayload: RequirementStatusChangePayload = {
        toStatus,
        changedBy,
        note
      }

      const updated = requirementsMockStore.changeStatus(params.id, changePayload)
      return NextResponse.json({ data: updated })
    }

    const updatePayload: RequirementUpdatePayload = {}

    if (typeof payload?.title === 'string') {
      updatePayload.title = payload.title
    }

    if (typeof payload?.description === 'string') {
      updatePayload.description = payload.description
    }

    if (typeof payload?.projectId === 'string') {
      updatePayload.projectId = payload.projectId
    }

    if (Array.isArray(payload?.serviceIds)) {
      updatePayload.serviceIds = payload.serviceIds.map((id: unknown) => String(id))
    }

    const priority = coercePriority(payload?.priority)
    if (priority) {
      updatePayload.priority = priority
    }

    const status = coerceStatus(payload?.status)
    if (status) {
      updatePayload.status = status
    }

    if (typeof payload?.ownerId === 'string') {
      updatePayload.ownerId = payload.ownerId
    }

    if (Array.isArray(payload?.watcherIds)) {
      updatePayload.watcherIds = payload.watcherIds.map((id: unknown) => String(id))
    }

    if ('dueAt' in payload) {
      if (payload.dueAt === null || payload.dueAt === '') {
        updatePayload.dueAt = null
      } else if (typeof payload.dueAt === 'string') {
        updatePayload.dueAt = payload.dueAt
      }
    }

    if (Array.isArray(payload?.tags)) {
      updatePayload.tags = payload.tags.map((tag: unknown) => String(tag))
    }

    if (typeof payload?.updatedBy === 'string') {
      updatePayload.updatedBy = payload.updatedBy
    }

    const updated = requirementsMockStore.update(params.id, updatePayload)
    return NextResponse.json({ data: updated })
  } catch (error: unknown) {
    console.error('[Requirement][PATCH/:id] Failed to update requirement:', error)
    const message = error instanceof Error ? error.message : '更新需求失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const removed = requirementsMockStore.delete(params.id)
    if (!removed) {
      return NextResponse.json({ error: '未找到对应的需求' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[Requirement][DELETE/:id] Failed to delete requirement:', error)
    const message = error instanceof Error ? error.message : '删除需求失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
