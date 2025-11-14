import { randomUUID } from 'crypto'

import {
  AIEmployee,
  AIEmployeeDetail,
  AIEmployeeListItem,
  AIEmployeeStatus,
  AIEmployeeType,
  AIModelParams,
  AIRoleTemplate,
  AIRoleTemplateApplicability,
  AIRoleTemplateListItem,
  AITaskAssignment,
  AITaskPriority,
  AITaskStatus
} from '@/types/ai'

const now = new Date()

const daysAgo = (days: number) => {
  const date = new Date(now)
  date.setDate(date.getDate() - days)
  return date
}

const iso = (date: Date) => date.toISOString()

const defaultModelParams = (overrides?: Partial<AIModelParams>): AIModelParams => ({
  temperature: 0.4,
  maxTokens: 2048,
  topP: 0.9,
  presencePenalty: 0,
  frequencyPenalty: 0,
  ...overrides
})

const roleTemplates: AIRoleTemplate[] = [
  {
    id: 'tmpl-frontend-dev-pro',
    name: '前端研发专家模板',
    applicableType: 'ENGINEER',
    systemPrompt:
      '你是一名经验丰富的前端研发工程师，擅长 React、TypeScript 与 TailwindCSS。请在确保代码可维护性的前提下高效完成任务。',
    behaviorGuidelines: ['所有代码需通过 ESLint 校验', '对外接口需更新 Storybook 示例', '遇到不明确需求需要主动发问'],
    toolPermissions: ['Git 仓库访问', 'CI 构建流水线', 'UI 测试工具'],
    defaultModelProvider: 'openai',
    defaultModelName: 'gpt-4o-mini',
    defaultModelParams: defaultModelParams({ temperature: 0.3, maxTokens: 3072 }),
    createdBy: 'product.ops',
    version: 3,
    createdAt: iso(daysAgo(60)),
    updatedAt: iso(daysAgo(7))
  },
  {
    id: 'tmpl-backend-dev',
    name: '后端服务研发模板',
    applicableType: 'ENGINEER',
    systemPrompt:
      '你是一位精通微服务与云原生的后端工程师，请确保输出的接口具备观测性与容错机制。',
    behaviorGuidelines: ['所有 API 需补充 OpenAPI 文档', '数据库变更前需生成迁移方案', '关键路径需含性能监控指标'],
    toolPermissions: ['Git 仓库访问', '数据库迁移工具', '可观测性面板'],
    defaultModelProvider: 'openai',
    defaultModelName: 'gpt-4.1',
    defaultModelParams: defaultModelParams({ temperature: 0.25, maxTokens: 4096 }),
    createdBy: 'tech.lead',
    version: 2,
    createdAt: iso(daysAgo(80)),
    updatedAt: iso(daysAgo(15))
  },
  {
    id: 'tmpl-qa-guardian',
    name: '质量守护者模板',
    applicableType: 'QA',
    systemPrompt: '你是一名注重细节的 QA 工程师，需要对功能流程进行全链路验证并记录缺陷。',
    behaviorGuidelines: ['执行完回归测试需输出覆盖报告', '发现阻塞缺陷需立即同步研发', '测试用例需按优先级维护'],
    toolPermissions: ['测试用例管理系统', '自动化测试平台', '缺陷跟踪系统'],
    defaultModelProvider: 'anthropic',
    defaultModelName: 'claude-3.5-sonnet',
    defaultModelParams: defaultModelParams({ temperature: 0.2, maxTokens: 2048 }),
    createdBy: 'qa.lead',
    version: 5,
    createdAt: iso(daysAgo(120)),
    updatedAt: iso(daysAgo(3))
  }
]

