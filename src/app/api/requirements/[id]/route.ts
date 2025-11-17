import { NextRequest, NextResponse } from 'next/server'

import { requirementService } from '@/service/requirementService'
import { type RequirementUpdatePayload } from '@/types/requirement'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const detail = await requirementService.get(params.id)
    if (!detail) {
      return NextResponse.json({ error: '未找到对应的需求' }, { status: 404 })
    }

    const aiEmployees = requirementService.listAiEmployees()

    return NextResponse.json({
      data: detail,
      meta: {
        aiEmployees
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

    const updatePayload: RequirementUpdatePayload = {}

    if (typeof payload?.title === 'string') {
      updatePayload.title = payload.title
    }

    if (typeof payload?.projectId === 'string') {
      updatePayload.projectId = payload.projectId
    }

    if (Array.isArray(payload?.serviceIds)) {
      updatePayload.serviceIds = payload.serviceIds.map((id: unknown) => String(id))
    }

    const updated = await requirementService.update(params.id, updatePayload)
    if (!updated) {
      return NextResponse.json({ error: '未找到对应的需求' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (error: unknown) {
    console.error('[Requirement][PATCH/:id] Failed to update requirement:', error)
    const message = error instanceof Error ? error.message : '更新需求失败'
    const status = message.includes('不存在') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const removed = await requirementService.delete(params.id)
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
