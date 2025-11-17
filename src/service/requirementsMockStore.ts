import { randomUUID } from 'crypto'

import {
  type RequirementAiTaskLink,
  type RequirementCreatePayload,
  type RequirementDetail,
  type RequirementDispatchPayload,
  type RequirementDispatchResult,
  type RequirementFilterOptions,
  type RequirementListItem,
  type RequirementListQuery,
  type RequirementListResponse,
  type RequirementListStats,
  type RequirementPersonRef,
  type RequirementPriority,
  type RequirementProjectRef,
  type RequirementServiceRef,
  type RequirementStatus,
  type RequirementStatusChangePayload,
  type RequirementStatusHistoryEntry,
  type RequirementUpdatePayload
} from '@/types/requirement'
import { type AIEmployeeType } from '@/types/ai'

const DAY_IN_MS = 24 * 60 * 60 * 1000

const today = () => new Date()
const daysFromNow = (days: number) => {
  const base = today()
  base.setDate(base.getDate() + days)
  return base
}
const iso = (date: Date) => date.toISOString()

const projects: RequirementProjectRef[] = [
  { id: 'proj-xuanwu', name: '玄武工厂平台', identifier: 'xuanwu-factory' },
  { id: 'proj-nova', name: 'Nova Billing 中台', identifier: 'nova-billing' },
  { id: 'proj-lake', name: '数据湖治理平台', identifier: 'lake-governance' }
]

const services: RequirementServiceRef[] = [
  { id: 'svc-portal-web', projectId: 'proj-xuanwu', name: 'Portal Web 前端', description: '面向终端用户的运营门户前端应用。' },
  { id: 'svc-ai-center-api', projectId: 'proj-xuanwu', name: 'AI 执行控制中心 API', description: '对接 AI 员工调度的核心后端服务。' },
  { id: 'svc-billing-engine', projectId: 'proj-nova', name: 'Billing 引擎服务', description: '处理计费策略与账单生成逻辑。' },
  { id: 'svc-billing-console', projectId: 'proj-nova', name: '计费运营后台', description: '供运营人员配置与监控账单的前端系统。' },
  { id: 'svc-data-pipeline', projectId: 'proj-lake', name: '数据同步管道', description: '负责跨集群的数据采集与同步。' },
  { id: 'svc-data-quality', projectId: 'proj-lake', name: '数据质量校验服务', description: '提供数据清洗、校验与告警能力。' }
]

const people: RequirementPersonRef[] = [
  { id: 'user-chenying', name: '陈映', title: '产品负责人', email: 'chenying@example.com', avatarColor: '#2563eb' },
  { id: 'user-wangrui', name: '王睿', title: '需求管理员', email: 'wangrui@example.com', avatarColor: '#ea580c' },
  { id: 'user-lixia', name: '李霞', title: '前端研发负责人', email: 'lixia@example.com', avatarColor: '#7c3aed' },
  { id: 'user-zhouyang', name: '周阳', title: '交付经理', email: 'zhouyang@example.com', avatarColor: '#16a34a' },
  { id: 'user-zhangkai', name: '张凯', title: '质量负责人', email: 'zhangkai@example.com', avatarColor: '#0f172a' },
  { id: 'user-lizhen', name: '李真', title: '后端研发', email: 'lizhen@example.com', avatarColor: '#1d4ed8' }
]

const aiEmployees: Array<{ id: string; name: string; type: AIEmployeeType }> = [
  { id: 'ai-employee-frontend-01', name: '前端小玄', type: 'ENGINEER' },
  { id: 'ai-employee-backend-01', name: '后端玄策', type: 'ENGINEER' },
  { id: 'ai-employee-qa-01', name: '质量守护者 Beta', type: 'QA' }
]

const projectMap = new Map(projects.map((item) => [item.id, item]))
const serviceMap = new Map(services.map((item) => [item.id, item]))
const personMap = new Map(people.map((item) => [item.id, item]))
const aiEmployeeMap = new Map(aiEmployees.map((item) => [item.id, item]))

