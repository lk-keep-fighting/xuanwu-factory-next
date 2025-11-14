import { NextRequest, NextResponse } from 'next/server'

import { aiMockStore } from '@/service/aiMockStore'
import { AITaskPriority } from '@/types/ai'

const isPriority = (value: string): value is AITaskPriority =>
  value === 'LOW' || value === 'MEDIUM' || value === 'HIGH'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await request.json()

  const projectId = typeof payload.projectId === 'string' ? payload.projectId.trim() : ''
  const applicationId = typeof payload.applicationId === 'string' ? payload.applicationId.trim() : ''
  const branchName = typeof payload.branchName === 'string' ? payload.branchName.trim() : ''
  const taskTitle = typeof payload.taskTitle === 'string' ? payload.taskTitle.trim() : ''
  const taskDescription = typeof payload.taskDescription === 'string' ? payload.taskDescription.trim() : ''

  if (!projectId || !applicationId || !branchName || !taskTitle || !taskDescription) {
    return NextResponse.json({ error: '请完善任务上下文与任务描述信息' }, { status: 400 })
  }

  const expectedOutputs: string[] = Array.isArray(payload.expectedOutputs)
    ? payload.expectedOutputs.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : typeof payload.expectedOutputs === 'string'
      ? payload.expectedOutputs
          .split(',')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0)
      : []

  const priority =
    typeof payload.priority === 'string' && isPriority(payload.priority) ? payload.priority : 'MEDIUM'

  try {
    const task = aiMockStore.dispatchTask(params.id, {
      projectId,
      applicationId,
      branchName,
      taskTitle,
      taskDescription,
      expectedOutputs,
      priority
    })

    return NextResponse.json({
      status: 'accepted',
      taskId: task.id,
      message: '任务已进入 AI 员工执行队列（Mock）',
      task
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '派发任务失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