const aiEmployees: AIEmployee[] = [
  {
    id: 'ai-employee-frontend-01',
    name: '前端小玄',
    type: 'ENGINEER',
    roleTemplateId: 'tmpl-frontend-dev-pro',
    modelProvider: 'openai',
    modelName: 'gpt-4o-mini',
    modelParams: defaultModelParams({ temperature: 0.35, maxTokens: 3072 }),
    capabilityTags: ['前端重构', 'UI 优化', '单元测试'],
    description: '专注于前端体验改进与组件库维护，擅长快速定位 UI 缺陷。',
    status: 'ACTIVE',
    totalTaskCount: 0,
    lastTaskAt: undefined,
    createdAt: iso(daysAgo(75)),
    updatedAt: iso(daysAgo(2))
  },
  {
    id: 'ai-employee-backend-01',
    name: '后端玄策',
    type: 'ENGINEER',
    roleTemplateId: 'tmpl-backend-dev',
    modelProvider: 'openai',
    modelName: 'gpt-4.1',
    modelParams: defaultModelParams({ temperature: 0.2, maxTokens: 4096 }),
    capabilityTags: ['API 设计', '容器部署', '性能调优'],
    description: '熟悉微服务架构，能够独立完成复杂的后端任务并确保上线稳定性。',
    status: 'ACTIVE',
    totalTaskCount: 0,
    lastTaskAt: undefined,
    createdAt: iso(daysAgo(90)),
    updatedAt: iso(daysAgo(5))
  },
  {
    id: 'ai-employee-qa-01',
    name: '质量守护者 Beta',
    type: 'QA',
    roleTemplateId: 'tmpl-qa-guardian',
    modelProvider: 'anthropic',
    modelName: 'claude-3.5-sonnet',
    modelParams: defaultModelParams({ temperature: 0.2, maxTokens: 2048 }),
    capabilityTags: ['回归测试', '缺陷跟踪', '接口自动化'],
    description: '覆盖端到端的测试流程，擅长高风险模块的专项测试。',
    status: 'ACTIVE',
    totalTaskCount: 0,
    lastTaskAt: undefined,
    createdAt: iso(daysAgo(110)),
    updatedAt: iso(daysAgo(1))
  },
  {
    id: 'ai-employee-frontend-02',
    name: '体验守望者',
    type: 'ENGINEER',
    roleTemplateId: 'tmpl-frontend-dev-pro',
    modelProvider: 'openai',
    modelName: 'gpt-4o',
    modelParams: defaultModelParams({ temperature: 0.4, maxTokens: 4096 }),
    capabilityTags: ['可用性评估', '视觉规范', '动效设计'],
    description: '对用户体验极度敏感，擅长从用户角度评估界面交互。',
    status: 'DISABLED',
    totalTaskCount: 0,
    lastTaskAt: undefined,
    createdAt: iso(daysAgo(45)),
    updatedAt: iso(daysAgo(20))
  }
]