const createSummary = (description: string) => {
  const normalized = description
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`\-\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (normalized.length <= 120) return normalized
  return `${normalized.slice(0, 118)}…`
}

const calculateRemainingDays = (dueAt?: string) => {
  if (!dueAt) return undefined
  const dueDate = new Date(dueAt)
  const diff = dueDate.getTime() - today().getTime()
  return Math.ceil(diff / DAY_IN_MS)
}

const STATUS_TRANSITIONS: Record<RequirementStatus, RequirementStatus[]> = {
  DRAFT: ['TODO', 'IN_PROGRESS', 'CANCELED'],
  TODO: ['IN_PROGRESS', 'CANCELED'],
  IN_PROGRESS: ['DONE', 'CANCELED'],
  DONE: ['IN_PROGRESS', 'CANCELED'],
  CANCELED: ['TODO']
}

type RequirementTaskLinkInternal = RequirementAiTaskLink & {
  aiEmployeeId: string
}

type RequirementStatusHistoryInternal = RequirementStatusHistoryEntry & {
  changedById: string
}

type RequirementRecord = {
  id: string
  code: string
  title: string
  description: string
  projectId: string
  serviceIds: string[]
  priority: RequirementPriority
  status: RequirementStatus
  ownerId: string
  watcherIds: string[]
  tags: string[]
  dueAt?: string
  createdAt: string
  updatedAt: string
  lastAiDispatchAt?: string
  aiTaskCount: number
  taskLinks: RequirementTaskLinkInternal[]
  statusHistory: RequirementStatusHistoryInternal[]
  lastUpdatedById?: string
}

const initialRequirementRecords: RequirementRecord[] = [
  {
    id: 'req-202411-001',
    code: 'REQ-2024-1101',
    title: '需求管理模块前端原型搭建',
    description:
      '## 目标\n\n构建以《需求管理模块设计》为依据的前端原型，覆盖列表、详情、派发等核心场景。\n\n### 关键验收点\n- 列表页可按状态、项目筛选，展示剩余时间与派发数量。\n- 需求详情具备 Markdown 展示、状态历史与 AI 任务关联。\n- 支持在前端直接发起派发表单，模拟调用 AI 员工接口。\n\n```mermaid\nflowchart LR\n  A[需求录入] --> B[需求列表]\n  B --> C[派发给 AI]\n  C --> D[任务跟踪]\n```',
    projectId: 'proj-xuanwu',
    serviceIds: ['svc-portal-web', 'svc-ai-center-api'],
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    ownerId: 'user-chenying',
    watcherIds: ['user-wangrui', 'user-lixia'],
    tags: ['AI 协同', '前端'],
    dueAt: iso(daysFromNow(3)),
    createdAt: iso(daysFromNow(-14)),
    updatedAt: iso(daysFromNow(-1)),
    lastAiDispatchAt: iso(daysFromNow(-2)),
    aiTaskCount: 2,
    taskLinks: [
      {
        id: 'req-task-001',
        aiTaskAssignmentId: 'ai-task-frontend-req',
        aiEmployeeId: 'ai-employee-frontend-01',
        aiEmployee: aiEmployeeMap.get('ai-employee-frontend-01')!,
        taskTitle: '完成原型界面初版布局',
        projectId: 'proj-xuanwu',
        projectName: projectMap.get('proj-xuanwu')?.name ?? '',
        serviceId: 'svc-portal-web',
        serviceName: serviceMap.get('svc-portal-web')?.name,
        branchName: 'feature/requirements-ui',
        expectedOutputs: ['界面截图', '交互说明'],
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        resultSummary: '正在实现列表与详情页面骨架。',
        createdAt: iso(daysFromNow(-5)),
        updatedAt: iso(daysFromNow(-1))
      },
      {
        id: 'req-task-002',
        aiTaskAssignmentId: 'ai-task-qa-req',
        aiEmployeeId: 'ai-employee-qa-01',
        aiEmployee: aiEmployeeMap.get('ai-employee-qa-01')!,
        taskTitle: '校验需求状态流转逻辑',
        projectId: 'proj-xuanwu',
        projectName: projectMap.get('proj-xuanwu')?.name ?? '',
        serviceId: 'svc-ai-center-api',
        serviceName: serviceMap.get('svc-ai-center-api')?.name,
        branchName: 'feature/requirements-ui',
        expectedOutputs: ['测试用例清单'],
        priority: 'MEDIUM',
        status: 'PENDING',
        resultSummary: '等待 UI 原型定稿后执行。',
        createdAt: iso(daysFromNow(-2)),
        updatedAt: iso(daysFromNow(-2))
      }
    ],
    statusHistory: [
      {
        id: 'status-001',
        fromStatus: null,
        toStatus: 'TODO',
        changedById: 'user-chenying',
        changedBy: personMap.get('user-chenying')!,
        note: '根据产品评审录入初版需求',
        createdAt: iso(daysFromNow(-14))
      },
      {
        id: 'status-002',
        fromStatus: 'TODO',
        toStatus: 'IN_PROGRESS',
        changedById: 'user-lixia',
        changedBy: personMap.get('user-lixia')!,
        note: '发起前端实现工作流',
        createdAt: iso(daysFromNow(-4))
      }
    ],
    lastUpdatedById: 'user-lixia'
  },
  {
    id: 'req-202411-002',
    code: 'REQ-2024-1102',
    title: 'AI 派发流程联调',
    description:
      '为 AI 员工派发提供连通性校验，模拟多位 AI 员工接单后的提示效果。\n\n- 提供派发表单，支持批量选择 AI 员工与期望产出。\n- Mock 返回数据需展示任务 ID 与状态。',
    projectId: 'proj-xuanwu',
    serviceIds: ['svc-ai-center-api'],
    priority: 'HIGH',
    status: 'TODO',
    ownerId: 'user-wangrui',
    watcherIds: ['user-zhangkai', 'user-chenying'],
    tags: ['AI 协同', '联调'],
    dueAt: iso(daysFromNow(7)),
    createdAt: iso(daysFromNow(-7)),
    updatedAt: iso(daysFromNow(-2)),
    lastAiDispatchAt: undefined,
    aiTaskCount: 0,
    taskLinks: [],
    statusHistory: [
      {
        id: 'status-003',
        fromStatus: null,
        toStatus: 'TODO',
        changedById: 'user-wangrui',
        changedBy: personMap.get('user-wangrui')!,
        note: '产品负责人补充需求细节',
        createdAt: iso(daysFromNow(-7))
      }
    ],
    lastUpdatedById: 'user-wangrui'
  },
  {
    id: 'req-202411-003',
    code: 'REQ-2024-1026',
    title: '需求数据模型设计完善',
    description:
      '根据后端设计稿，补充 Requirement 相关 Prisma 模型与字段注释，确保前后端字段一致。',
    projectId: 'proj-nova',
    serviceIds: ['svc-billing-engine'],
    priority: 'MEDIUM',
    status: 'DONE',
    ownerId: 'user-lizhen',
    watcherIds: ['user-zhouyang'],
    tags: ['数据模型'],
    dueAt: iso(daysFromNow(-3)),
    createdAt: iso(daysFromNow(-20)),
    updatedAt: iso(daysFromNow(-1)),
    lastAiDispatchAt: iso(daysFromNow(-12)),
    aiTaskCount: 1,
    taskLinks: [
      {
        id: 'req-task-003',
        aiTaskAssignmentId: 'ai-task-backend-req-model',
        aiEmployeeId: 'ai-employee-backend-01',
        aiEmployee: aiEmployeeMap.get('ai-employee-backend-01')!,
        taskTitle: '核对 Requirement Prisma 模型字段',
        projectId: 'proj-nova',
        projectName: projectMap.get('proj-nova')?.name ?? '',
        serviceId: 'svc-billing-engine',
        serviceName: serviceMap.get('svc-billing-engine')?.name,
        branchName: 'feature/requirements-model',
        expectedOutputs: ['Prisma schema diff'],
        priority: 'MEDIUM',
        status: 'SUCCESS',
        resultSummary: '补充 descriptionHtml、statusHistory 表关系，产出 diff 文档。',
        createdAt: iso(daysFromNow(-15)),
        updatedAt: iso(daysFromNow(-13))
      }
    ],
    statusHistory: [
      {
        id: 'status-004',
        fromStatus: null,
        toStatus: 'TODO',
        changedById: 'user-zhouyang',
        changedBy: personMap.get('user-zhouyang')!,
        createdAt: iso(daysFromNow(-20)),
        note: '项目例会上讨论后补充到排期'
      },
      {
        id: 'status-005',
        fromStatus: 'TODO',
        toStatus: 'IN_PROGRESS',
        changedById: 'user-lizhen',
        changedBy: personMap.get('user-lizhen')!,
        createdAt: iso(daysFromNow(-16)),
        note: '启动与 AI 协同梳理字段'
      },
      {
        id: 'status-006',
        fromStatus: 'IN_PROGRESS',
        toStatus: 'DONE',
        changedById: 'user-zhouyang',
        changedBy: personMap.get('user-zhouyang')!,
        createdAt: iso(daysFromNow(-2)),
        note: '评审通过，确认验收'
      }
    ],
    lastUpdatedById: 'user-zhouyang'
  },
  {
    id: 'req-202411-004',
    code: 'REQ-2024-1110',
    title: '需求状态流转规则梳理',
    description:
      '整理状态流转规则，并输出成 Wiki 用于团队对齐，包含异常状态处理策略。',
    projectId: 'proj-xuanwu',
    serviceIds: ['svc-portal-web'],
    priority: 'LOW',
    status: 'DRAFT',
    ownerId: 'user-wangrui',
    watcherIds: ['user-chenying', 'user-zhangkai'],
    tags: ['流程规范'],
    dueAt: iso(daysFromNow(12)),
    createdAt: iso(daysFromNow(-3)),
    updatedAt: iso(daysFromNow(-3)),
    lastAiDispatchAt: undefined,
    aiTaskCount: 0,
    taskLinks: [],
    statusHistory: [
      {
        id: 'status-007',
        fromStatus: null,
        toStatus: 'DRAFT',
        changedById: 'user-wangrui',
        changedBy: personMap.get('user-wangrui')!,
        note: '记录待整理事项',
        createdAt: iso(daysFromNow(-3))
      }
    ],
    lastUpdatedById: 'user-wangrui'
  },
  {
    id: 'req-202411-005',
    code: 'REQ-2024-1008',
    title: '计费运营后台体验优化',
    description:
      '优化 Nova 计费运营后台在需求列表展示的交互体验，提升筛选能力与信息密度。',
    projectId: 'proj-nova',
    serviceIds: ['svc-billing-console'],
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    ownerId: 'user-zhouyang',
    watcherIds: ['user-lizhen', 'user-zhangkai'],
    tags: ['体验优化'],
    dueAt: iso(daysFromNow(-2)),
    createdAt: iso(daysFromNow(-10)),
    updatedAt: iso(daysFromNow(-1)),
    lastAiDispatchAt: iso(daysFromNow(-1)),
    aiTaskCount: 1,
    taskLinks: [
      {
        id: 'req-task-004',
        aiTaskAssignmentId: 'ai-task-frontend-billing',
        aiEmployeeId: 'ai-employee-frontend-01',
        aiEmployee: aiEmployeeMap.get('ai-employee-frontend-01')!,
        taskTitle: '重构需求表格搜索与筛选交互',
        projectId: 'proj-nova',
        projectName: projectMap.get('proj-nova')?.name ?? '',
        serviceId: 'svc-billing-console',
        serviceName: serviceMap.get('svc-billing-console')?.name,
        branchName: 'feature/billing-table-refine',
        expectedOutputs: ['原型链接', '交互说明'],
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        resultSummary: '完成原型方案，待评审确认。',
        createdAt: iso(daysFromNow(-4)),
        updatedAt: iso(daysFromNow(-1))
      }
    ],
    statusHistory: [
      {
        id: 'status-008',
        fromStatus: null,
        toStatus: 'TODO',
        changedById: 'user-zhouyang',
        changedBy: personMap.get('user-zhouyang')!,
        createdAt: iso(daysFromNow(-10))
      },
      {
        id: 'status-009',
        fromStatus: 'TODO',
        toStatus: 'IN_PROGRESS',
        changedById: 'user-lizhen',
        changedBy: personMap.get('user-lizhen')!,
        note: '安排前端与 AI 协同推进',
        createdAt: iso(daysFromNow(-5))
      }
    ],
    lastUpdatedById: 'user-lizhen'
  },
  {
    id: 'req-202411-006',
    code: 'REQ-2024-0916',
    title: '数据质量监控增强',
    description:
      '为数据湖治理平台增加需求字段的监控指标，确保后续派发结果可追踪。',
    projectId: 'proj-lake',
    serviceIds: ['svc-data-quality', 'svc-data-pipeline'],
    priority: 'MEDIUM',
    status: 'CANCELED',
    ownerId: 'user-zhangkai',
    watcherIds: ['user-zhouyang'],
    tags: ['监控指标'],
    dueAt: iso(daysFromNow(15)),
    createdAt: iso(daysFromNow(-30)),
    updatedAt: iso(daysFromNow(-6)),
    lastAiDispatchAt: undefined,
    aiTaskCount: 0,
    taskLinks: [],
    statusHistory: [
      {
        id: 'status-010',
        fromStatus: null,
        toStatus: 'TODO',
        changedById: 'user-zhangkai',
        changedBy: personMap.get('user-zhangkai')!,
        createdAt: iso(daysFromNow(-30))
      },
      {
        id: 'status-011',
        fromStatus: 'TODO',
        toStatus: 'CANCELED',
        changedById: 'user-zhangkai',
        changedBy: personMap.get('user-zhangkai')!,
        note: '业务优先级调整，改至下一季度',
        createdAt: iso(daysFromNow(-6))
      }
    ],
    lastUpdatedById: 'user-zhangkai'
  }
]

const requirementRecords: RequirementRecord[] = initialRequirementRecords

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const deriveProgress = (record: RequirementRecord, taskLinks: RequirementAiTaskLink[]) => {
  if (taskLinks.length === 0) {
    switch (record.status) {
      case 'DONE':
        return 100
      case 'IN_PROGRESS':
        return 55
      case 'TODO':
        return 30
      case 'DRAFT':
        return 15
      default:
        return 5
    }
  }
  const completed = taskLinks.filter((task) => task.status === 'SUCCESS').length
  const progress = Math.round((completed / taskLinks.length) * 100)
  return Math.min(progress, 100)
}

const computeRiskLevel = (record: RequirementRecord, isOverdue: boolean): 'LOW' | 'MEDIUM' | 'HIGH' => {
  if (isOverdue && record.status !== 'DONE' && record.status !== 'CANCELED') {
    return 'HIGH'
  }
  if (record.priority === 'HIGH') {
    return record.status === 'DONE' ? 'LOW' : 'MEDIUM'
  }
  if (record.priority === 'MEDIUM') {
    return 'MEDIUM'
  }
  return 'LOW'
}

const buildDetail = (record: RequirementRecord): RequirementDetail => {
  const project = clone(projectMap.get(record.projectId) ?? projects[0])
  const serviceRefs = record.serviceIds
    .map((id) => serviceMap.get(id))
    .filter((svc): svc is RequirementServiceRef => Boolean(svc))
    .map((svc) => clone(svc))

  const owner = clone(personMap.get(record.ownerId) ?? people[0])
  const watcherRefs = record.watcherIds
    .map((id) => personMap.get(id))
    .filter((person): person is RequirementPersonRef => Boolean(person))
    .map((person) => clone(person))

  const history = record.statusHistory.map((entry) => ({
    ...entry,
    changedBy: clone(personMap.get(entry.changedById) ?? people[0])
  }))

  const taskLinks = record.taskLinks.map((link) => ({
    ...link,
    aiEmployee: clone(aiEmployeeMap.get(link.aiEmployeeId) ?? aiEmployees[0]),
    projectName: projectMap.get(link.projectId)?.name ?? project.name,
    serviceName: link.serviceId ? serviceMap.get(link.serviceId)?.name : undefined
  }))

  const remainingDays = calculateRemainingDays(record.dueAt)
  const isOverdue = typeof remainingDays === 'number' ? remainingDays < 0 : false
  const progressPercentage = deriveProgress(record, taskLinks)
  const riskLevel = computeRiskLevel(record, isOverdue)

  const detail: RequirementDetail = {
    id: record.id,
    code: record.code,
    title: record.title,
    description: record.description,
    summary: createSummary(record.description),
    project,
    services: serviceRefs,
    priority: record.priority,
    status: record.status,
    owner,
    watchers: watcherRefs,
    tags: record.tags,
    dueAt: record.dueAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastAiDispatchAt: record.lastAiDispatchAt,
    aiTaskCount: taskLinks.length,
    taskLinks,
    statusHistory: history,
    lastUpdatedBy: record.lastUpdatedById ? clone(personMap.get(record.lastUpdatedById) ?? people[0]) : undefined,
    progressPercentage,
    isOverdue,
    remainingDays,
    riskLevel
  }

  return detail
}

const toListItem = (record: RequirementRecord): RequirementListItem => {
  const detail = buildDetail(record)
  const {
    description: _description,
    statusHistory: _history,
    taskLinks: _taskLinks,
    lastUpdatedBy: _lastUpdatedBy,
    ...listItem
  } = detail
  return listItem
}

const computeStats = (): RequirementListStats => {
  const stats: RequirementListStats = {
    total: requirementRecords.length,
    draft: 0,
    todo: 0,
    inProgress: 0,
    done: 0,
    canceled: 0,
    overdue: 0
  }

  requirementRecords.forEach((record) => {
    switch (record.status) {
      case 'DRAFT':
        stats.draft += 1
        break
      case 'TODO':
        stats.todo += 1
        break
      case 'IN_PROGRESS':
        stats.inProgress += 1
        break
      case 'DONE':
        stats.done += 1
        break
      case 'CANCELED':
        stats.canceled += 1
        break
    }

    const remaining = calculateRemainingDays(record.dueAt)
    if (typeof remaining === 'number' && remaining < 0 && record.status !== 'DONE' && record.status !== 'CANCELED') {
      stats.overdue += 1
    }
  })

  return stats
}

const collectFilters = (): RequirementFilterOptions => {
  const uniqueWatcherIds = new Set<string>()
  const uniqueTags = new Set<string>()

  requirementRecords.forEach((record) => {
    record.watcherIds.forEach((id) => uniqueWatcherIds.add(id))
    record.tags.forEach((tag) => uniqueTags.add(tag))
  })

  return {
    projects: clone(projects),
    services: clone(services),
    owners: clone(people),
    watchers: clone(people.filter((person) => uniqueWatcherIds.has(person.id))),
    priorities: ['LOW', 'MEDIUM', 'HIGH'],
    statuses: ['DRAFT', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELED'],
    tags: Array.from(uniqueTags)
  }
}

const applyStatusChange = (
  record: RequirementRecord,
  payload: RequirementStatusChangePayload
) => {
  if (record.status === payload.toStatus) {
    return
  }

  const nowIso = iso(today())
  const historyEntry: RequirementStatusHistoryInternal = {
    id: randomUUID(),
    fromStatus: record.status,
    toStatus: payload.toStatus,
    changedById: payload.changedBy,
    changedBy: personMap.get(payload.changedBy) ?? people[0],
    note: payload.note,
    createdAt: nowIso
  }

  record.status = payload.toStatus
  record.updatedAt = nowIso
  record.statusHistory = [...record.statusHistory, historyEntry]
  record.lastUpdatedById = payload.changedBy
}

const applySort = (
  records: RequirementRecord[],
  sortBy: RequirementListQuery['sortBy'],
  sortOrder: RequirementListQuery['sortOrder']
) => {
  const order = sortOrder === 'asc' ? 1 : -1

  return [...records].sort((a, b) => {
    if (sortBy === 'dueAt') {
      const dueA = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY
      const dueB = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY
      if (dueA === dueB) return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * order
      return (dueA - dueB) * order
    }

    if (sortBy === 'priority') {
      const priorityWeight: Record<RequirementPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }
      const diff = priorityWeight[a.priority] - priorityWeight[b.priority]
      if (diff !== 0) return diff * order
      return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * order
    }

    // default sort by updatedAt
    return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * order
  })
}

const filterRecords = (records: RequirementRecord[], query: RequirementListQuery) => {
  return records.filter((record) => {
    if (query.statuses && query.statuses.length > 0 && !query.statuses.includes(record.status)) {
      return false
    }

    if (query.priorities && query.priorities.length > 0 && !query.priorities.includes(record.priority)) {
      return false
    }

    if (query.projectId && record.projectId !== query.projectId) {
      return false
    }

    if (query.serviceId && !record.serviceIds.includes(query.serviceId)) {
      return false
    }

    if (query.ownerId && record.ownerId !== query.ownerId) {
      return false
    }

    if (query.onlyOverdue) {
      const remaining = calculateRemainingDays(record.dueAt)
      if (!(typeof remaining === 'number' && remaining < 0 && record.status !== 'DONE' && record.status !== 'CANCELED')) {
        return false
      }
    }

    if (query.aiDispatch === 'DISPATCHED' && record.aiTaskCount === 0) {
      return false
    }
    if (query.aiDispatch === 'UNDISPATCHED' && record.aiTaskCount > 0) {
      return false
    }

    if (query.search && query.search.trim() !== '') {
      const keyword = query.search.trim().toLowerCase()
      const projectName = projectMap.get(record.projectId)?.name.toLowerCase() ?? ''
      const serviceNames = record.serviceIds
        .map((id) => serviceMap.get(id)?.name.toLowerCase())
        .filter(Boolean)
        .join(' ')
      const description = record.description.toLowerCase()
      const title = record.title.toLowerCase()
      const matches =
        title.includes(keyword) ||
        description.includes(keyword) ||
        projectName.includes(keyword) ||
        serviceNames.includes(keyword) ||
        record.code.toLowerCase().includes(keyword)
      if (!matches) {
        return false
      }
    }

    return true
  })
}

const ensureServiceIds = (serviceIds: string[]): string[] => {
  const unique = Array.from(new Set(serviceIds))
  return unique.filter((id) => serviceMap.has(id))
}

const ensureWatcherIds = (watcherIds: string[]): string[] => {
  const unique = Array.from(new Set(watcherIds))
  return unique.filter((id) => personMap.has(id))
}

const generateCode = () => {
  const now = today()
  const prefix = `REQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const sequence = requirementRecords.length + 101
  return `${prefix}-${sequence}`
}

