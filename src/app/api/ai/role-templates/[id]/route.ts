import { NextRequest, NextResponse } from 'next/server'

import { aiMockStore } from '@/service/aiMockStore'
import { AIRoleTemplateApplicability } from '@/types/ai'

const isApplicability = (value: string): value is AIRoleTemplateApplicability =>
  value === 'ENGINEER' || value === 'QA' || value === 'ALL'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const template = aiMockStore.getRoleTemplate(params.id)
  if (!template) {
    return NextResponse.json({ error: '未找到角色模板' }, { status: 404 })
  }

  return NextResponse.json(template)
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await request.json()
  const updates: {
    name?: string
    applicableType?: AIRoleTemplateApplicability
    systemPrompt?: string
    behaviorGuidelines?: string[]
    toolPermissions?: string[]
    defaultModelProvider?: string
    defaultModelName?: string
    defaultModelParams?: Record<string, unknown>
    createdBy?: string
    versionIncrement?: boolean
  } = {}

  if (typeof payload.name === 'string') {
    updates.name = payload.name.trim()
  }

  if (typeof payload.applicableType === 'string' && isApplicability(payload.applicableType)) {
    updates.applicableType = payload.applicableType
  }

  if (typeof payload.systemPrompt === 'string') {
    updates.systemPrompt = payload.systemPrompt.trim()
  }

  if (Array.isArray(payload.behaviorGuidelines)) {
    updates.behaviorGuidelines = payload.behaviorGuidelines.filter(
      (item: unknown): item is string => typeof item === 'string' && item.trim().length > 0
    )
  }

  if (Array.isArray(payload.toolPermissions)) {
    updates.toolPermissions = payload.toolPermissions.filter(
      (item: unknown): item is string => typeof item === 'string' && item.trim().length > 0
    )
  }

  if (typeof payload.defaultModelProvider === 'string') {
    updates.defaultModelProvider = payload.defaultModelProvider.trim()
  }

  if (typeof payload.defaultModelName === 'string') {
    updates.defaultModelName = payload.defaultModelName.trim()
  }

  if (typeof payload.defaultModelParams === 'object' && payload.defaultModelParams !== null) {
    updates.defaultModelParams = payload.defaultModelParams
  }

  if (typeof payload.createdBy === 'string') {
    updates.createdBy = payload.createdBy.trim()
  }

  if (typeof payload.versionIncrement === 'boolean') {
    updates.versionIncrement = payload.versionIncrement
  }

  try {
    const result = aiMockStore.updateRoleTemplate(params.id, updates)
    if (!result) {
      return NextResponse.json({ error: '未找到角色模板' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '更新角色模板失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