const taskAssignments: AITaskAssignment[] = [
  {
    id: 'task-frontend-001',
    aiEmployeeId: 'ai-employee-frontend-01',
    projectId: 'proj-xuanwu',
    applicationId: 'portal-web',
    branchName: 'feature/dashboard-polish',
    taskTitle: '优化仪表盘核心指标展示样式',
    taskDescription: '重新设计 KPI 卡片布局，确保在移动端具备良好适配能力。',
    expectedOutputs: ['Pull Request', 'UI 截图'],
    priority: 'HIGH',
    status: 'SUCCESS',
    mock: true,
    mockPayload: { jobId: 'mock-job-frontend-001' },
    resultSummary: '完成布局改版并补充了 Storybook 示例。',
    createdAt: iso(daysAgo(12)),
    updatedAt: iso(daysAgo(11)),
    completedAt: iso(daysAgo(11))
  },
  {
    id: 'task-frontend-002',
    aiEmployeeId: 'ai-employee-frontend-01',
    projectId: 'proj-xuanwu',
    applicationId: 'portal-web',
    branchName: 'bugfix/button-alignment',
    taskTitle: '修复登录页按钮错位问题',
    taskDescription: '排查登录页主按钮在 Safari 浏览器显示位置偏移的问题，并提交修复 PR。',
    expectedOutputs: ['修复提交记录', '测试截图'],
    priority: 'MEDIUM',
    status: 'SUCCESS',
    mock: true,
    mockPayload: { jobId: 'mock-job-frontend-002' },
    resultSummary: '调整 flex 布局参数并通过浏览器兼容性验证。',
    createdAt: iso(daysAgo(6)),
    updatedAt: iso(daysAgo(5)),
    completedAt: iso(daysAgo(5))
  },
  {
    id: 'task-backend-001',
    aiEmployeeId: 'ai-employee-backend-01',
    projectId: 'proj-xuanwu',
    applicationId: 'service-api',
    branchName: 'feature/observability',
    taskTitle: '为订单服务补充观测指标',
    taskDescription: '为订单创建接口增加扩展指标，并将日志接入 Loki。',
    expectedOutputs: ['PR 链接', '监控仪表盘快照'],
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    mock: true,
    mockPayload: { jobId: 'mock-job-backend-001' },
    createdAt: iso(daysAgo(3)),
    updatedAt: iso(daysAgo(1)),
    completedAt: undefined,
    resultSummary: '指标规则已提交评审中。'
  },
  {
    id: 'task-backend-002',
    aiEmployeeId: 'ai-employee-backend-01',
    projectId: 'proj-nova',
    applicationId: 'billing-service',
    branchName: 'hotfix/payment-timeout',
    taskTitle: '紧急修复支付超时告警',
    taskDescription: '排查支付链路超时率升高的原因，并提供临时缓解方案。',
    expectedOutputs: ['修复说明', '回滚预案'],
    priority: 'HIGH',
    status: 'SUCCESS',
    mock: true,
    mockPayload: { jobId: 'mock-job-backend-002' },
    resultSummary: '优化连接池参数并临时扩容 Pod 数量。',
    createdAt: iso(daysAgo(16)),
    updatedAt: iso(daysAgo(15)),
    completedAt: iso(daysAgo(15))
  },
  {
    id: 'task-qa-001',
    aiEmployeeId: 'ai-employee-qa-01',
    projectId: 'proj-xuanwu',
    applicationId: 'portal-web',
    branchName: 'release/2024.11.0',
    taskTitle: '11 月版本回归测试',
    taskDescription: '执行高优先级业务流程的冒烟测试，并整理输出缺陷清单。',
    expectedOutputs: ['测试报告', '缺陷单列表'],
    priority: 'HIGH',
    status: 'SUCCESS',
    mock: true,
    mockPayload: { jobId: 'mock-job-qa-001' },
    resultSummary: '共执行 52 条用例，发现 3 个阻塞问题已转研发跟进。',
    createdAt: iso(daysAgo(9)),
    updatedAt: iso(daysAgo(8)),
    completedAt: iso(daysAgo(8))
  },
  {
    id: 'task-qa-002',
    aiEmployeeId: 'ai-employee-qa-01',
    projectId: 'proj-nova',
    applicationId: 'billing-service',
    branchName: 'feature/usage-based-billing',
    taskTitle: '新计费策略接口联调测试',
    taskDescription: '验证新增计费策略接口的稳定性，并确保边界条件覆盖完整。',
    expectedOutputs: ['接口测试用例', '调用日志'],
    priority: 'MEDIUM',
    status: 'FAILED',
    mock: true,
    mockPayload: { jobId: 'mock-job-qa-002' },
    resultSummary: '在极端折扣场景下出现计算错误，已阻塞上线。',
    createdAt: iso(daysAgo(5)),
    updatedAt: iso(daysAgo(4)),
    completedAt: iso(daysAgo(4))
  }
]

const recalcEmployeeStats = (employeeId: string) => {
  const employee = aiEmployees.find((item) => item.id === employeeId)
  if (!employee) return
  const relatedTasks = taskAssignments.filter((task) => task.aiEmployeeId === employeeId)
  employee.totalTaskCount = relatedTasks.length
  if (relatedTasks.length === 0) {
    employee.lastTaskAt = undefined
    return
  }
  const sorted = [...relatedTasks].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  employee.lastTaskAt = sorted[0].updatedAt
}

aiEmployees.forEach((employee) => recalcEmployeeStats(employee.id))

const computeTasksThisWeek = () => {
  const nowDate = new Date()
  const sevenDaysAgo = new Date(nowDate)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return taskAssignments.filter((task) => new Date(task.createdAt) >= sevenDaysAgo).length
}

const getRoleTemplateSummary = (template: AIRoleTemplate): AIRoleTemplateListItem => ({
  ...template,
  usageCount: aiEmployees.filter((employee) => employee.roleTemplateId === template.id).length
})

type EmployeeListFilter = {
  type?: AIEmployeeType | 'ALL'
  status?: AIEmployeeStatus | 'ALL'
  search?: string
  sortBy?: 'tasks' | 'lastTask'
}

type CreateEmployeePayload = {
  name: string
  type: AIEmployeeType
  roleTemplateId: string
  modelProvider: string
  modelName: string
  modelParams: Partial<AIModelParams>
  capabilityTags: string[]
  description?: string | null
  status?: AIEmployeeStatus
}

type UpdateEmployeePayload = Partial<Omit<CreateEmployeePayload, 'type' | 'roleTemplateId'>> & {
  type?: AIEmployeeType
  roleTemplateId?: string
  status?: AIEmployeeStatus
  description?: string | null
}