export const requirementsMockStore = {
  list(query: RequirementListQuery = {}): RequirementListResponse {
    const filtered = filterRecords(requirementRecords, query)
    const sorted = applySort(filtered, query.sortBy ?? 'updatedAt', query.sortOrder ?? 'desc')
    const items: RequirementListItem[] = sorted.map((record) => toListItem(record))

    return {
      items,
      total: items.length,
      stats: computeStats(),
      filters: collectFilters()
    }
  },

  get(id: string): RequirementDetail | null {
    const record = requirementRecords.find((item) => item.id === id)
    if (!record) return null
    return buildDetail(record)
  },

  getNextStatuses(status: RequirementStatus): RequirementStatus[] {
    return STATUS_TRANSITIONS[status] ?? []
  },

  create(payload: RequirementCreatePayload): RequirementDetail {
    const nowIso = iso(today())
    const serviceIds = ensureServiceIds(payload.serviceIds)
    const watcherIds = ensureWatcherIds(payload.watcherIds)

    const newRecord: RequirementRecord = {
      id: randomUUID(),
      code: generateCode(),
      title: payload.title.trim(),
      description: payload.description,
      projectId: payload.projectId,
      serviceIds,
      priority: payload.priority,
      status: payload.status,
      ownerId: payload.ownerId,
      watcherIds,
      tags: payload.tags ? Array.from(new Set(payload.tags.map((tag) => tag.trim()).filter(Boolean))) : [],
      dueAt: payload.dueAt ? new Date(payload.dueAt).toISOString() : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastAiDispatchAt: undefined,
      aiTaskCount: 0,
      taskLinks: [],
      statusHistory: [
        {
          id: randomUUID(),
          fromStatus: null,
          toStatus: payload.status,
          changedById: payload.ownerId,
          changedBy: personMap.get(payload.ownerId) ?? people[0],
          note: '创建需求',
          createdAt: nowIso
        }
      ],
      lastUpdatedById: payload.ownerId
    }

    requirementRecords.unshift(newRecord)

    return buildDetail(newRecord)
  },

  update(id: string, payload: RequirementUpdatePayload): RequirementDetail {
    const record = requirementRecords.find((item) => item.id === id)
    if (!record) {
      throw new Error('Requirement not found')
    }

    const nowIso = iso(today())
    let updated = false

    if (payload.title && payload.title.trim() !== '' && payload.title.trim() !== record.title) {
      record.title = payload.title.trim()
      updated = true
    }

    if (typeof payload.description === 'string' && payload.description !== record.description) {
      record.description = payload.description
      updated = true
    }

    if (payload.projectId && payload.projectId !== record.projectId) {
      record.projectId = payload.projectId
      updated = true
    }

    if (payload.serviceIds) {
      const nextServiceIds = ensureServiceIds(payload.serviceIds)
      if (JSON.stringify(nextServiceIds) !== JSON.stringify(record.serviceIds)) {
        record.serviceIds = nextServiceIds
        updated = true
      }
    }

    if (payload.priority && payload.priority !== record.priority) {
      record.priority = payload.priority
      updated = true
    }

    if (payload.ownerId && payload.ownerId !== record.ownerId) {
      record.ownerId = payload.ownerId
      updated = true
    }

    if (payload.watcherIds) {
      const nextWatcherIds = ensureWatcherIds(payload.watcherIds)
      if (JSON.stringify(nextWatcherIds) !== JSON.stringify(record.watcherIds)) {
        record.watcherIds = nextWatcherIds
        updated = true
      }
    }

    if ('dueAt' in payload) {
      const normalized = payload.dueAt ? new Date(payload.dueAt).toISOString() : undefined
      if (normalized !== record.dueAt) {
        record.dueAt = normalized
        updated = true
      }
    }

    if (payload.tags) {
      const nextTags = Array.from(new Set(payload.tags.map((tag) => tag.trim()).filter(Boolean)))
      if (JSON.stringify(nextTags) !== JSON.stringify(record.tags)) {
        record.tags = nextTags
        updated = true
      }
    }

    if (payload.status && payload.status !== record.status) {
      applyStatusChange(record, {
        toStatus: payload.status,
        changedBy: payload.updatedBy ?? record.ownerId,
        note: payload.updatedBy ? '手动更新状态' : undefined
      })
      updated = true
    }

    if (updated) {
      record.updatedAt = nowIso
      if (payload.updatedBy) {
        record.lastUpdatedById = payload.updatedBy
      }
    }

    return buildDetail(record)
  },

  changeStatus(id: string, payload: RequirementStatusChangePayload): RequirementDetail {
    const record = requirementRecords.find((item) => item.id === id)
    if (!record) {
      throw new Error('Requirement not found')
    }

    applyStatusChange(record, payload)
    return buildDetail(record)
  },

  dispatch(id: string, payload: RequirementDispatchPayload): RequirementDispatchResult {
    const record = requirementRecords.find((item) => item.id === id)
    if (!record) {
      throw new Error('Requirement not found')
    }
    if (!payload.aiEmployeeIds || payload.aiEmployeeIds.length === 0) {
      throw new Error('请选择至少一位 AI 员工')
    }

    const nowIso = iso(today())
    const projectId = payload.projectId ?? record.projectId
    const serviceIds = payload.serviceIds ? ensureServiceIds(payload.serviceIds) : record.serviceIds

    const newlyCreatedTaskIds: string[] = []

    payload.aiEmployeeIds.forEach((employeeId) => {
      if (!aiEmployeeMap.has(employeeId)) {
        return
      }
      const serviceId = serviceIds[0]
      const taskId = randomUUID()
      const assignmentId = `mock-${taskId}`
      const newTask: RequirementTaskLinkInternal = {
        id: taskId,
        aiTaskAssignmentId: assignmentId,
        aiEmployeeId: employeeId,
        aiEmployee: aiEmployeeMap.get(employeeId)!,
        taskTitle: payload.taskTitle,
        projectId,
        projectName: projectMap.get(projectId)?.name ?? '',
        serviceId,
        serviceName: serviceId ? serviceMap.get(serviceId)?.name : undefined,
        branchName: payload.branch,
        expectedOutputs: payload.expectedOutputs?.filter((item) => item.trim() !== ''),
        priority: payload.priority,
        status: 'PENDING',
        resultSummary: '等待 AI 员工开始执行任务',
        createdAt: nowIso,
        updatedAt: nowIso
      }

      record.taskLinks = [...record.taskLinks, newTask]
      newlyCreatedTaskIds.push(taskId)
    })

    if (newlyCreatedTaskIds.length === 0) {
      throw new Error('未找到可用的 AI 员工，派发失败')
    }

    record.aiTaskCount = record.taskLinks.length
    record.lastAiDispatchAt = nowIso
    record.updatedAt = nowIso
    record.lastUpdatedById = payload.requestedBy

    if (record.status === 'DRAFT' || record.status === 'TODO') {
      applyStatusChange(record, {
        toStatus: 'IN_PROGRESS',
        changedBy: payload.requestedBy,
        note: '派发给 AI 员工后自动进入执行中'
      })
    }

    return {
      requirement: buildDetail(record),
      newlyCreatedTaskIds
    }
  },

  delete(id: string): boolean {
    const index = requirementRecords.findIndex((item) => item.id === id)
    if (index === -1) return false
    requirementRecords.splice(index, 1)
    return true
  },

  getFilters(): RequirementFilterOptions {
    return collectFilters()
  },

  getPeople(): RequirementPersonRef[] {
    return clone(people)
  },

  getAiEmployees(): Array<{ id: string; name: string; type: AIEmployeeType }> {
    return clone(aiEmployees)
  }
}
