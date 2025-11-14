import { NextRequest, NextResponse } from 'next/server'

import { aiMockStore } from '@/service/aiMockStore'
import { AIEmployeeStatus, AIEmployeeType } from '@/types/ai'

const isEmployeeType = (value: string): value is AIEmployeeType =>
  value === 'ENGINEER' || value === 'QA'

const isEmployeeStatus = (value: string): value is AIEmployeeStatus =>
  value === 'ACTIVE' || value === 'DISABLED'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const employee = aiMockStore.getEmployee(params.id)
  if (!employee) {
    return NextResponse.json({ error: '未找到对应的 AI 员工' }, { status: 404 })
  }

  return NextResponse.json(employee)
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await request.json()
  const updates: {
    name?: string
    type?: AIEmployeeType
    roleTemplateId?: string
    modelProvider?: string
    modelName?: string
    modelParams?: Record<string, unknown>
    capabilityTags?: string[]
    description?: string | null
    status?: AIEmployeeStatus
  } = {}

  if (typeof payload.name === 'string') {
    updates.name = payload.name.trim()
  }

  if (typeof payload.type === 'string' && isEmployeeType(payload.type)) {
    updates.type = payload.type
  }

  if (typeof payload.roleTemplateId === 'string') {
    updates.roleTemplateId = payload.roleTemplateId
  }

  if (typeof payload.modelProvider === 'string') {
    updates.modelProvider = payload.modelProvider.trim()
  }

  if (typeof payload.modelName === 'string') {
    updates.modelName = payload.modelName.trim()
  }

  if (typeof payload.modelParams === 'object' && payload.modelParams !== null) {
    updates.modelParams = payload.modelParams
  }

  if (Array.isArray(payload.capabilityTags)) {
    updates.capabilityTags = payload.capabilityTags.filter(
      (tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0
    )
  }

  if (typeof payload.description === 'string') {
    const trimmed = payload.description.trim()
    updates.description = trimmed === '' ? null : trimmed
  } else if (payload.description === null) {
    updates.description = null
  }

  if (typeof payload.status === 'string' && isEmployeeStatus(payload.status)) {
    updates.status = payload.status
  }

  try {
    if (updates.roleTemplateId) {
      const template = aiMockStore.getRoleTemplate(updates.roleTemplateId)
      if (!template) {
        return NextResponse.json({ error: '角色模板不存在或已移除' }, { status: 404 })
      }
    }

    const result = aiMockStore.updateEmployee(params.id, updates)
    if (!result) {
      return NextResponse.json({ error: '未找到对应的 AI 员工' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '更新 AI 员工失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
