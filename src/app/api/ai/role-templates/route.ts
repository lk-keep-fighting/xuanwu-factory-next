import { NextRequest, NextResponse } from 'next/server'

import { aiMockStore } from '@/service/aiMockStore'
import { AIRoleTemplateApplicability } from '@/types/ai'

const isApplicability = (value: string): value is AIRoleTemplateApplicability =>
  value === 'ENGINEER' || value === 'QA' || value === 'ALL'

export async function GET() {
  const templates = aiMockStore.listRoleTemplates()
  return NextResponse.json(templates)
}

export async function POST(request: NextRequest) {
  const payload = await request.json()

  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const applicableType =
    typeof payload.applicableType === 'string' && isApplicability(payload.applicableType)
      ? payload.applicableType
      : null
  const systemPrompt = typeof payload.systemPrompt === 'string' ? payload.systemPrompt.trim() : ''
  const createdBy = typeof payload.createdBy === 'string' ? payload.createdBy.trim() : 'system'

  if (!name) {
    return NextResponse.json({ error: '模板名称不能为空' }, { status: 400 })
  }

  if (!applicableType) {
    return NextResponse.json({ error: '请选择有效的适用员工类型' }, { status: 400 })
  }

  if (!systemPrompt) {
    return NextResponse.json({ error: '请填写系统提示词' }, { status: 400 })
  }

  const behaviorGuidelines: string[] = Array.isArray(payload.behaviorGuidelines)
    ? payload.behaviorGuidelines.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : typeof payload.behaviorGuidelines === 'string'
      ? payload.behaviorGuidelines
          .split('\n')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0)
      : []

  const toolPermissions: string[] = Array.isArray(payload.toolPermissions)
    ? payload.toolPermissions.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : typeof payload.toolPermissions === 'string'
      ? payload.toolPermissions
          .split('\n')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0)
      : []

  const defaultModelProvider =
    typeof payload.defaultModelProvider === 'string' ? payload.defaultModelProvider.trim() : ''
  const defaultModelName = typeof payload.defaultModelName === 'string' ? payload.defaultModelName.trim() : ''

  if (!defaultModelProvider || !defaultModelName) {
    return NextResponse.json({ error: '请设置默认模型提供方与模型名称' }, { status: 400 })
  }

  const defaultModelParams =
    typeof payload.defaultModelParams === 'object' && payload.defaultModelParams !== null
      ? payload.defaultModelParams
      : {}

  try {
    const template = aiMockStore.createRoleTemplate({
      name,
      applicableType,
      systemPrompt,
      behaviorGuidelines,
      toolPermissions,
      defaultModelProvider,
      defaultModelName,
      defaultModelParams,
      createdBy
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '创建角色模板失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