type CreateRoleTemplatePayload = {
  name: string
  applicableType: AIRoleTemplateApplicability
  systemPrompt: string
  behaviorGuidelines: string[]
  toolPermissions: string[]
  defaultModelProvider: string
  defaultModelName: string
  defaultModelParams: Partial<AIModelParams>
  createdBy: string
}

type UpdateRoleTemplatePayload = Partial<Omit<CreateRoleTemplatePayload, 'createdBy'>> & {
  createdBy?: string
  versionIncrement?: boolean
}

type DispatchTaskPayload = {
  projectId: string
  applicationId: string
  branchName: string
  taskTitle: string
  taskDescription: string
  expectedOutputs: string[]
  priority: AITaskPriority
}

export const aiMockStore = {
  listEmployees(filter: EmployeeListFilter = {}) {
    const { search, sortBy } = filter
    const typeFilter = filter.type && filter.type !== 'ALL' ? filter.type : undefined
    const statusFilter = filter.status && filter.status !== 'ALL' ? filter.status : undefined

    let items = aiEmployees.filter((employee) => {
      const matchType = typeFilter ? employee.type === typeFilter : true
      const matchStatus = statusFilter ? employee.status === statusFilter : true
      const matchSearch = search
        ? employee.name.toLowerCase().includes(search.toLowerCase()) ||
          employee.capabilityTags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
        : true
      return matchType && matchStatus && matchSearch
    })

    if (sortBy === 'tasks') {
      items = [...items].sort((a, b) => b.totalTaskCount - a.totalTaskCount)
    } else if (sortBy === 'lastTask') {
      items = [...items].sort((a, b) => {
        const timeA = a.lastTaskAt ? new Date(a.lastTaskAt).getTime() : 0
        const timeB = b.lastTaskAt ? new Date(b.lastTaskAt).getTime() : 0
        return timeB - timeA
      })
    }

    const result: AIEmployeeListItem[] = items.map((employee) => {
      const template = roleTemplates.find((item) => item.id === employee.roleTemplateId)
      return {
        ...employee,
        roleTemplate: template
          ? {
              id: template.id,
              name: template.name,
              applicableType: template.applicableType
            }
          : {
              id: 'unknown',
              name: '未指定模板',
              applicableType: 'ALL'
            }
      }
    })

    return {
      items: result,
      total: aiEmployees.length,
      active: aiEmployees.filter((item) => item.status === 'ACTIVE').length,
      tasksThisWeek: computeTasksThisWeek(),
      typeDistribution: result.reduce<Record<AIEmployeeType, number>>(
        (acc, item) => {
          acc[item.type] = (acc[item.type] || 0) + 1
          return acc
        },
        { ENGINEER: 0, QA: 0 }
      )
    }
  },

  getEmployee(id: string): AIEmployeeDetail | null {
    const employee = aiEmployees.find((item) => item.id === id)
    if (!employee) return null
    const template = roleTemplates.find((item) => item.id === employee.roleTemplateId)
    return {
      ...employee,
      roleTemplate: template ?? undefined
    }
  },

  createEmployee(payload: CreateEmployeePayload): AIEmployeeListItem {
    const id = `ai-employee-${randomUUID()}`
    const createdAt = new Date()
    const base: AIEmployee = {
      id,
      name: payload.name,
      type: payload.type,
      roleTemplateId: payload.roleTemplateId,
      modelProvider: payload.modelProvider,
      modelName: payload.modelName,
      modelParams: defaultModelParams(payload.modelParams),
      capabilityTags: payload.capabilityTags,
      description: payload.description ?? undefined,
      status: payload.status ?? 'ACTIVE',
      totalTaskCount: 0,
      lastTaskAt: undefined,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString()
    }
    aiEmployees.unshift(base)

    const template = roleTemplates.find((item) => item.id === base.roleTemplateId)

    return {
      ...base,
      roleTemplate: template
        ? {
            id: template.id,
            name: template.name,
            applicableType: template.applicableType
          }
        : {
            id: 'unknown',
            name: '未指定模板',
            applicableType: 'ALL'
          }
    }
  },

  updateEmployee(id: string, payload: UpdateEmployeePayload): AIEmployeeDetail | null {
    const index = aiEmployees.findIndex((item) => item.id === id)
    if (index === -1) return null
    const prev = aiEmployees[index]
    const updated: AIEmployee = {
      ...prev,
      updatedAt: new Date().toISOString(),
      modelParams: payload.modelParams ? defaultModelParams(payload.modelParams) : prev.modelParams,
      capabilityTags: payload.capabilityTags ?? prev.capabilityTags
    }

    if (payload.name !== undefined) {
      updated.name = payload.name
    }
    if (payload.type) {
      updated.type = payload.type
    }
    if (payload.roleTemplateId) {
      updated.roleTemplateId = payload.roleTemplateId
    }
    if (payload.modelProvider) {
      updated.modelProvider = payload.modelProvider
    }
    if (payload.modelName) {
      updated.modelName = payload.modelName
    }
    if (payload.status) {
      updated.status = payload.status
    }
    if (payload.description === null) {
      updated.description = undefined
    } else if (payload.description !== undefined) {
      updated.description = payload.description
    }

    aiEmployees[index] = updated
    return this.getEmployee(id)
  },

  listRoleTemplates(): AIRoleTemplateListItem[] {
    return roleTemplates.map(getRoleTemplateSummary)
  },

  getRoleTemplate(id: string): AIRoleTemplateListItem | null {
    const template = roleTemplates.find((item) => item.id === id)
    if (!template) return null
    return getRoleTemplateSummary(template)
  },

  createRoleTemplate(payload: CreateRoleTemplatePayload): AIRoleTemplateListItem {
    const createdAt = new Date().toISOString()
    const template: AIRoleTemplate = {
      id: `tmpl-${randomUUID()}`,
      name: payload.name,
      applicableType: payload.applicableType,
      systemPrompt: payload.systemPrompt,
      behaviorGuidelines: payload.behaviorGuidelines,
      toolPermissions: payload.toolPermissions,
      defaultModelProvider: payload.defaultModelProvider,
      defaultModelName: payload.defaultModelName,
      defaultModelParams: defaultModelParams(payload.defaultModelParams),
      createdBy: payload.createdBy,
      version: 1,
      createdAt,
      updatedAt: createdAt
    }
    roleTemplates.unshift(template)
    return getRoleTemplateSummary(template)
  },

  updateRoleTemplate(id: string, payload: UpdateRoleTemplatePayload): AIRoleTemplateListItem | null {
    const index = roleTemplates.findIndex((item) => item.id === id)
    if (index === -1) return null
    const prev = roleTemplates[index]
    const version = payload.versionIncrement ? prev.version + 1 : prev.version
    const updated: AIRoleTemplate = {
      ...prev,
      ...payload,
      defaultModelParams: payload.defaultModelParams
        ? defaultModelParams(payload.defaultModelParams)
        : prev.defaultModelParams,
      behaviorGuidelines: payload.behaviorGuidelines ?? prev.behaviorGuidelines,
      toolPermissions: payload.toolPermissions ?? prev.toolPermissions,
      createdBy: payload.createdBy ?? prev.createdBy,
      version,
      updatedAt: new Date().toISOString()
    }
    roleTemplates[index] = updated
    return getRoleTemplateSummary(updated)
  },

  listEmployeeTasks(
    employeeId: string,
    options: {
      page?: number
      pageSize?: number
      status?: AITaskStatus | 'ALL'
    } = {}
  ) {
    const page = options.page && options.page > 0 ? options.page : 1
    const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 10
    const statusFilter = options.status && options.status !== 'ALL' ? options.status : undefined

    const tasks = taskAssignments
      .filter((task) => task.aiEmployeeId === employeeId)
      .filter((task) => (statusFilter ? task.status === statusFilter : true))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const start = (page - 1) * pageSize
    const items = tasks.slice(start, start + pageSize)

    return {
      items,
      total: tasks.length,
      page,
      pageSize
    }
  },

  dispatchTask(employeeId: string, payload: DispatchTaskPayload) {
    const employee = aiEmployees.find((item) => item.id === employeeId)
    if (!employee) {
      throw new Error('未找到对应的 AI 员工')
    }
    const nowIso = new Date().toISOString()
    const task: AITaskAssignment = {
      id: `mock-task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      aiEmployeeId: employeeId,
      projectId: payload.projectId,
      applicationId: payload.applicationId,
      branchName: payload.branchName,
      taskTitle: payload.taskTitle,
      taskDescription: payload.taskDescription,
      expectedOutputs: payload.expectedOutputs,
      priority: payload.priority,
      status: 'IN_PROGRESS',
      mock: true,
      mockPayload: { acceptedAt: nowIso },
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: undefined,
      resultSummary: undefined
    }
    taskAssignments.unshift(task)
    recalcEmployeeStats(employeeId)
    return task
  }
}
