import { NextRequest, NextResponse } from 'next/server'

import { aiMockStore } from '@/service/aiMockStore'
import { AIEmployeeStatus, AIEmployeeType } from '@/types/ai'

const isEmployeeType = (value: string): value is AIEmployeeType =>
  value === 'ENGINEER' || value === 'QA'

const isEmployeeStatus = (value: string): value is AIEmployeeStatus =>
  value === 'ACTIVE' || value === 'DISABLED'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const typeParam = searchParams.get('type') ?? undefined
  const statusParam = searchParams.get('status') ?? undefined
  const search = searchParams.get('search') ?? undefined
  const sortBy = searchParams.get('sortBy') as 'tasks' | 'lastTask' | null

  const result = aiMockStore.listEmployees({
    type: typeParam ? (typeParam === 'ALL' ? 'ALL' : isEmployeeType(typeParam) ? typeParam : undefined) : undefined,
    status: statusParam ? (statusParam === 'ALL' ? 'ALL' : isEmployeeStatus(statusParam) ? statusParam : undefined) : undefined,
    search,
    sortBy: sortBy === 'tasks' || sortBy === 'lastTask' ? sortBy : undefined
  })

  return NextResponse.json({
    data: result.items,
    meta: {
      totalEmployees: result.total,
      activeEmployees: result.active,
      tasksThisWeek: result.tasksThisWeek,
      typeDistribution: result.typeDistribution
    }
  })
}

export async function POST(request: NextRequest) {
  const payload = await request.json()

  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const type = typeof payload.type === 'string' && isEmployeeType(payload.type) ? payload.type : null
  const roleTemplateId = typeof payload.roleTemplateId === 'string' ? payload.roleTemplateId : ''
  const modelProvider = typeof payload.modelProvider === 'string' ? payload.modelProvider.trim() : ''
  const modelName = typeof payload.modelName === 'string' ? payload.modelName.trim() : ''
  const description =
    typeof payload.description === 'string'
      ? payload.description.trim() || null
      : payload.description === null
        ? null
        : undefined
  const status =
    typeof payload.status === 'string' && isEmployeeStatus(payload.status) ? payload.status : 'ACTIVE'

  if (!name) {
    return NextResponse.json({ error: '员工名称不能为空' }, { status: 400 })
  }

  if (!type) {
    return NextResponse.json({ error: '请选择合法的员工类型' }, { status: 400 })
  }

  if (!roleTemplateId) {
    return NextResponse.json({ error: '必须选择关联的角色模板' }, { status: 400 })
  }

  if (!modelProvider || !modelName) {
    return NextResponse.json({ error: '请完善模型提供方与模型名称' }, { status: 400 })
  }

  const capabilityTags: string[] = Array.isArray(payload.capabilityTags)
    ? payload.capabilityTags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    : typeof payload.capabilityTags === 'string'
      ? payload.capabilityTags
          .split(',')
          .map((tag: string) => tag.trim())
          .filter((tag: string) => tag.length > 0)
      : []

  const modelParams =
    typeof payload.modelParams === 'object' && payload.modelParams !== null ? payload.modelParams : {}

  try {
    const template = aiMockStore.getRoleTemplate(roleTemplateId)
    if (!template) {
      return NextResponse.json({ error: '角色模板不存在或已移除' }, { status: 404 })
    }

    const employee = aiMockStore.createEmployee({
      name,
      type,
      roleTemplateId,
      modelProvider,
      modelName,
      modelParams,
      capabilityTags,
      description,
      status
    })

    return NextResponse.json(employee, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '创建 AI 员工失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
