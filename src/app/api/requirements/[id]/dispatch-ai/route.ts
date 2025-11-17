import { NextRequest, NextResponse } from 'next/server'

import { requirementsMockStore } from '@/service/requirementsMockStore'
import { type RequirementDispatchPayload } from '@/types/requirement'
import { type AITaskPriority } from '@/types/ai'

const PRIORITY_VALUES: AITaskPriority[] = ['LOW', 'MEDIUM', 'HIGH']

const coercePriority = (value: unknown): AITaskPriority => {
  if (typeof value === 'string' && PRIORITY_VALUES.includes(value as AITaskPriority)) {
    return value as AITaskPriority
  }
  return 'MEDIUM'
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await request.json()
    const aiEmployeeIds: string[] = Array.isArray(payload?.aiEmployeeIds)
      ? payload.aiEmployeeIds.map((id: unknown) => String(id))
      : []

    const taskTitle = typeof payload?.taskTitle === 'string' ? payload.taskTitle.trim() : ''
    const taskDescription = typeof payload?.taskDescription === 'string' ? payload.taskDescription : ''
    const requestedBy = typeof payload?.requestedBy === 'string' ? payload.requestedBy : ''
    const branch = typeof payload?.branch === 'string' ? payload.branch : undefined
    const expectedOutputs = Array.isArray(payload?.expectedOutputs)
      ? payload.expectedOutputs.map((item: unknown) => String(item))
      : undefined

    if (aiEmployeeIds.length === 0) {
      return NextResponse.json({ error: '请选择至少一位 AI 员工' }, { status: 400 })
    }
    if (!taskTitle) {
      return NextResponse.json({ error: '请输入任务标题' }, { status: 400 })
    }
    if (!taskDescription) {
      return NextResponse.json({ error: '请输入任务描述' }, { status: 400 })
    }
    if (!requestedBy) {
      return NextResponse.json({ error: '缺少派发操作者信息' }, { status: 400 })
    }

    const priority = coercePriority(payload?.priority)

    const serviceIds = Array.isArray(payload?.serviceIds)
      ? payload.serviceIds.map((id: unknown) => String(id))
      : undefined

    const dispatchPayload: RequirementDispatchPayload = {
      aiEmployeeIds,
      taskTitle,
      taskDescription,
      branch,
      expectedOutputs,
      priority,
      projectId: typeof payload?.projectId === 'string' ? payload.projectId : undefined,
      serviceIds,
      requestedBy
    }

    const result = requirementsMockStore.dispatch(params.id, dispatchPayload)

    return NextResponse.json({ data: result.requirement, newlyCreatedTaskIds: result.newlyCreatedTaskIds })
  } catch (error: unknown) {
    console.error('[Requirement][POST/:id/dispatch-ai] Failed to dispatch requirement:', error)
    const message = error instanceof Error ? error.message : '派发任务失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
